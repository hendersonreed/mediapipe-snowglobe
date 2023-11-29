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

import {
  HandLandmarker,
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
  document.addEventListener("keydown", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
  if (event.code === 'Space' || event.key === ' ') {
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
}

let lastVideoTime = -1;
let results = undefined;
//console.log(video);
async function predictWebcam() {
  canvasElement.style.width = '100vw';
  canvasElement.style.height = '100vh';
  canvasElement.style.background = 'blue';
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
    drawTheStuff2(results.landmarks);
  }
  canvasCtx.restore();

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

function drawTheStuff(resultLandmarks) {
  for (const landmarks of resultLandmarks) {
    /*
    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
      color: "#FFFFFF",
      lineWidth: 5
    });
    */
    //    drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });
  }
}

const numParticles = 500; // Number of particles
const maxX = window.innerWidth; // Maximum X coordinate
const maxY = window.innerHeight; // Maximum Y coordinate
const maxSize = 5;
const minSize = 1;

// Create an array of N particles with random coordinates
const particlesArray = Array.from({ length: numParticles }, () => ({
  x: Math.random() * maxX,
  y: Math.random() * maxY,
  size: Math.random() * (maxSize - minSize) + minSize,
  drawnToUser: Math.random() < 0.5 ? true : false,
  landMark: Math.floor(Math.random() * 21),
  hand: Math.floor(Math.random() * 2),
}));

let gravity = 1;
let smoothedWind = 0;
let smoothingFactor = 0.1;


function drawTheStuff2(resultLandmarks) {
  particlesArray.forEach(particle => {
    canvasCtx.beginPath();
    canvasCtx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
    canvasCtx.fillStyle = 'white'; // Change the color as needed
    canvasCtx.fill();
    canvasCtx.closePath();
  });
  applyPhysics(particlesArray, gravity, smoothedWind, resultLandmarks);
}


function applyPhysics(particles, gravity, wind, resultLandmarks) {
  particles.forEach(particle => {
    // Apply gravity
    particle.y += gravity;

    // Apply random sideways motion for wind
    smoothedWind = (1 - smoothingFactor) * smoothedWind + smoothingFactor * (Math.random() - 0.5);
    particle.x += smoothedWind;

    // reset a particle if it has fallen off screen.
    if (particle.y > maxY) {
      particle.x = Math.random() * maxX;
      particle.y = 0;
      particle.size = Math.random() * (maxSize - minSize) + minSize;
    }

    let nudgeFactor = 5;
    if (particle.drawnToUser === true) {
      resultLandmarks.forEach((hand, index) => {
        if (particle.hand == index) {
          const deltaX = (hand[particle.landMark].x * window.innerWidth) - particle.x;
          const deltaY = (hand[particle.landMark].y * window.innerHeight) - particle.y;
          const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);

          // Move the particle closer to the landmark
          particle.x += (deltaX / distance) * (Math.random() * 4) * nudgeFactor;
          particle.y += (deltaY / distance) * (Math.random() * 4) * nudgeFactor;
        }
      });
    }
  });
}
