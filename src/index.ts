const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;
if (hasGetUserMedia()) {
  document.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}


const numSupportedObjects = 6;
const landmarkerType = 'hands'; // could be hands, face, or pose
//const landmarkerType = 'face'; // could be hands, face, or pose
//const landmarkerType = 'pose'; // could be hands, face, or pose


let worker;
if (window.Worker) {
  worker = new Worker('landmarkWorker.js');
}

const video = document.getElementById("webcam") as HTMLVideoElement;
const canvasElement = document.getElementById(
  "output_canvas"
) as HTMLCanvasElement;
const canvasCtx = canvasElement.getContext("2d");

let webcamRunning: Boolean = false;
let lastVideoTime = -1;


// Enable the live webcam view and start detection.
function enableCam() {
  if (webcamRunning === false) {
    webcamRunning = true;
  } else {
    return;
  }

  // getUsermedia parameters.
  const constraints = {
    video: { video }
  };

  // hide the "click to start message"
  let clickMessage = document.getElementById('clickMessage');
  if (clickMessage) {
    clickMessage.style.display = "none";
  }

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", () => {
      predictWebcam();
    });
  });
}

async function predictWebcam() {
  canvasElement.style.width = '100vw';
  canvasElement.style.height = '100vh';
  canvasElement.style.background = '#6b92b9';
  canvasElement.style.display = 'block';
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
  if (canvasCtx) {
    // Update the animation with the results from the WebWorker
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    drawTheStuff();
    if (results) {
      let landmarks;
      if (landmarkerType === 'hands') { landmarks = results.landmarks; }
      if (landmarkerType === 'face') { landmarks = results.faceLandmarks; }
      if (landmarkerType === 'pose') { landmarks = results.landmarks; }
      if (landmarks) {
        particlesArray.forEach((particle) => {
          nudgeParticleTowardsChosenLandmark(particle, landmarks);
        });
      }
    }
  }
  canvasCtx.restore();
  let image = await createImageBitmap(video);
  if (worker) {
    worker.postMessage({ image: image });
  }


  // Call this function again to keep predicting when the browser is ready.
  let fps = 60;
  if (webcamRunning === true) {
    setTimeout(() => {
      requestAnimationFrame(predictWebcam);
    }, 1000 / fps);
  }
}

// save result landmarkers to global var
let results;
if (worker) {
  worker.addEventListener('message', (event) => {
    results = event.data;
  });
}









// animation constants

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

const numDriftingParticles = 500; // Number of particles
const numParticlesDrawnToUser = 250; // Number of particles
const maxX = window.innerWidth; // Maximum X coordinate
const maxY = window.innerHeight; // Maximum Y coordinate
const maxGrownSize = 14;
const maxNaturalSize = 7;
const minSize = 1;

// Create an array of N particles with random coordinates
const driftingParticles = Array.from({ length: numDriftingParticles }, () => {
  const size = Math.random() * (maxNaturalSize - minSize) + minSize;
  const maxSize = Math.random() * (maxGrownSize - minSize) + minSize; // Replace scaleFactor with your actual scaling factor

  return {
    x: Math.random() * maxX,
    y: Math.random() * maxY,
    size: size,
    maxSize: maxSize,
    drawnToUser: false,
    landmark: Math.floor(Math.random() * numLandmarks),
    object: Math.floor(Math.random() * numSupportedObjects),
    color: `rgba(255, 255, 255, ${Math.random()})`
  };
});


const particlesDrawnToUser = Array.from({ length: numParticlesDrawnToUser }, () => {
  const size = Math.random() * (maxNaturalSize - minSize) + minSize;
  const maxSize = Math.random() * (maxGrownSize - minSize) + minSize; // Replace scaleFactor with your actual scaling factor

  return {
    x: Math.random() * maxX,
    y: Math.random() * maxY,
    size: size,
    maxSize: maxSize,
    drawnToUser: true,
    landmark: Math.floor(Math.random() * numLandmarks),
    object: Math.floor(Math.random() * numSupportedObjects),
    color: `rgba(255, 255, 255, ${Math.random()})`
  };
});

const particlesArray = driftingParticles.concat(particlesDrawnToUser);


// animation logic

let angle = 0;
async function drawTheStuff() {
  angle += 0.01;
  particlesArray.forEach(particle => {
    canvasCtx.beginPath();
    canvasCtx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
    canvasCtx.fillStyle = particle.color;
    canvasCtx.fill();
    canvasCtx.closePath();
    applyPhysics(particle);
  });
}

function applyPhysics(particle) {
  applyGravityAndWind(particle);
  resetParticleIfOffScreen(particle);
}

function applyGravityAndWind(particle) {
  particle.y += Math.cos(angle + particle.size) + 1;
  particle.x += Math.sin(angle) * 1.5;
}

function resetParticleIfOffScreen(particle) {
  // reset a particle if it has fallen off screen.
  if (particle.y > maxY || particle.x > maxX) {
    if (Math.random() < 0.6) {
      particle.x = Math.random() * maxX;
      particle.y = 0;
    }
    else { // some particles get to come in from the side.
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
    // we want all particles to change their drawn-to-user status occasionally. They should do this when they're being reset.
    particle.drawnToUser = flipWithProbability(particle.drawnToUser, 0.25);
  }
}

function flipWithProbability(original: boolean, probability: number) {
  return Math.random() < probability ? !original : original;
}

function nudgeParticleTowardsChosenLandmark(particle, resultLandmarks) {
  if (particle.drawnToUser === true) {
    let object = resultLandmarks[particle.object]
    if (object) {
      let destinationX = maxX - (object[particle.landmark].x * maxX); // x needs to be mirrored to behave like... a mirror.
      let destinationY = (object[particle.landmark].y * maxY); // y doesn't need mirroring.

      function lerp(start, end, t) {
        return (1 - t) * start + t * end;
      }

      let smoothingFactor = 0.04;
      particle.x = lerp(particle.x, destinationX, smoothingFactor);
      particle.y = lerp(particle.y, destinationY, smoothingFactor);

      particle.size < particle.maxSize ? particle.size += 1 : false;
      // we want some particles to leave the hand.
      particle.drawnToUser = flipWithProbability(particle.drawnToUser, 0.001);
    }
  }
}
