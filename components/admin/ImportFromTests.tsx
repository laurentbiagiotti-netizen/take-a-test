"use client";
import { useEffect, useMemo, useState } from "react";
import { notify } from "@/components/Toaster";
import { createClient } from "@/lib/supabase/client";
import { loadDrafts } from "@/lib/admin/load-questions";
import { TYPE_LABEL } from "@/lib/questions/kinds";

const norm = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Reprendre des questions d'une autre épreuve (brouillon ou publiée) :
 * on choisit l'épreuve, on coche les questions, elles sont ajoutées à
 * l'épreuve en cours avec leurs corrigés et scénarios. L'original n'est pas modifié.
 */
export default function ImportFromTests({ currentId, locked, existing, onImport }: {
  currentId: string; locked: boolean; existing: string[]; onImport: (q: any[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [tests, setTests] = useState<any[]>([]);
  const [testId, setTestId] = useState("");
  const [qs, setQs] = useState<any[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const have = useMemo(() => new Set(existing.map(norm)), [existing]);

  useEffect(() => {
    if (!open || tests.length) return;
    supabase.from("tests").select("id, title, is_published, formation, created_at").neq("id", currentId)
      .order("created_at", { ascending: false }).then(({ data }) => setTests(data || []));
  }, [open, tests.length, supabase, currentId]);

  const pick = async (id: string) => {
    setTestId(id); setSel(new Set()); setQs([]); setFilter("");
    if (!id) return;
    setLoading(true);
    try { setQs(await loadDrafts(supabase as any, id)); }
    catch { notify("Impossible de lire les questions de cette épreuve."); }
    finally { setLoading(false); }
  };

  const shown = qs.map((q, i) => ({ q, i })).filter(({ q }) => {
    const f = norm(filter);
    return !f || norm(q.prompt).includes(f) || norm(q.domain || "").includes(f) || norm((TYPE_LABEL as any)[q.type] || q.type).includes(f);
  });
  const toggle = (i: number) => setSel((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const allShown = shown.length > 0 && shown.every(({ i }) => sel.has(i));

  const add = () => {
    const picked = [...sel].sort((a, b) => a - b).map((i) => {
      const { id: _id, test_id: _t, position: _p, created_at: _c, ...rest } = qs[i];
      return rest;
    });
    if (!picked.length) return;
    onImport(picked);
    notify(`${picked.length} question(s) ajoutée(s). Pensez à enregistrer.`, "ok");
    setOpen(false); setSel(new Set());
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 text-sm rounded-lg border border-line bg-surface/60 p-3">
        <span className="text-xs text-muted mr-1">Reprendre des questions d&apos;une autre épreuve ou d&apos;un brouillon :</span>
        <button className="btn !py-1.5 !px-3 ml-auto" disabled={locked} onClick={() => setOpen(true)}
          title={locked ? "Des candidats ont déjà composé : questions verrouillées" : undefined}>Choisir des questions</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Reprendre des questions" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-3xl max-h-[85vh] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="h2">Reprendre des questions</h2>
              <button className="text-sm text-muted hover:text-fg" onClick={() => setOpen(false)}>Fermer</button>
            </div>
            <select className="input" value={testId} onChange={(e) => pick(e.target.value)} aria-label="Épreuve source">
              <option value="">Choisir l&apos;épreuve source…</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.is_published ? "" : "[brouillon] "}{t.title}{t.formation ? ` · ${t.formation}` : ""}
                </option>
              ))}
            </select>

            {testId && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <input className="input flex-1 min-w-[12rem]" placeholder="Filtrer par mot, domaine ou type" value={filter} onChange={(e) => setFilter(e.target.value)} />
                  <button className="btn-secondary !py-1.5" disabled={!shown.length} onClick={() => setSel((s) => {
                    const n = new Set(s); shown.forEach(({ i }) => (allShown ? n.delete(i) : n.add(i))); return n;
                  })}>{allShown ? "Tout décocher" : "Tout cocher"}</button>
                </div>
                <div className="overflow-y-auto border border-line rounded-md divide-y divide-line min-h-[8rem]">
                  {loading && <p className="p-4 text-sm text-muted">Chargement…</p>}
                  {!loading && !qs.length && <p className="p-4 text-sm text-muted">Cette épreuve n&apos;a pas de question.</p>}
                  {shown.map(({ q, i }) => {
                    const dup = have.has(norm(q.prompt));
                    return (
                      <label key={i} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-surface-2">
                        <input type="checkbox" className="mt-1" checked={sel.has(i)} onChange={() => toggle(i)} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm line-clamp-2">{q.prompt}</span>
                          <span className="block text-xs text-muted mt-0.5">
                            {(TYPE_LABEL as any)[q.type] || q.type} · {q.points} pt{q.points > 1 ? "s" : ""}{q.domain ? ` · ${q.domain}` : ""}
                            {dup && <span className="text-warn"> · déjà dans l&apos;épreuve</span>}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-sm text-muted">{sel.size} question(s) cochée(s)</span>
              <button className="btn" disabled={!sel.size} onClick={add}>Ajouter à l&apos;épreuve</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
