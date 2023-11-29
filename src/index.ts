// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
const landmarkerType = 'hands'; // could be hands, face, or pose

import {
  HandLandmarker,
  FaceLandmarker,
  PoseLandmarker,
  FilesetResolver
} from "@mediapipe/tasks-vision";

const demosSection = document.getElementById("demos");

let handLandmarker = undefined;
let webcamRunning: Boolean = false;

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createHandLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 2
  });
  demosSection.classList.remove("invisible");
};
createHandLandmarker();


const video = document.getElementById("webcam") as HTMLVideoElement;
const canvasElement = document.getElementById(
  "output_canvas"
) as HTMLCanvasElement;
const canvasCtx = canvasElement.getContext("2d");

// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  document.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
  if (!handLandmarker) {
    console.log("Wait! objectDetector not loaded yet.");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
  } else {
    webcamRunning = true;
  }

  // getUsermedia parameters.
  const constraints = {
    video: true
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

let lastVideoTime = -1;
let results = undefined;
//console.log(video);
async function predictWebcam() {
  canvasElement.style.width = '100vw';
  canvasElement.style.height = '100vh';
  canvasElement.style.background = '#6b92b9';
  canvasElement.style.display = 'block';
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;

  // Now let's start detecting the stream.
  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker.detectForVideo(video, startTimeMs);
  }
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results.landmarks) {
    drawTheStuff(results.landmarks);
    //drawTheStuff2(results.landmarks);
  }
  canvasCtx.restore();

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

function drawTheStuff2(resultLandmarks) {
  for (const landmarks of resultLandmarks) {
    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
      color: "#FFFFFF",
      lineWidth: 5
    });
    drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });
  }
}

/*
 * this is agnostic to the type of landmark, as long as we set 
 * "numLandmarks" properly according to the landmarking model
 */

let numLandmarks = 0;
switch (landmarkerType) {
  case 'hands':
    numLandmarks = 21;
    break;
  case 'face':
    numLandmarks = 21;
    break;
  case 'pose':
    numLandmarks = 21;
    break;
  default:
    console.log("error: incorrectly configured landmarker type.");
    break;
}

const numSupportedObjects = 2;

const numParticles = 2000; // Number of particles
const maxX = window.innerWidth; // Maximum X coordinate
const maxY = window.innerHeight; // Maximum Y coordinate
const maxGrownSize = 25;
const maxNaturalSize = 7;
const minSize = 1;

// Create an array of N particles with random coordinates
const particlesArray = Array.from({ length: numParticles }, () => ({
  x: Math.random() * maxX,
  y: Math.random() * maxY,
  size: Math.random() * (maxNaturalSize - minSize) + minSize,
  drawnToUser: Math.random() < 0.5 ? true : false,
  landmark: Math.floor(Math.random() * numLandmarks),
  object: Math.floor(Math.random() * numSupportedObjects),
  maxSize: Math.random() * (maxGrownSize - this.size) + this.size,
  color: `rgba(255, 255, 255, ${Math.random()})`,
}));

function drawTheStuff(resultLandmarks) {
  particlesArray.forEach(particle => {
    canvasCtx.beginPath();
    canvasCtx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
    canvasCtx.fillStyle = particle.color;
    canvasCtx.fill();
    canvasCtx.closePath();
  });
  applyPhysics(particlesArray, resultLandmarks);
}

let angle = 0;
function applyPhysics(particles, resultLandmarks) {
  angle += 0.01;
  particles.forEach(particle => {
    applyGravityAndWind(particle);
    nudgeParticleTowardsChosenLandmark(particle, resultLandmarks)
    resetParticleIfOffScreen(particle);
  });
}

function applyGravityAndWind(particle) {
  particle.y += Math.cos(angle + particle.size) + 1;
  particle.x += Math.sin(angle) * 2;
}

function resetParticleIfOffScreen(particle) {
  // reset a particle if it has fallen off screen.
  if (particle.y > maxY || particle.x > maxX) {
    if (Math.random() < 0.6) {
      particle.x = Math.random() * maxX;
      particle.y = 0;
    }
    else {
      if (Math.sin(angle) > 0) {
        particle.x = -5;
      }
      else {
        particle.x = maxX;
      }
      particle.y = Math.random() * maxY;
    }
    particle.size = Math.random() * (maxNaturalSize - minSize) + minSize;
    particle.landmark = Math.floor(Math.random() * numLandmarks);
  }
}

function nudgeParticleTowardsChosenLandmark(particle, resultLandmarks) {
  let nudgeFactor = 15;
  if (particle.drawnToUser === true) {
    resultLandmarks.forEach((object, index) => {
      if (particle.object == index) {
        // we need to mirror the landmark around the center of the screen, so it feels like a mirror.
        let destinationX = maxX - (object[particle.landmark].x * maxX);
        let destinationY = (object[particle.landmark].y * maxY); // y doesn't need mirroring.
        const deltaX = destinationX - particle.x;
        const deltaY = destinationY - particle.y;

        const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);

        // Move the particle closer to the landmark
        particle.x += (deltaX / distance) * (Math.random()) * nudgeFactor;
        particle.y += (deltaY / distance) * (Math.random()) * nudgeFactor;
        particle.size < particle.maxSize ? particle.size += 0.1 : false;
      }
    });
  }
}
