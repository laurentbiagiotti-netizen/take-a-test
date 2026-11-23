"use client";
import { useState } from "react";
import QuestionBody, { type PublicQ } from "@/components/questions/QuestionBody";
import QuestionPrompt from "@/components/questions/QuestionPrompt";

const WIDE = ["external", "sim", "feed", "headers", "sql", "tickets", "bash", "adsim", "evtx", "decode", "blocks", "terminal"];

/** La question telle que l'étudiant la voit (réponses non enregistrées). */
export function StudentView({ q }: { q: any }) {
  const [value, setValue] = useState<any>(null);
  const pub: PublicQ = {
    id: "apercu", type: q.type, prompt: q.prompt || "", points: q.points, image_url: q.image_url, options: q.options,
    terminal: null,
    external: q.type === "external" ? { tool: q.external?.tool, label: q.external?.label || null, time_limit_s: null } as any : null,
  };

  return (
    <div className={`mx-auto ${WIDE.includes(q.type) ? "max-w-6xl" : "max-w-3xl"}`}>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Question 1 sur 1</span><span>{q.points} point{q.points > 1 ? "s" : ""}</span>
      </div>
      <div className="mt-3 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        {pub.prompt ? <QuestionPrompt prompt={pub.prompt} className="text-lg font-medium" /> : <p className="italic text-faint">Énoncé à écrire</p>}
        {pub.image_url && <img src={pub.image_url} alt="" className="mt-4 max-h-72 rounded-lg border border-line" />}
        <div className="mt-5">
          {q.type === "terminal"
            ? <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Le terminal simulé tourne côté serveur : essayez-le avec « Aperçu » en haut de l&apos;épreuve, qui ouvre une copie d&apos;essai.</p>
            : <QuestionBody q={pub} value={value} onChange={setValue} onText={setValue} />}
        </div>
      </div>
    </div>
  );
}

/**
 * Aperçu « vue étudiant » d'une question, dans le cadre de la salle d'examen.
 * Rien n'est enregistré ; le terminal tourne sur le moteur local.
 */
export default function StudentPreview({ q, onClose }: { q: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-navy/50 backdrop-blur-[2px]" role="dialog" aria-modal aria-label="Aperçu étudiant" onClick={onClose}>
      <div className="m-auto flex max-h-[92vh] w-[min(1100px,96vw)] flex-col overflow-hidden rounded-2xl bg-bg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
          <span className="rounded-full bg-[#5561c9]/[0.12] px-2.5 py-0.5 text-xs font-semibold text-navy">Vue étudiant</span>
          <span className="text-sm text-muted">Aperçu sans enregistrement : vos réponses ici ne comptent pas.</span>
          <button className="ml-auto rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-fg/5 hover:text-fg" onClick={onClose}>Fermer</button>
        </div>
        <div className="overflow-y-auto px-6 py-8"><StudentView q={q} /></div>
      </div>
    </div>
  );
}
