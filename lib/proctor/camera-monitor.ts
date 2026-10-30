"use client";
/**
 * Surveillance caméra dans le navigateur : détection de visages (modèle
 * TinyFaceDetector embarqué, servi depuis notre domaine), luminosité et image
 * figée. Ne prend aucune décision : il signale des anomalies, le serveur
 * décide de leur gravité et le surveillant voit les photos associées.
 *
 * Limite assumée : un candidat très technique peut neutraliser du code
 * client. C'est pourquoi le serveur exige aussi des photos régulières
 * (infraction s'il n'en reçoit plus) que le surveillant peut consulter.
 */
export type CameraAnomaly = "no_face" | "multiple_faces" | "camera_covered" | "camera_frozen";
export type CameraStatus = { faces: number | null; brightness: number; anomaly: CameraAnomaly | null; ready: boolean };

type Options = {
  video: HTMLVideoElement;
  modelUrl?: string;
  intervalMs?: number;
  onStatus?: (s: CameraStatus) => void;
  onAnomaly?: (kind: CameraAnomaly, detail: Record<string, unknown>) => void;
};

// Nombre de mesures consécutives avant de signaler (une mesure toutes les ~2 s)
const THRESHOLD: Record<CameraAnomaly, number> = { no_face: 4, multiple_faces: 2, camera_covered: 3, camera_frozen: 6 };
// Délai minimum entre deux signalements du même type
const COOLDOWN_MS = 30_000;

let faceapiPromise: Promise<any> | null = null;

async function loadDetector(modelUrl: string) {
  if (!faceapiPromise) {
    faceapiPromise = (async () => {
      const faceapi: any = await import("@vladmandic/face-api");
      await faceapi.tf.setBackend("webgl").catch(() => faceapi.tf.setBackend("cpu"));
      await faceapi.tf.ready();
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
      return faceapi;
    })().catch((e) => { faceapiPromise = null; throw e; });
  }
  return faceapiPromise;
}

export function startCameraMonitor(opts: Options): () => void {
  const { video, modelUrl = "/models", intervalMs = 2000, onStatus, onAnomaly } = opts;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const streak: Record<CameraAnomaly, number> = { no_face: 0, multiple_faces: 0, camera_covered: 0, camera_frozen: 0 };
  const lastSent: Partial<Record<CameraAnomaly, number>> = {};
  let prevSample: Uint8ClampedArray | null = null;
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 48;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let faceapi: any = null;
  let detectorFailed = false;

  loadDetector(modelUrl).then((f) => { faceapi = f; }).catch(() => { detectorFailed = true; });

  const bump = (kind: CameraAnomaly, on: boolean, detail: Record<string, unknown>) => {
    streak[kind] = on ? streak[kind] + 1 : 0;
    if (streak[kind] === THRESHOLD[kind]) {
      const now = Date.now();
      if (!lastSent[kind] || now - lastSent[kind]! > COOLDOWN_MS) {
        lastSent[kind] = now;
        onAnomaly?.(kind, detail);
      }
    }
  };

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth && ctx) {
        // Luminosité moyenne et différence avec la mesure précédente
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let sum = 0, diff = 0;
        for (let i = 0; i < px.length; i += 4) {
          const l = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
          sum += l;
          if (prevSample) diff += Math.abs(l - (prevSample[i] * 299 + prevSample[i + 1] * 587 + prevSample[i + 2] * 114) / 1000);
        }
        const n = px.length / 4;
        const brightness = sum / n;
        const meanDiff = prevSample ? diff / n : 99;
        prevSample = new Uint8ClampedArray(px);

        const covered = brightness < 18;
        bump("camera_covered", covered, { brightness: Math.round(brightness) });
        bump("camera_frozen", !covered && meanDiff < 0.15, { diff: Math.round(meanDiff * 100) / 100 });

        let faces: number | null = null;
        if (faceapi && !covered) {
          const dets = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }));
          faces = dets.length as number;
          bump("no_face", faces === 0, { faces });
          bump("multiple_faces", (faces ?? 0) > 1, { faces });
        }
        const anomaly = (Object.keys(streak) as CameraAnomaly[]).find((k) => streak[k] >= THRESHOLD[k]) || null;
        onStatus?.({ faces, brightness, anomaly, ready: !!faceapi || detectorFailed });
      }
    } catch { /* mesure suivante */ }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, 800);
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

export const ANOMALY_LABEL: Record<CameraAnomaly, string> = {
  no_face: "aucun visage détecté",
  multiple_faces: "plusieurs visages détectés",
  camera_covered: "caméra masquée ou image noire",
  camera_frozen: "image de la caméra figée",
};
