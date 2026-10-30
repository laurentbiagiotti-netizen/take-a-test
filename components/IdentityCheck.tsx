"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Vérification d'identité : photo de la pièce d'identité puis selfie, pris
 * en direct avec la webcam (pas d'import de fichier, pour éviter qu'un tiers
 * fournisse une photo préparée). Les images partent dans un espace privé
 * consultable uniquement par les surveillants.
 */
export default function IdentityCheck({ testId, title, rejected }: { testId: string; title: string; rejected: boolean }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<"intro" | "document" | "selfie" | "sending">("intro");
  const [docBlob, setDocBlob] = useState<Blob | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const openCamera = async () => {
    setErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      streamRef.current = s;
      setStep("document");
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); } }, 0);
    } catch {
      setErr("Autorisez l'accès à la caméra pour continuer.");
    }
  };

  const capture = async (): Promise<Blob | null> => {
    const v = videoRef.current; if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    return new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
  };

  const shoot = async () => {
    const b = await capture();
    if (!b) return setErr("Capture impossible, réessayez.");
    if (step === "document") { setDocBlob(b); setStep("selfie"); return; }
    setStep("sending");
    const fd = new FormData();
    fd.append("document", docBlob!, "document.jpg");
    fd.append("selfie", b, "selfie.jpg");
    const r = await fetch(`/api/exam/${testId}/identity`, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.message || "Envoi impossible."); setStep("document"); setDocBlob(null); return; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    router.refresh();
  };

  return (
    <main className="max-w-xl mx-auto p-10">
      <h1 className="h1">{title}</h1>
      <h2 className="h2 mt-4">Vérification d&apos;identité</h2>
      {rejected && <p className="text-danger text-sm mt-2">Votre précédente vérification a été refusée par le surveillant. Recommencez en suivant les consignes.</p>}
      {step === "intro" && (
        <div className="mt-3 text-muted text-sm space-y-2">
          <p>Avant l&apos;épreuve, nous avons besoin de deux photos prises avec votre webcam :</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>votre pièce d&apos;identité (carte d&apos;identité, passeport ou titre de séjour), bien lisible ;</li>
            <li>votre visage, de face, sans lunettes de soleil ni casquette.</li>
          </ol>
          <p>Ces images ne sont visibles que par les surveillants de l&apos;école et sont supprimées automatiquement à la fin de la durée de conservation.</p>
          <button className="btn mt-4" onClick={openCamera}>Ouvrir la caméra</button>
        </div>
      )}
      {(step === "document" || step === "selfie" || step === "sending") && (
        <div className="mt-4">
          <p className="text-sm text-fg mb-2">
            {step === "document" ? "Étape 1/2 : présentez votre pièce d'identité face à la caméra." : "Étape 2/2 : regardez la caméra, visage bien éclairé."}
          </p>
          <video ref={videoRef} className="w-full rounded bg-black" muted playsInline />
          <button className="btn mt-4" onClick={shoot} disabled={step === "sending"}>
            {step === "sending" ? "Envoi…" : "Prendre la photo"}
          </button>
        </div>
      )}
      {err && <p className="text-danger text-sm mt-3">{err}</p>}
    </main>
  );
}
