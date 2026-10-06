import * as faceapi from 'face-api.js';

export const FACE_RECOGNITION_THRESHOLD = 0.55; // Euclidean distance threshold (<0.55 is match)

let modelsLoaded = false;
let modelLoadingPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
    } catch (err) {
      console.error('Error loading face-api models from /models, trying fallback', err);
      // Fallback to online CDN if local path had an issue
      try {
        const CDN_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL),
        ]);
        modelsLoaded = true;
      } catch (fallbackErr) {
        console.error('Failed loading fallback face models', fallbackErr);
        throw new Error('Could not load face recognition neural network models. Please check network or local weights.');
      }
    }
  })();

  return modelLoadingPromise;
}

export interface DetectedFaceResult {
  box: { x: number; y: number; width: number; height: number };
  descriptor: number[];
  score: number;
}

/**
 * Detect exactly one face for registration and extract 128-d embedding
 */
export async function detectSingleFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<{ descriptor: number[]; score: number; box: { x: number; y: number; width: number; height: number } } | null> {
  await loadFaceModels();

  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const detection = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  return {
    descriptor: Array.from(detection.descriptor),
    score: detection.detection.score,
    box: {
      x: detection.detection.box.x,
      y: detection.detection.box.y,
      width: detection.detection.box.width,
      height: detection.detection.box.height,
    },
  };
}

/**
 * Detect all faces in a classroom photo and extract 128-d embedding for each
 */
export async function detectAllFacesInClassroom(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<DetectedFaceResult[]> {
  await loadFaceModels();

  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.4 });
  const detections = await faceapi
    .detectAllFaces(input, options)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections.map((det) => ({
    box: {
      x: det.detection.box.x,
      y: det.detection.box.y,
      width: det.detection.box.width,
      height: det.detection.box.height,
    },
    descriptor: Array.from(det.descriptor),
    score: det.detection.score,
  }));
}

/**
 * Computes Euclidean Distance between two 128-dimensional face embedding vectors
 */
export function calculateEuclideanDistance(desc1: number[], desc2: number[]): number {
  if (desc1.length !== desc2.length) {
    throw new Error('Descriptor length mismatch');
  }
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Converts Euclidean Distance into an intuitive Confidence Percentage (e.g., 94%)
 */
export function distanceToConfidence(distance: number): number {
  // Distance 0.0 => 100% confidence
  // Distance 0.35 => ~90% confidence
  // Distance 0.50 => ~80% confidence
  // Distance 0.55 => ~72% confidence
  // Distance 0.70 => ~50% confidence
  if (distance <= 0) return 99.5;
  const confidence = Math.max(10, Math.min(99, (1 - distance / 0.85) * 100));
  return Math.round(confidence * 10) / 10;
}

/**
 * Average multiple sample embeddings (5-10 samples) into a robust master embedding
 */
export function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) throw new Error('No embeddings provided');
  const len = embeddings[0].length;
  const avg = new Array(len).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < len; i++) {
      avg[i] += emb[i];
    }
  }

  for (let i = 0; i < len; i++) {
    avg[i] /= embeddings.length;
  }

  // Normalize vector to unit length
  const norm = Math.sqrt(avg.reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < len; i++) {
      avg[i] /= norm;
    }
  }

  return avg;
}
