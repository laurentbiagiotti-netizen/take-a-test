"use client";
import { useState } from "react";
import { notify } from "@/components/Toaster";

export type BankQuestion = {
  type: "mcq_single" | "mcq_multi"; prompt: string; domain: string; points: number;
  options: { id: string; text: string }[]; correct: string[]; explanation: string | null;
  variant_group: string | null; variant: string | null;
};
type Level = { label: string; version: string; domains: string[]; questions: BankQuestion[] };
type Bank = Record<"b1" | "b3" | "mastere", Level>;

/** Banque des QCM d'admission de Dylan (B1, B3, Mastère), à ajouter à n'importe quelle épreuve, par thème. */
export default function DylanBank({ disabled, onAdd }: { disabled?: boolean; onAdd: (qs: BankQuestion[]) => void }) {
  const [bank, setBank] = useState<Bank | null>(null);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<keyof Bank>("b1");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [variants, setVariants] = useState(true);

  const load = async () => {
    if (open) { setOpen(false); return; }
    if (!bank) {
      try {
        const r = await fetch("/banque/qcm-dylan.json", { cache: "no-store" });
        const b = (await r.json()) as Bank;
        setBank(b); setPicked(new Set(b[level].domains));
      } catch { notify("Impossible de charger la banque de QCM."); return; }
    }
    setOpen(true);
  };

  const chooseLevel = (k: keyof Bank) => { setLevel(k); if (bank) setPicked(new Set(bank[k].domains)); };
  const lv = bank?.[level];
  const selection = (lv?.questions || []).filter((q) => picked.has(q.domain) && (variants || q.variant !== "B"));
  const asked = new Set(selection.map((q) => q.variant_group || q.prompt)).size;

  const add = () => {
    if (!selection.length) { notify("Cochez au moins un thème."); return; }
    const msg = variants
      ? `Ajouter ${asked} questions (${selection.length} avec leurs variantes : chaque candidat n'en reçoit qu'une par groupe) ?`
      : `Ajouter ${asked} questions ?`;
    if (!confirm(`${msg}\n\nComptez environ ${asked} minutes de plus : pensez à allonger la durée, puis à enregistrer.`)) return;
    onAdd(selection.map((q) => ({ ...q, variant_group: variants ? q.variant_group : null })));
    setOpen(false);
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-line-strong p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted mr-1">QCM d&apos;admission de Dylan :</span>
        <button className="btn-secondary !py-1.5" disabled={disabled} onClick={load} aria-expanded={open}>
          {open ? "Fermer" : "+ Choisir des QCM par niveau et par thème"}
        </button>
      </div>
      {open && lv && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Niveau">
            {(Object.keys(bank!) as (keyof Bank)[]).map((k) => (
              <button key={k} role="radio" aria-checked={level === k}
                className={`rounded-full border px-3 py-1 ${level === k ? "border-accent bg-accent/10 text-accent font-semibold" : "border-line"}`}
                onClick={() => chooseLevel(k)}>{bank![k].label} <span className="text-faint">({bank![k].version})</span></button>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {lv.domains.map((d) => {
              const n = lv.questions.filter((q) => q.domain === d && q.variant !== "B").length;
              return (
                <label key={d} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={picked.has(d)} onChange={(e) => setPicked((s) => { const x = new Set(s); if (e.target.checked) x.add(d); else x.delete(d); return x; })} />
                  {d} <span className="text-faint">· {n}</span>
                </label>
              );
            })}
          </div>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={variants} onChange={(e) => setVariants(e.target.checked)} />
            Avec les variantes jumelles (une question tirée au hasard par groupe, pour limiter la triche)
          </label>
          <div className="flex items-center gap-3">
            <button className="btn !py-1.5" onClick={add} disabled={!selection.length}>Ajouter {asked} questions</button>
            <span className="text-xs text-muted">1 point par question ; questions à plusieurs réponses : tout ou rien.</span>
          </div>
        </div>
      )}
    </div>
  );
}
