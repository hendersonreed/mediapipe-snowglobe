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

const numSupportedObjects = 6;
const landmarkerType = 'hands'; // could be hands, face, or pose
//const landmarkerType = 'face'; // could be hands, face, or pose
//const landmarkerType = 'pose'; // could be hands, face, or pose

import {
  HandLandmarker,
  FaceLandmarker,
  PoseLandmarker,
  FilesetResolver
} from "@mediapipe/tasks-vision";

let landmarker = undefined;
let webcamRunning: Boolean = false;

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  switch (landmarkerType) {
    case 'hands':
      landmarker =
        await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: numSupportedObjects
        });
      break;
    case 'face':
      landmarker =
        await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: numSupportedObjects
        });
      break;
    case 'pose':
      landmarker =
        await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: numSupportedObjects
        });
      break;
    default:
      console.log("misconfigured landmarkerType");
      break;
  }
};

createLandmarker();


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
  if (!landmarker) {
    console.log("Wait! objectDetector not loaded yet.");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
  } else {
    webcamRunning = true;
  }

  // getUsermedia parameters.
  // drastically reduced to improve performance (I think it's working?)
  const constraints = {
    video: {
      width: { ideal: 160 },
      height: { ideal: 120 },
      frameRate: { ideal: 15 },
    }
  };

  // hide the "click to start message"
  let clickMessage = document.getElementById('clickMessage');
  if (clickMessage) {
    clickMessage.style.display = "none";
  }

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

let lastVideoTime = -1;
let results = undefined;

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
    if (landmarker) {
      results = landmarker.detectForVideo(video, startTimeMs);
    }
  }
  if (canvasCtx) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (results) {
      let landmarks = undefined;
      if (landmarkerType === 'hands') { landmarks = results.landmarks; }
      if (landmarkerType === 'face') { landmarks = results.faceLandmarks; }
      if (landmarkerType === 'pose') { landmarks = results.landmarks; }
      if (landmarks) {
        drawTheStuff(landmarks);
        //drawTheStuff2(landmarks);
      }
    }
    canvasCtx.restore();
  }

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
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
    numLandmarks = 471;
    break;
  case 'pose':
    numLandmarks = 33;
    break;
  default:
    console.log("error: incorrectly configured landmarker type.");
    break;
}

const numParticles = 250; // Number of particles
const maxX = window.innerWidth; // Maximum X coordinate
const maxY = window.innerHeight; // Maximum Y coordinate
const maxGrownSize = 17;
const maxNaturalSize = 7;
const minSize = 1;

// Create an array of N particles with random coordinates
const particlesArray = Array.from({ length: numParticles }, () => {
  const size = Math.random() * (maxNaturalSize - minSize) + minSize;
  const maxSize = Math.random() * (maxGrownSize - minSize) + minSize; // Replace scaleFactor with your actual scaling factor

  return {
    x: Math.random() * maxX,
    y: Math.random() * maxY,
    size: size,
    maxSize: maxSize,
    drawnToUser: Math.random() < 0.55,
    landmark: Math.floor(Math.random() * numLandmarks),
    object: Math.floor(Math.random() * numSupportedObjects),
    color: `rgba(255, 255, 255, ${Math.random()})`
  };
});

let angle = 0;
async function drawTheStuff(resultLandmarks) {
  angle += 0.02;
  particlesArray.forEach(particle => {
    canvasCtx.beginPath();
    canvasCtx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
    canvasCtx.fillStyle = particle.color;
    canvasCtx.fill();
    canvasCtx.closePath();
    applyPhysics(particle, resultLandmarks);
  });
}

async function applyPhysics(particle, resultLandmarks) {
  applyGravityAndWind(particle);
  nudgeParticleTowardsChosenLandmark(particle, resultLandmarks)
  resetParticleIfOffScreen(particle);
}

async function applyGravityAndWind(particle) {
  particle.y += Math.cos(angle + particle.size) + 1;
  particle.x += Math.sin(angle) * 3;
}

async function resetParticleIfOffScreen(particle) {
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

function flipWithProbability(original: boolean, probability: number) {
  return Math.random() < probability ? !original : original;
}

async function nudgeParticleTowardsChosenLandmark(particle, resultLandmarks) {
  if (particle.drawnToUser === true) {
    let object = resultLandmarks[particle.object]
    if (object) {
      let destinationX = maxX - (object[particle.landmark].x * maxX); // x needs to be mirrored to behave like... a mirror.
      let destinationY = (object[particle.landmark].y * maxY); // y doesn't need mirroring.

      function lerp(start, end, t) {
        return (1 - t) * start + t * end;
      }

      let smoothingFactor = 0.02;
      particle.x = lerp(particle.x, destinationX, smoothingFactor);
      particle.y = lerp(particle.y, destinationY, smoothingFactor);

      particle.size < particle.maxSize ? particle.size += 1 : false;
    }
  }
  // we want some particles to change their drawn-to-user status
  particle.drawnToUser = flipWithProbability(particle.drawnToUser, 0.001);
}
