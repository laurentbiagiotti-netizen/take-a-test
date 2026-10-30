"use client";
/**
 * Surveillance caméra dans le navigateur : détection de visages, luminosité et
 * image figée. Ne prend aucune décision : il signale des anomalies, le serveur
 * décide de leur gravité et le surveillant voit les photos associées.
 *
 * Deux détecteurs, servis depuis notre domaine :
 *  - TinyFaceDetector, rapide, à chaque mesure : le visage du candidat ;
 *  - SSD MobileNet v1, plus précis, toutes les 3 mesures (et aussitôt en cas de
 *    doute) : il analyse l'image entière puis 4 zones qui se chevauchent, à
 *    pleine résolution. Un visage lointain occupe alors deux fois plus de pixels :
 *    une personne au fond de la pièce (visage de 3 % de la largeur de l'image),
 *    floue ou de trois quarts, est repérée. Quand la pièce est sombre, l'image
 *    analysée est éclaircie (pas l'image enregistrée).
 *  - CenterNet (détection de personnes), à chaque analyse fine : il repère un
 *    corps même quand la tête n'est pas visible (personne debout derrière le
 *    candidat, tête hors champ, de dos ou cachée). Un corps qui ne contient aucun
 *    des visages détectés est signalé comme « autre personne ».
 * Les détections sont fusionnées (un même visage n'est compté qu'une fois).
 * Une autre personne est signalée si elle apparaît sur 2 des 3 dernières
 * analyses fines, ou sur 2 des 5 dernières mesures rapides.
 *
 * Limite assumée : une personne de dos ou hors champ n'a pas de visage visible.
 * C'est pourquoi le serveur exige aussi des photos régulières, consultables par
 * le surveillant, et qu'une photo est prise à chaque anomalie.
 */
export type CameraAnomaly = "no_face" | "multiple_faces" | "other_person" | "camera_covered" | "camera_frozen";
export type CameraStatus = { faces: number | null; brightness: number; anomaly: CameraAnomaly | null; ready: boolean };

type Options = {
  video: HTMLVideoElement;
  modelUrl?: string;
  intervalMs?: number;
  onStatus?: (s: CameraStatus) => void;
  onAnomaly?: (kind: CameraAnomaly, detail: Record<string, unknown>) => void;
};

type Box = { x: number; y: number; w: number; h: number; score: number };

// Mesures consécutives avant de signaler (une mesure toutes les ~1,5 s)
const THRESHOLD: Record<Exclude<CameraAnomaly, "multiple_faces" | "other_person">, number> = { no_face: 4, camera_covered: 3, camera_frozen: 8 };
// Autre personne : 2 des 5 dernières mesures rapides, ou 2 des 3 dernières analyses fines
const QUICK_WINDOW = 5, QUICK_HITS = 2, DEEP_WINDOW = 3, DEEP_HITS = 2;
const DEEP_EVERY = 3;
const COOLDOWN_MS = 30_000;
// Réglages de détection
const TINY = { inputSize: 320, scoreThreshold: 0.45 };
const SSD_MIN_CONFIDENCE = 0.35;
const MIN_FACE_PX = 14;          // en dessous : bruit
const PERSON_MIN_SCORE = 0.38;   // détection de personnes (corps)
const PERSON_MIN_HEIGHT = 0.15;  // part de la hauteur de l'image en dessous de laquelle on ignore
const PERSON_INPUT = 512;
const SCAN_MAX = 1280;           // résolution maximale analysée par la passe fine

let detectorPromise: Promise<any> | null = null;
let ssdPromise: Promise<boolean> | null = null;
let personPromise: Promise<any> | null = null;

/** Modèle de détection de personnes (CenterNet, classes COCO), chargé en dernier. */
function loadPersons(faceapi: any, modelUrl: string) {
  if (!personPromise) personPromise = faceapi.tf.loadGraphModel(`${modelUrl}/centernet.json`).catch(() => { personPromise = null; return null; });
  return personPromise!;
}

/** Un corps « sans visage » : boîte de personne qui ne contient le centre d'aucun visage détecté. */
export function bodiesWithoutFace(persons: Box[], faces: Box[]): Box[] {
  return persons.filter((p) => !faces.some((f) => {
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    return cx >= p.x && cx <= p.x + p.w && cy >= p.y - f.h && cy <= p.y + p.h;
  }));
}

async function loadDetector(modelUrl: string) {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const faceapi: any = await import("@vladmandic/face-api");
      await faceapi.tf.setBackend("webgl").catch(() => faceapi.tf.setBackend("cpu"));
      await faceapi.tf.ready();
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
      return faceapi;
    })().catch((e) => { detectorPromise = null; throw e; });
  }
  return detectorPromise;
}

/** Passe fine chargée en arrière-plan : si elle échoue, la passe rapide reste active. */
function loadSsd(faceapi: any, modelUrl: string) {
  if (!ssdPromise) {
    ssdPromise = faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl).then(() => true).catch(() => { ssdPromise = null; return false; });
  }
  return ssdPromise!;
}

const iou = (a: Box, b: Box) => {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
};

/** Fusionne les détections : un même visage vu par les deux passes compte une fois. */
export function mergeBoxes(boxes: Box[], minPx = MIN_FACE_PX): Box[] {
  const kept: Box[] = [];
  for (const b of boxes.filter((x) => x.w >= minPx && x.h >= minPx).sort((p, q) => q.score - p.score)) {
    if (!kept.some((k) => iou(k, b) > 0.3 || (b.x >= k.x && b.y >= k.y && b.x + b.w <= k.x + k.w && b.y + b.h <= k.y + k.h))) kept.push(b);
  }
  return kept;
}

const toBox = (d: any, scale: number): Box => ({ x: d.box.x * scale, y: d.box.y * scale, w: d.box.width * scale, h: d.box.height * scale, score: d.score });

export function startCameraMonitor(opts: Options): () => void {
  const { video, modelUrl = "/models", intervalMs = 1500, onStatus, onAnomaly } = opts;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const streak = { no_face: 0, camera_covered: 0, camera_frozen: 0 };
  const quickHistory: boolean[] = [];
  const deepHistory: boolean[] = [];
  let lastDeep: number | null = null;
  const lastSent: Partial<Record<CameraAnomaly, number>> = {};
  let prevSample: Uint8ClampedArray | null = null;
  const probe = document.createElement("canvas");
  probe.width = 64; probe.height = 48;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  const scan = document.createElement("canvas");
  const sctx = scan.getContext("2d");
  const tile = document.createElement("canvas");
  const tctx = tile.getContext("2d");
  let faceapi: any = null;
  let ssdReady = false;
  let personModel: any = null;
  const bodyHistory: boolean[] = [];
  let detectorFailed = false;
  let tickNo = 0;

  loadDetector(modelUrl).then((f) => {
    faceapi = f;
    loadSsd(f, modelUrl).then((ok) => {
      ssdReady = ok;
      loadPersons(f, modelUrl).then((m) => { personModel = m; });
    });
  }).catch(() => { detectorFailed = true; });

  const send = (kind: CameraAnomaly, detail: Record<string, unknown>) => {
    const now = Date.now();
    if (!lastSent[kind] || now - lastSent[kind]! > COOLDOWN_MS) {
      lastSent[kind] = now;
      onAnomaly?.(kind, detail);
    }
  };
  const bump = (kind: keyof typeof streak, on: boolean, detail: Record<string, unknown>) => {
    streak[kind] = on ? streak[kind] + 1 : 0;
    if (streak[kind] === THRESHOLD[kind]) send(kind, detail);
  };

  const push = (h: boolean[], v: boolean, n: number) => { h.push(v); if (h.length > n) h.shift(); };
  const multiNow = () => quickHistory.filter(Boolean).length >= QUICK_HITS || deepHistory.filter(Boolean).length >= DEEP_HITS;

  /** Analyse fine : image entière puis 4 zones (2 x 2, chevauchement de 25 %). */
  const deepScan = async (dark: boolean): Promise<Box[]> => {
    const scale = Math.max(1, video.videoWidth / SCAN_MAX);
    scan.width = Math.round(video.videoWidth / scale); scan.height = Math.round(video.videoHeight / scale);
    sctx!.filter = dark ? "brightness(1.6) contrast(1.15)" : "none";
    sctx!.drawImage(video, 0, 0, scan.width, scan.height);
    sctx!.filter = "none";
    const opt = new faceapi.SsdMobilenetv1Options({ minConfidence: SSD_MIN_CONFIDENCE, maxResults: 10 });
    let out: Box[] = (await faceapi.detectAllFaces(scan, opt)).map((d: any) => toBox(d, scale));
    const tw = scan.width / 1.75, th = scan.height / 1.75;
    for (const [tx, ty] of [[0, 0], [tw * 0.75, 0], [0, th * 0.75], [tw * 0.75, th * 0.75]]) {
      if (stopped) break;
      tile.width = Math.round(tw); tile.height = Math.round(th);
      tctx!.drawImage(scan, tx, ty, tw, th, 0, 0, tile.width, tile.height);
      const found = await faceapi.detectAllFaces(tile, opt);
      out = out.concat(found.map((d: any) => ({ x: (tx + d.box.x) * scale, y: (ty + d.box.y) * scale, w: d.box.width * scale, h: d.box.height * scale, score: d.score })));
    }
    return out;
  };

  /** Personnes visibles (corps entier ou partiel), en coordonnées de la vidéo. */
  const detectPersons = async (): Promise<Box[]> => {
    if (!personModel) return [];
    const tf = faceapi.tf;
    const input = tf.tidy(() => tf.image.resizeBilinear(tf.browser.fromPixels(scan).toFloat().expandDims(0), [PERSON_INPUT, PERSON_INPUT]));
    const out = personModel.execute(input, ["tower_0/detections"]);
    input.dispose();
    const rows: number[][] = (await out.array())[0];
    out.dispose();
    const sx = video.videoWidth / PERSON_INPUT, sy = video.videoHeight / PERSON_INPUT;
    const boxes = rows.filter((r) => r[5] === 0 && r[4] >= PERSON_MIN_SCORE)
      .map((r) => ({ x: r[0] * sx, y: r[1] * sy, w: (r[2] - r[0]) * sx, h: (r[3] - r[1]) * sy, score: r[4] }))
      .filter((b) => b.h >= video.videoHeight * PERSON_MIN_HEIGHT);
    return mergeBoxes(boxes, 1);
  };

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth && pctx) {
        // Luminosité moyenne et différence avec la mesure précédente
        pctx.drawImage(video, 0, 0, probe.width, probe.height);
        const px = pctx.getImageData(0, 0, probe.width, probe.height).data;
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
          // Passe rapide sur l'image vidéo
          const quick = mergeBoxes((await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions(TINY))).map((d: any) => toBox(d, 1)));
          push(quickHistory, quick.length > 1, QUICK_WINDOW);
          faces = quick.length;
          // Analyse fine régulière, et tout de suite s'il y a un doute
          const doubt = quick.length !== 1 || multiNow();
          if (ssdReady && sctx && tctx && (tickNo % DEEP_EVERY === 0 || doubt)) {
            const merged = mergeBoxes(quick.concat(await deepScan(brightness < 80)));
            // Corps sans visage visible (tête hors champ, de dos) à côté du candidat
            if (personModel && merged.length >= 1) {
              const bodies = bodiesWithoutFace(await detectPersons(), merged);
              push(bodyHistory, bodies.length > 0, DEEP_WINDOW);
              if (bodies.length && bodyHistory.filter(Boolean).length >= DEEP_HITS) {
                send("other_person", { corps: bodies.length, visages: merged.length, hauteur: bodies.map((b) => Math.round((b.h / video.videoHeight) * 100) + " %") });
              }
            } else push(bodyHistory, false, DEEP_WINDOW);
            lastDeep = merged.length;
            push(deepHistory, merged.length > 1, DEEP_WINDOW);
            faces = merged.length;
            if (merged.length > 1 && multiNow()) {
              send("multiple_faces", { faces: merged.length, tailles: merged.map((b) => Math.round((b.w / video.videoWidth) * 100) + " %") });
            }
          } else if (lastDeep !== null && deepHistory[deepHistory.length - 1]) {
            // Entre deux analyses fines, on garde en mémoire la personne vue au fond
            faces = Math.max(faces, lastDeep);
          }
          if (quick.length > 1 && multiNow()) send("multiple_faces", { faces: quick.length, passe: "rapide" });
          bump("no_face", faces === 0, { faces });
        }
        const multi = multiNow();
        const anomaly: CameraAnomaly | null =
          streak.camera_covered >= THRESHOLD.camera_covered ? "camera_covered"
          : multi ? "multiple_faces"
          : bodyHistory.filter(Boolean).length >= DEEP_HITS ? "other_person"
          : streak.no_face >= THRESHOLD.no_face ? "no_face"
          : streak.camera_frozen >= THRESHOLD.camera_frozen ? "camera_frozen" : null;
        onStatus?.({ faces, brightness, anomaly, ready: !!faceapi || detectorFailed });
      }
    } catch { /* mesure suivante */ }
    tickNo++;
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, 800);
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

export const ANOMALY_LABEL: Record<CameraAnomaly, string> = {
  no_face: "aucun visage détecté",
  multiple_faces: "autre personne détectée",
  other_person: "autre personne (corps visible)",
  camera_covered: "caméra masquée ou image noire",
  camera_frozen: "image de la caméra figée",
};
