"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Step = "checking" | "invalid" | "ready" | "camera" | "recording" | "recorded" | "sending" | "done";
const MIN_S = 15, MAX_S = 60;

function pickType(): string {
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  if (typeof MediaRecorder === "undefined") return "";
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

/**
 * Scan de la pièce au téléphone, ouvert par le QR code affiché pendant la pause.
 * Pas de compte : le jeton (dans le fragment #t=…) donne accès à ce seul envoi.
 */
export default function ScanPage() {
  const [step, setStep] = useState<Step>("checking");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const token = useRef("");
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blob = useRef<Blob | null>(null);
  const started = useRef(0);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const m = window.location.hash.match(/t=([0-9a-f]{64})/);
    if (!m) { setStep("invalid"); return; }
    token.current = m[1];
    history.replaceState(null, "", window.location.pathname);
    fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: m[1] }) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok) { setTitle(j.title || ""); setStep("ready"); } else { setError(j.message || null); setStep("invalid"); }
      })
      .catch(() => { setError("Pas de connexion internet sur le téléphone."); setStep("invalid"); });
    return () => stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const openCamera = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } },
        audio: false,
      });
      stream.current = s;
      setStep("camera");
      requestAnimationFrame(() => { if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } });
    } catch {
      setError("Caméra refusée. Autorisez-la dans les réglages du navigateur, puis réessayez.");
    }
  };

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const record = () => {
    const s = stream.current; if (!s) return;
    const type = pickType();
    if (!type) { setError("Ce navigateur ne sait pas filmer. Essayez Safari (iPhone) ou Chrome (Android)."); return; }
    chunks.current = [];
    const r = new MediaRecorder(s, { mimeType: type, videoBitsPerSecond: 1_200_000 });
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = () => {
      blob.current = new Blob(chunks.current, { type: type.split(";")[0] });
      setStep("recorded");
    };
    recorder.current = r;
    started.current = Date.now();
    r.start(1000);
    setSeconds(0);
    setStep("recording");
  };

  useEffect(() => {
    if (step !== "recording") return;
    const i = setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= MAX_S) stop();
    }, 250);
    return () => clearInterval(i);
  }, [step, stop]);

  const send = () => {
    const b = blob.current; if (!b) return;
    setStep("sending"); setProgress(0); setError(null);
    const fd = new FormData();
    fd.append("token", token.current);
    fd.append("seconds", String(seconds));
    fd.append("video", b, b.type.includes("mp4") ? "scan.mp4" : "scan.webm");
    const x = new XMLHttpRequest();
    x.open("POST", "/api/scan");
    x.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => {
      let j: any = {}; try { j = JSON.parse(x.responseText); } catch {}
      if (x.status >= 200 && x.status < 300) { stream.current?.getTracks().forEach((t) => t.stop()); setStep("done"); }
      else { setError(j.message || "Envoi impossible, réessayez."); setStep(x.status === 410 ? "invalid" : "recorded"); }
    };
    x.onerror = () => { setError("Connexion perdue pendant l'envoi, réessayez."); setStep("recorded"); };
    x.send(fd);
  };

  const live = step === "camera" || step === "recording";
  return (
    <main className="min-h-screen max-w-lg mx-auto p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <img src="/cybersup-logo-blanc.svg" alt="Cybersup" className="h-5 w-auto" />
        <span className="text-faint">|</span>
        <span className="text-sm text-muted truncate">{title || "Scan de la pièce"}</span>
      </div>

      {step === "checking" && <p className="text-muted">Vérification du lien…</p>}
      {step === "invalid" && (
        <div className="card">
          <h1 className="h1">Lien non valable</h1>
          <p className="text-muted mt-2">{error || "Ce lien a expiré ou a déjà servi."} Sur l&apos;ordinateur, touchez « Nouveau QR code » puis scannez-le à nouveau.</p>
        </div>
      )}
      {step === "done" && (
        <div className="card border-ok/50">
          <h1 className="h1 text-ok">Vidéo envoyée</h1>
          <p className="text-muted mt-2">Merci. L&apos;épreuve reprend sur l&apos;ordinateur dans quelques secondes. Reposez le téléphone hors du champ de la caméra, écran vers le bas.</p>
        </div>
      )}

      {(step === "ready" || live || step === "recorded" || step === "sending") && <>
        <div>
          <h1 className="h1">Filmez la pièce à 360°</h1>
          <ol className="list-decimal pl-5 mt-3 space-y-1 text-sm text-muted">
            <li>Tenez le téléphone à hauteur de poitrine, caméra arrière.</li>
            <li>Tournez lentement sur vous-même : tous les murs, la porte, le sol.</li>
            <li>Montrez le bureau, le dessous du bureau, puis l&apos;écran et le clavier de l&apos;ordinateur.</li>
          </ol>
          <p className="text-xs text-faint mt-2">Entre {MIN_S} et {MAX_S} secondes. Pas de son enregistré.</p>
        </div>

        <div className="relative rounded-lg overflow-hidden bg-surface-2 aspect-[3/4] max-h-[55vh] mx-auto w-full">
          <video ref={video} playsInline muted className={`w-full h-full object-cover ${live ? "" : "hidden"}`} />
          {!live && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted p-6 text-center">
            {step === "ready" ? "La caméra s'ouvrira ici." : step === "sending" ? `Envoi… ${progress} %` : `Vidéo prête (${seconds} s).`}
          </div>}
          {step === "recording" && (
            <div className="absolute top-3 left-3 px-2 py-1 rounded bg-danger text-white text-xs font-semibold" role="timer">
              ● {seconds} s / {MAX_S} s
            </div>
          )}
        </div>

        {error && <p className="text-danger text-sm" role="alert">{error}</p>}
        {step === "ready" && <button className="btn justify-center py-3" onClick={openCamera}>Ouvrir la caméra</button>}
        {step === "camera" && <button className="btn justify-center py-3" onClick={record}>Commencer à filmer</button>}
        {step === "recording" && (
          <button className="btn justify-center py-3" onClick={stop} disabled={seconds < MIN_S}>
            {seconds < MIN_S ? `Continuez encore ${MIN_S - seconds} s…` : "Arrêter"}
          </button>
        )}
        {step === "recorded" && <>
          <button className="btn justify-center py-3" onClick={send}>Envoyer la vidéo</button>
          <button className="btn-secondary justify-center" onClick={() => { blob.current = null; setStep(stream.current ? "camera" : "ready"); if (stream.current && video.current) { video.current.srcObject = stream.current; video.current.play().catch(() => {}); } }}>Recommencer</button>
        </>}
        {step === "sending" && <div className="h-2 rounded-full bg-surface-2 overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} /></div>}
      </>}
    </main>
  );
}
