"use client";
import { useEffect, useMemo, useState } from "react";
import { notify } from "@/components/Toaster";
import { createClient } from "@/lib/supabase/client";
import { LEVELS } from "@/lib/admin/bank";
import { TYPE_LABEL, validateQuestion } from "@/lib/questions/kinds";
import { StudentView } from "@/components/admin/StudentPreview";
import { Field, inputCls } from "@/components/admin/form";

export type EditTarget = {
  source: "exam" | "bank"; id: string; type: string; prompt: string; options: any; correct: any; points: number;
  domain: string | null; explanation: string | null; difficulty?: string | null; level?: string; image_url?: string | null;
  terminal?: any; external?: any; locked?: boolean; examTitle?: string;
};
type Version = { id: number; snapshot: any; changed_at: string };
type Copy = { id: string; test_id: string; title: string; started: boolean };

const LETTERS = "ABCDEFGHIJ";
const pretty = (v: any) => (v == null ? "" : JSON.stringify(v, null, 2));
const when = (d: string) => new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/**
 * Éditeur de question plein écran : formulaire à gauche, « vue étudiant » en direct à droite,
 * historique des versions, et correction répercutée dans les copies des épreuves non commencées.
 */
export default function QuestionEditor({ target, domains, onClose, onSaved }: { target: EditTarget; domains: string[]; onClose: () => void; onSaved: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [d, setD] = useState({ prompt: target.prompt, options: target.options, correct: target.correct, points: target.points, domain: target.domain || "",
    explanation: target.explanation || "", difficulty: target.difficulty || "", level: target.level || "Tous" });
  const [raw, setRaw] = useState({ options: pretty(target.options), correct: pretty(target.correct) });
  const [tab, setTab] = useState<"edit" | "history">("edit");
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const set = (patch: Partial<typeof d>) => { setD((x) => ({ ...x, ...patch })); setDirty(true); };
  const isMcq = target.type === "mcq_single" || target.type === "mcq_multi";
  const isShort = target.type === "short_answer";
  const frozen = !!target.locked;

  useEffect(() => {
    supabase.from("question_versions").select("id, snapshot, changed_at").eq("question_id", target.id).order("changed_at", { ascending: false }).limit(50)
      .then(({ data }) => setVersions((data as Version[]) || []));
    supabase.rpc("question_copies", { p_id: target.id }).then(({ data }) => setCopies(Array.isArray(data) ? data : []));
  }, [supabase, target.id]);

  const close = () => { if (!dirty || confirm("Fermer sans enregistrer vos modifications ?")) onClose(); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const opts: any[] = Array.isArray(d.options) ? d.options : [];
  const good = new Set((Array.isArray(d.correct) ? d.correct : []).map(String));
  const setOpt = (i: number, text: string) => set({ options: opts.map((o, k) => (k === i ? { ...o, text } : o)) });
  const toggleGood = (id: string) => {
    if (target.type === "mcq_single") return set({ correct: [id] });
    const n = new Set(good); n.has(id) ? n.delete(id) : n.add(id); set({ correct: [...n] });
  };
  const addOpt = () => { const id = String.fromCharCode(97 + opts.length) + Math.random().toString(36).slice(2, 5); set({ options: [...opts, { id, text: "" }] }); };
  const delOpt = (i: number) => set({ options: opts.filter((_, k) => k !== i), correct: [...good].filter((g) => g !== String(opts[i].id)) });

  const save = async () => {
    let options = d.options, correct = d.correct;
    if (!isMcq && !isShort) {
      try { options = raw.options.trim() ? JSON.parse(raw.options) : null; correct = raw.correct.trim() ? JSON.parse(raw.correct) : null; }
      catch { return notify("Le contenu ou le corrigé n'est pas un JSON valide."); }
    }
    if (!d.prompt.trim()) return notify("L'énoncé est vide.");
    if (!["long_text", "terminal", "external"].includes(target.type)) {
      const err = validateQuestion(target.type as any, options, correct);
      if (err) return notify(err);
    }
    setBusy(true);
    const common = { prompt: d.prompt, domain: d.domain.trim() || null, explanation: d.explanation.trim() || null, difficulty: d.difficulty || null };
    let error: any = null;
    if (target.source === "bank") {
      ({ error } = await supabase.from("question_bank").update({ ...common, options, correct, points: d.points, level: d.level, updated_at: new Date().toISOString() }).eq("id", target.id));
    } else {
      ({ error } = await supabase.from("questions").update(frozen ? common : { ...common, options, points: d.points }).eq("id", target.id));
      if (!error && correct != null && !["long_text", "terminal", "external"].includes(target.type))
        ({ error } = await supabase.from("answer_keys").upsert({ question_id: target.id, correct }));
    }
    setBusy(false);
    if (error) return notify(String(error.message).includes("questions_locked") ? "Des étudiants ont déjà composé : les réponses et les points sont figés." : error.message);
    setDirty(false);
    notify("Question enregistrée. L'ancienne version reste dans l'historique.", "ok");
    onSaved();
    const { data } = await supabase.from("question_versions").select("id, snapshot, changed_at").eq("question_id", target.id).order("changed_at", { ascending: false }).limit(50);
    setVersions((data as Version[]) || []);
  };

  const open = copies.filter((c) => !c.started);
  const propagate = async () => {
    if (dirty) return notify("Enregistrez d'abord la question.");
    if (!confirm(`Recopier cette version dans ${open.length} épreuve(s) non commencée(s) ?\n\n${open.map((c) => `• ${c.title}`).join("\n")}`)) return;
    const { data, error } = await supabase.rpc("propagate_question", { p_id: target.id, p_source: target.source });
    if (error) return notify(error.message);
    notify(`Correction répercutée dans ${data ?? 0} épreuve(s).`, "ok");
  };
  const restore = (v: Version) => {
    const s = v.snapshot || {};
    setD((x) => ({ ...x, prompt: s.prompt ?? x.prompt, options: s.options ?? x.options, correct: s.correct ?? x.correct, points: Number(s.points ?? x.points),
      domain: s.domain || "", explanation: s.explanation || "", difficulty: s.difficulty || "" }));
    setRaw({ options: pretty(s.options), correct: pretty(s.correct) });
    setDirty(true); setTab("edit");
    notify("Version rechargée dans l'éditeur. Enregistrez pour l'appliquer.", "info");
  };

  const preview = { type: target.type, prompt: d.prompt, points: d.points, image_url: target.image_url, options: isMcq || isShort ? d.options : (() => { try { return JSON.parse(raw.options); } catch { return target.options; } })(),
    terminal: target.terminal, external: target.external };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal aria-label="Éditeur de question">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-5 py-3">
        <button className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-fg/5 hover:text-fg" onClick={close}>‹ Fermer</button>
        <span className="rounded-md bg-navy/[0.07] px-2 py-0.5 text-xs font-semibold text-navy">{(TYPE_LABEL as any)[target.type] || target.type}</span>
        <span className="text-sm text-muted">{target.source === "bank" ? "Banque libre" : target.examTitle}</span>
        <div className="ml-4 flex gap-1 rounded-xl bg-fg/[0.06] p-1 text-sm">
          {([["edit", "Éditer"], ["history", `Historique${versions?.length ? ` (${versions.length})` : ""}`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1 ${tab === k ? "bg-surface font-semibold text-navy shadow-sm" : "text-fg/70"}`}>{l}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {open.length > 0 && <button className="btn-secondary" onClick={propagate} title="Recopie l'énoncé, les réponses, le corrigé et l'explication">Répercuter dans {open.length} épreuve(s)</button>}
          <button className="btn" disabled={busy || !dirty} onClick={save}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <div className="min-h-0 overflow-y-auto border-r border-line bg-surface px-6 py-6">
          {tab === "edit" ? (
            <div className="mx-auto max-w-2xl space-y-5">
              {frozen && <p className="rounded-xl bg-[#f08a3e]/[0.12] px-4 py-2.5 text-sm text-[#a64a12]">Des étudiants ont composé cette épreuve : l&apos;énoncé, le corrigé et l&apos;explication restent modifiables, pas les réponses proposées ni les points.</p>}
              <Field label="Énoncé"><textarea autoFocus className={`${inputCls} min-h-[150px] text-[15px]`} value={d.prompt} onChange={(e) => set({ prompt: e.target.value })} /></Field>

              {isMcq && (
                <Field label={target.type === "mcq_single" ? "Réponses (cochez la bonne)" : "Réponses (cochez les bonnes)"}>
                  <div className="space-y-2">
                    {opts.map((o, i) => {
                      const ok = good.has(String(o.id));
                      return (
                        <div key={o.id ?? i} className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${ok ? "border-[#2fa862]/60 bg-[#2fa862]/[0.08]" : "border-line"}`}>
                          <button type="button" onClick={() => toggleGood(String(o.id))} aria-pressed={ok} title={ok ? "Bonne réponse" : "Marquer comme bonne réponse"}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${ok ? "bg-[#2fa862] text-white" : "bg-fg/[0.07] text-fg/60 hover:bg-fg/[0.12]"}`}>{LETTERS[i] || i + 1}</button>
                          <input className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" disabled={frozen} value={o.text ?? ""} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Réponse ${LETTERS[i] || i + 1}`} />
                          {!frozen && opts.length > 2 && <button type="button" className="px-1 text-muted hover:text-[#b3361a]" onClick={() => delOpt(i)} aria-label="Retirer la réponse">×</button>}
                        </div>
                      );
                    })}
                    {!frozen && opts.length < 10 && <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={addOpt}>+ Ajouter une réponse</button>}
                  </div>
                </Field>
              )}
              {isShort && (
                <Field label="Réponses acceptées" hint="Une par ligne.">
                  <textarea className={`${inputCls} min-h-[90px] font-mono text-sm`} value={(d.correct?.answers || []).join("\n")}
                    onChange={(e) => set({ correct: { ...(d.correct || {}), answers: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean), case_sensitive: !!d.correct?.case_sensitive } })} />
                </Field>
              )}
              {!isMcq && !isShort && !["long_text", "terminal", "external"].includes(target.type) && (
                <>
                  <Field label="Contenu de la question (JSON)" hint="Format propre à ce type d'exercice."><textarea disabled={frozen} className={`${inputCls} min-h-[160px] font-mono text-xs`} value={raw.options} onChange={(e) => { setRaw((r) => ({ ...r, options: e.target.value })); setDirty(true); }} /></Field>
                  <Field label="Corrigé (JSON)"><textarea className={`${inputCls} min-h-[90px] font-mono text-xs`} value={raw.correct} onChange={(e) => { setRaw((r) => ({ ...r, correct: e.target.value })); setDirty(true); }} /></Field>
                </>
              )}
              {["terminal", "external"].includes(target.type) && <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Le scénario de cet exercice se modifie depuis l&apos;onglet « Questions » de l&apos;épreuve.</p>}

              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Domaine"><input className={inputCls} list="qe-domains" value={d.domain} onChange={(e) => set({ domain: e.target.value })} /><datalist id="qe-domains">{domains.map((x) => <option key={x} value={x} />)}</datalist></Field>
                <Field label="Difficulté">
                  <select className={inputCls} value={d.difficulty} onChange={(e) => set({ difficulty: e.target.value })}><option value="">Non classée</option><option value="facile">Facile</option><option value="moyen">Moyenne</option><option value="difficile">Difficile</option></select>
                </Field>
                <Field label="Points"><input className={inputCls} type="number" min={0} step={0.5} disabled={frozen} value={d.points} onChange={(e) => set({ points: Number(e.target.value) || 0 })} /></Field>
                {target.source === "bank" && <Field label="Niveau"><select className={inputCls} value={d.level} onChange={(e) => set({ level: e.target.value })}>{LEVELS.map((l) => <option key={l} value={l}>{l === "Tous" ? "Tous niveaux" : l}</option>)}</select></Field>}
              </div>
              <Field label="Explication de la bonne réponse" hint="Pour l'équipe et la correction, jamais montrée pendant l'épreuve.">
                <textarea className={`${inputCls} min-h-[90px]`} value={d.explanation} onChange={(e) => set({ explanation: e.target.value })} />
              </Field>
              {copies.length > 0 && (
                <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
                  <div className="font-medium">Cette question a été copiée dans {copies.length} épreuve(s)</div>
                  <ul className="mt-1.5 space-y-0.5 text-muted">{copies.map((c) => <li key={c.id}>{c.title} · {c.started ? "déjà commencée, non modifiée" : "pas commencée, peut recevoir la correction"}</li>)}</ul>
                </div>
              )}
              <p className="text-xs text-faint">Raccourcis : Cmd/Ctrl+S pour enregistrer, Échap pour fermer.</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl">
              {!versions?.length && <p className="py-10 text-center text-sm text-muted">{versions ? "Aucune modification enregistrée pour l'instant. Chaque enregistrement garde ici la version précédente." : "Chargement…"}</p>}
              <ol className="space-y-3">
                {(versions || []).map((v) => (
                  <li key={v.id} className="rounded-xl border border-line p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-navy">Version du {when(v.changed_at)}</span>
                      <button className="text-sm font-medium text-accent hover:underline" onClick={() => restore(v)}>Reprendre cette version</button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-fg/85">{String(v.snapshot?.prompt || "").slice(0, 400)}</p>
                    {Array.isArray(v.snapshot?.options) && (
                      <ul className="mt-2 space-y-0.5 text-sm text-muted">
                        {v.snapshot.options.map((o: any, i: number) => {
                          const ok = Array.isArray(v.snapshot.correct) && v.snapshot.correct.map(String).includes(String(o.id));
                          return <li key={i} className={ok ? "font-medium text-[#1f7a44]" : ""}>{LETTERS[i]}. {o.text}{ok ? " (bonne réponse)" : ""}</li>;
                        })}
                      </ul>
                    )}
                    <div className="mt-2 text-xs text-faint">{[v.snapshot?.domain, v.snapshot?.difficulty, v.snapshot?.points != null ? `${v.snapshot.points} pt(s)` : ""].filter(Boolean).join(" · ")}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <div className="hidden min-h-0 overflow-y-auto px-6 py-6 lg:block">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-full bg-[#5561c9]/[0.12] px-2.5 py-0.5 text-xs font-semibold text-navy">Vue étudiant</span>
            <span className="text-xs text-muted">Mise à jour en direct. Rien n&apos;est enregistré ici.</span>
          </div>
          <StudentView q={preview} />
        </div>
      </div>
    </div>
  );
}
