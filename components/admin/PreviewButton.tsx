"use client";
import { useState } from "react";
import { notify } from "@/components/Toaster";

/**
 * « Tester l'épreuve » : prépare un accès candidat d'aperçu (copie remise à
 * zéro, même non publiée) et donne le lien à ouvrir en navigation privée.
 */
export default function PreviewButton({ testId, className = "btn-secondary" }: { testId: string; className?: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    const r = await fetch(`/api/staff/tests/${testId}/preview`, { method: "POST", credentials: "same-origin" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok || !j.link) return notify(j.error || "Aperçu impossible.");
    setLink(j.link);
  };
  const copy = async () => { await navigator.clipboard.writeText(link!); notify("Lien copié"); };
  return (
    <>
      <button type="button" className={className} onClick={open} disabled={busy}>{busy ? "Préparation…" : "Tester l'épreuve"}</button>
      {link && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" role="dialog" aria-modal aria-label="Tester l'épreuve" onClick={() => setLink(null)}>
          <div className="card max-w-xl w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="h2">Tester l&apos;épreuve comme un candidat</h2>
            <p className="text-sm text-muted">
              Ouvrez ce lien dans une <b className="text-fg">fenêtre de navigation privée</b> (Cmd + Maj + N dans Chrome) :
              dans cette fenêtre-ci, il remplacerait votre session d&apos;administrateur.
            </p>
            <div className="flex gap-2">
              <input className="input font-mono text-xs" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn" onClick={copy}>Copier</button>
            </div>
            <ul className="text-xs text-muted list-disc pl-4 space-y-1">
              <li>Marche même si l&apos;épreuve n&apos;est pas publiée.</li>
              <li>Chaque clic sur « Tester l&apos;épreuve » efface votre copie d&apos;aperçu précédente et donne un nouveau lien.</li>
              <li>La copie apparaît dans les tentatives sous le nom « Aperçu », avec la note et la fiche PDF.</li>
            </ul>
            <div className="text-right"><button type="button" className="btn-secondary" onClick={() => setLink(null)}>Fermer</button></div>
          </div>
        </div>
      )}
    </>
  );
}
