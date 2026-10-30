"use client";
/**
 * Briques partagées par la salle d'examen et la démo : caméra ouverte
 * automatiquement, état du plein écran, libellés et petites règles d'affichage.
 * Une seule implémentation, pour que la démo montre exactement le vrai parcours.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraStatus } from "@/lib/proctor/camera-monitor";

export const TYPE_HINT: Record<string, string> = {
  mcq_single: "Une seule réponse", mcq_multi: "Plusieurs réponses possibles", long_text: "Réponse rédigée",
  terminal: "Défi terminal", ordering: "Remettre dans l'ordre", matching: "Associer",
  hotspot: "Repérer dans le document", short_answer: "Réponse courte",
};

export const EVENT_LABEL: Record<string, string> = {
  multiple_faces: "plusieurs visages",
  camera_covered: "caméra masquée",
  camera_frozen: "image figée",
  other_person: "autre personne (corps visible)",
  fullscreen_exit: "sortie du plein écran",
  tab_hidden: "changement d'onglet",
  window_blur: "changement de fenêtre",
  multiple_screens: "écran secondaire détecté",
  devtools_open: "outils de développement ouverts",
  camera_off: "caméra coupée",
  print_attempt: "tentative d'impression",
};

export function isAnswered(a: any): boolean {
  if (!a) return false;
  return !!((a.selected && a.selected.length) || (a.text && a.text.trim()) || (a.flag && a.flag.trim())
    || (a.order && a.order.length) || (a.pairs && Object.keys(a.pairs).length));
}

/** Prêt à démarrer : un seul visage vu, ou détecteur indisponible mais image correcte. */
export function faceReady(live: boolean, cam: CameraStatus | null): boolean {
  return live && !!cam && !cam.anomaly
    && (cam.faces === 1 || (cam.ready && cam.faces === null && cam.brightness >= 18));
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${hh ? hh + ":" : ""}${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Navigateur capable d'imposer le plein écran (faux sur iPhone, par exemple). */
export function fullscreenSupported(): boolean {
  if (typeof document === "undefined") return true;
  return !!document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === "function";
}

export type CamState = "pending" | "live" | "denied";

/**
 * Caméra demandée dès l'affichage de la page. `attach` relie le flux à
 * l'élément <video> visible (la préparation puis l'en-tête de l'épreuve).
 */
export function useAutoCamera(onLost?: () => void) {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lostRef = useRef(onLost);
  lostRef.current = onLost;
  const [state, setState] = useState<CamState>("pending");

  const live = useCallback(() => !!streamRef.current?.getVideoTracks().some((t) => t.readyState === "live"), []);

  const attach = useCallback((v: HTMLVideoElement | null) => {
    videoRef.current = v;
    if (v && streamRef.current && v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current;
      v.play().catch(() => {});
    }
  }, []);

  const open = useCallback(async () => {
    if (live()) return true;
    setState("pending");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      stream.getVideoTracks().forEach((t) => t.addEventListener("ended", () => { setState("denied"); lostRef.current?.(); }));
      if (videoRef.current) attach(videoRef.current);
      setState("live");
      return true;
    } catch {
      setState("denied");
      return false;
    }
  }, [attach, live]);

  const stop = useCallback(() => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  useEffect(() => { open(); return () => streamRef.current?.getTracks().forEach((t) => t.stop()); }, [open]);

  return { state, open, stop, attach, streamRef, videoRef, live };
}

/** Alerte aux seuils de temps restant (une seule fois par seuil). */
export function useTimeAlerts(remaining: number, active: boolean, thresholds = [300, 60]) {
  const [alert, setAlert] = useState<string | null>(null);
  const fired = useRef(new Set<number>());
  useEffect(() => {
    if (!active) return;
    for (const t of thresholds) {
      if (remaining <= t && remaining > 0 && !fired.current.has(t)) {
        fired.current.add(t);
        setAlert(t >= 60 ? `Plus que ${Math.round(t / 60)} minute${t >= 120 ? "s" : ""}.` : `Plus que ${t} secondes.`);
      }
    }
  }, [remaining, active, thresholds]);
  return alert;
}
