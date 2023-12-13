import {
  HandLandmarker,
  FaceLandmarker,
  PoseLandmarker,
  FilesetResolver
} from "@mediapipe/tasks-vision";

const numSupportedObjects = 6;
const landmarkerType = 'hands'; // could be hands, face, or pose
//const landmarkerType = 'face'; // could be hands, face, or pose
//const landmarkerType = 'pose'; // could be hands, face, or pose


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
          runningMode: "IMAGE",
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
          runningMode: "IMAGE",
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
          runningMode: "IMAGE",
          numPoses: numSupportedObjects
        });
      break;
    default:
      console.log("misconfigured landmarkerType");
      break;
  }
  if (landmarker) {
    return landmarker
  } else {
    throw Error("an error occurred while creating the landmarker.");
  }
};

let landmarker = createLandmarker();

self.addEventListener('message', async (event) => {
  // Handle messages from the main thread
  const { image } = event.data;
  const results = await landmarker.detect(image);
  // Send the results back to the main thread
  self.postMessage(results);
});
