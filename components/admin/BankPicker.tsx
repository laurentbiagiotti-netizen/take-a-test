"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notify } from "@/components/Toaster";
import { createClient } from "@/lib/supabase/client";
import { LEVELS, bankToDraft, type BankRow } from "@/lib/admin/bank";
import { TYPE_LABEL } from "@/lib/questions/kinds";

const norm = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Piocher dans la banque de questions (filtres niveau, domaine, type) depuis l'éditeur d'une épreuve. */
export default function BankPicker({ locked, existing, defaultLevel, onImport }: {
  locked: boolean; existing: string[]; defaultLevel?: string; onImport: (q: any[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BankRow[] | null>(null);
  const [level, setLevel] = useState(defaultLevel || "");
  const [domain, setDomain] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const have = useMemo(() => new Set(existing.map(norm)), [existing]);

  useEffect(() => {
    if (!open || rows) return;
    supabase.from("question_bank").select("*").order("created_at", { ascending: false }).limit(5000)
      .then(({ data, error }) => { if (error) notify(error.message); setRows((data as BankRow[]) || []); });
  }, [open, rows, supabase]);

  const domains = useMemo(() => Array.from(new Set((rows || []).map((r) => r.domain).filter(Boolean))).sort() as string[], [rows]);
  const types = useMemo(() => Array.from(new Set((rows || []).map((r) => r.type))).sort(), [rows]);
  const shown = (rows || []).filter((r) =>
    (!level || r.level === level || (level !== "Tous" && r.level === "Tous")) && (!domain || r.domain === domain) && (!type || r.type === type)
    && (!q || norm(r.prompt).includes(norm(q))));
  const allShown = shown.length > 0 && shown.every((r) => sel.has(r.id!));

  const add = () => {
    const picked = (rows || []).filter((r) => sel.has(r.id!)).map((r) => ({ ...bankToDraft(r), origin_id: r.id, difficulty: (r as any).difficulty ?? null }) as any);
    if (!picked.length) return;
    onImport(picked);
    notify(`${picked.length} question(s) ajoutée(s) depuis la banque. Pensez à enregistrer.`, "ok");
    setOpen(false); setSel(new Set());
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 text-sm rounded-lg border border-line bg-surface/60 p-3">
        <span className="text-xs text-muted mr-1">Banque de questions, par niveau et par domaine :</span>
        <Link href="/admin/banque" className="text-xs underline text-muted hover:text-fg">gérer la banque</Link>
        <button className="btn !py-1.5 !px-3 ml-auto" disabled={locked} onClick={() => setOpen(true)}
          title={locked ? "Des candidats ont déjà composé : questions verrouillées" : undefined}>Piocher dans la banque</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Piocher dans la banque" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-4xl max-h-[88vh] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="h2">Piocher dans la banque</h2>
              <button className="text-sm text-muted hover:text-fg" onClick={() => setOpen(false)}>Fermer</button>
            </div>
            <div className="grid sm:grid-cols-4 gap-2">
              <select className="input" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Niveau">
                <option value="">Tous les niveaux</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l === "Tous" ? "Communes à tous" : l}</option>)}
              </select>
              <select className="input" value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Domaine">
                <option value="">Tous les domaines</option>
                {domains.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
                <option value="">Tous les types</option>
                {types.map((t) => <option key={t} value={t}>{(TYPE_LABEL as any)[t] || t}</option>)}
              </select>
              <input className="input" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{rows ? `${shown.length} question(s)` : "Chargement…"}</span>
              <button className="btn-secondary !py-1" disabled={!shown.length} onClick={() => setSel((s) => {
                const n = new Set(s); shown.forEach((r) => (allShown ? n.delete(r.id!) : n.add(r.id!))); return n;
              })}>{allShown ? "Tout décocher" : "Tout cocher"}</button>
            </div>
            <div className="overflow-y-auto border border-line rounded-md divide-y divide-line min-h-[10rem]">
              {rows && !rows.length && <p className="p-4 text-sm text-muted">La banque est vide. <Link href="/admin/banque" className="underline">Ajoutez des questions</Link>.</p>}
              {shown.map((r) => (
                <label key={r.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-surface-2">
                  <input type="checkbox" className="mt-1" checked={sel.has(r.id!)} onChange={() => setSel((s) => { const n = new Set(s); n.has(r.id!) ? n.delete(r.id!) : n.add(r.id!); return n; })} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm line-clamp-2">{r.prompt}</span>
                    <span className="block text-xs text-muted mt-0.5">
                      <span className="badge !py-0 mr-1">{r.level}</span>{r.domain || "sans domaine"} · {(TYPE_LABEL as any)[r.type] || r.type} · {r.points} pt{r.points > 1 ? "s" : ""}
                      {have.has(norm(r.prompt)) && <span className="text-warn"> · déjà dans l&apos;épreuve</span>}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">{sel.size} cochée(s)</span>
              <button className="btn" disabled={!sel.size} onClick={add}>Ajouter à l&apos;épreuve</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
