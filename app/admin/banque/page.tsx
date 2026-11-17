"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { notify } from "@/components/Toaster";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_DOMAINS, LEVELS, draftToBank, fileToBank, normLevel, type BankRow } from "@/lib/admin/bank";
import { readExamFile, importReport, slug } from "@/components/admin/ExamFileTools";
import { loadDrafts } from "@/lib/admin/load-questions";
import { TYPE_LABEL } from "@/lib/questions/kinds";
import { toCsv } from "@/lib/excel/csv";

const norm = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const labelOf = (t: string) => (TYPE_LABEL as any)[t] || t;

function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Banque de questions : chaque question est classée par niveau (B1 à M2, ou commune)
 * et par domaine (Réseau, Web…). On l'alimente depuis un fichier ou depuis une épreuve,
 * puis on pioche dedans depuis l'éditeur d'une épreuve.
 */
export default function BankPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<BankRow[] | null>(null);
  const [level, setLevel] = useState("");
  const [domain, setDomain] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [importLevel, setImportLevel] = useState<string>("Tous");
  const file = useRef<HTMLInputElement>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [fromTest, setFromTest] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("question_bank").select("*").order("created_at", { ascending: false }).limit(10000);
    if (error) notify(error.message);
    setRows((data as BankRow[]) || []);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from("tests").select("id, title, formation, is_published").order("created_at", { ascending: false }).then(({ data }) => setTests(data || []));
  }, [supabase]);

  const domains = useMemo(() => Array.from(new Set([...(rows || []).map((r) => r.domain).filter(Boolean) as string[]])).sort(), [rows]);
  const allDomains = useMemo(() => Array.from(new Set([...DEFAULT_DOMAINS, ...domains])).sort(), [domains]);
  const types = useMemo(() => Array.from(new Set((rows || []).map((r) => r.type))).sort(), [rows]);
  const shown = (rows || []).filter((r) => (!level || r.level === level) && (!domain || (domain === "__none" ? !r.domain : r.domain === domain))
    && (!type || r.type === type) && (!q || norm(r.prompt).includes(norm(q)) || norm(r.explanation || "").includes(norm(q))));
  const allShown = shown.length > 0 && shown.every((r) => sel.has(r.id!));

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    (rows || []).forEach((r) => m.set(r.level, (m.get(r.level) || 0) + 1));
    return m;
  }, [rows]);

  const insert = async (list: BankRow[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    const seen = new Set((rows || []).map((r) => `${r.level}|${norm(r.prompt)}`));
    const fresh = list.filter((r) => !seen.has(`${r.level}|${norm(r.prompt)}`)).map((r) => ({ ...r, created_by: user?.id }));
    for (let i = 0; i < fresh.length; i += 200) {
      const { error } = await supabase.from("question_bank").insert(fresh.slice(i, i + 200));
      if (error) { notify(error.message); break; }
    }
    return { added: fresh.length, dup: list.length - fresh.length };
  };

  const importFile = async (f: File) => {
    setBusy(true);
    try {
      const x = await readExamFile(f);
      const r = await insert(x.questions.map((qq) => fileToBank(qq, importLevel, f.name.slice(0, 200))));
      const rep = importReport(x);
      notify(`${r.added} question(s) ajoutée(s) à la banque${r.dup ? `, ${r.dup} déjà présente(s)` : ""}.${rep ? ` ${rep}.` : ""}`, rep ? "info" : "ok");
      await load();
    } catch (e: any) { notify(`Import impossible : ${e?.message || "fichier illisible"}.`); }
    finally { setBusy(false); if (file.current) file.current.value = ""; }
  };

  const importTest = async () => {
    const t = tests.find((x) => x.id === fromTest);
    if (!t) return;
    setBusy(true);
    try {
      const drafts = await loadDrafts(supabase as any, t.id);
      const lvl = importLevel !== "Tous" ? importLevel : normLevel(t.formation);
      const r = await insert(drafts.map((d) => draftToBank(d, lvl, t.title)));
      notify(`${r.added} question(s) de « ${t.title} » ajoutée(s) en ${lvl}${r.dup ? `, ${r.dup} déjà présente(s)` : ""}.`, "ok");
      await load();
    } finally { setBusy(false); }
  };

  const patch = async (ids: string[], p: Partial<BankRow>) => {
    if (!ids.length) return;
    const { error } = await supabase.from("question_bank").update({ ...p, updated_at: new Date().toISOString() }).in("id", ids);
    if (error) return notify(error.message);
    setRows((rs) => (rs || []).map((r) => (ids.includes(r.id!) ? { ...r, ...p } : r)));
  };

  const remove = async (ids: string[]) => {
    if (!ids.length || !confirm(`Supprimer ${ids.length} question(s) de la banque ? Les épreuves qui les ont déjà reprises ne changent pas.`)) return;
    const { error } = await supabase.from("question_bank").delete().in("id", ids);
    if (error) return notify(error.message);
    setRows((rs) => (rs || []).filter((r) => !ids.includes(r.id!)));
    setSel(new Set());
  };

  const exportCsv = () => {
    const j = (v: any) => (v == null ? "" : JSON.stringify(v));
    const data = [["niveau", "domaine", "type", "enonce", "points", "explication", "temps_s", "options_json", "corrige_json", "terminal_json", "externe_json", "source"],
      ...shown.map((r) => [r.level, r.domain || "", r.type, r.prompt, r.points, r.explanation || "", r.time_limit_s || "", j(r.options), j(r.correct), j(r.terminal), j(r.external), r.source || ""])];
    download(`banque-${slug([level, domain].filter(Boolean).join("-") || "complete")}.csv`, toCsv(data), "text/csv;charset=utf-8");
  };

  const ids = [...sel];
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-fg">← Épreuves</Link>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-2">
        <div>
          <h1 className="h1">Banque de questions</h1>
          <p className="text-sm text-muted mt-1">Questions classées par niveau et par domaine, à piocher depuis l&apos;éditeur d&apos;une épreuve.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {LEVELS.map((l) => <span key={l} className="badge">{l === "Tous" ? "Communes" : l} : {counts.get(l) || 0}</span>)}
        </div>
      </div>

      <section className="card mt-6 space-y-3">
        <div className="font-medium">Alimenter la banque</div>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label>Niveau par défaut
            <select className="input mt-1" value={importLevel} onChange={(e) => setImportLevel(e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{l === "Tous" ? "Commun à tous" : l}</option>)}
            </select>
          </label>
          <button className="btn-secondary" disabled={busy} onClick={() => file.current?.click()}>Importer un fichier (.csv, .json)</button>
          <input ref={file} type="file" accept=".json,.csv,.tsv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <span className="text-muted">ou</span>
          <select className="input w-auto max-w-xs" value={fromTest} onChange={(e) => setFromTest(e.target.value)} aria-label="Épreuve source">
            <option value="">Reprendre les questions d&apos;une épreuve…</option>
            {tests.map((t) => <option key={t.id} value={t.id}>{t.is_published ? "" : "[brouillon] "}{t.title}</option>)}
          </select>
          <button className="btn-secondary" disabled={busy || !fromTest} onClick={importTest}>Ajouter à la banque</button>
        </div>
        <p className="text-xs text-muted">Une colonne « Niveau » dans le CSV prime sur le niveau par défaut. Pour une épreuve, le niveau vient de sa promo si vous laissez « Commun à tous ». Les doublons (même énoncé, même niveau) sont ignorés.</p>
      </section>

      <section className="mt-6 grid sm:grid-cols-4 gap-2">
        <select className="input" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Niveau">
          <option value="">Tous les niveaux</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l === "Tous" ? "Communes" : l}</option>)}
        </select>
        <select className="input" value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Domaine">
          <option value="">Tous les domaines</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          <option value="__none">Sans domaine</option>
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">Tous les types</option>
          {types.map((t) => <option key={t} value={t}>{labelOf(t)}</option>)}
        </select>
        <input className="input" placeholder="Rechercher dans les énoncés" value={q} onChange={(e) => setQ(e.target.value)} />
      </section>

      <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
        <span className="text-muted mr-auto">{rows ? `${shown.length} question(s)` : "Chargement…"}{sel.size ? ` · ${sel.size} cochée(s)` : ""}</span>
        {sel.size > 0 && <>
          <select className="input w-auto !py-1" value="" onChange={(e) => e.target.value && patch(ids, { level: e.target.value })} aria-label="Changer le niveau">
            <option value="">Niveau…</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="input w-auto !py-1" value="" onChange={(e) => e.target.value && patch(ids, { domain: e.target.value === "__none" ? null : e.target.value })} aria-label="Changer le domaine">
            <option value="">Domaine…</option>
            {allDomains.map((d) => <option key={d} value={d}>{d}</option>)}
            <option value="__none">Sans domaine</option>
          </select>
          <button className="btn-secondary !py-1 text-danger" onClick={() => remove(ids)}>Supprimer</button>
        </>}
        <button className="btn-secondary !py-1" disabled={!shown.length} onClick={() => setSel((s) => { const n = new Set(s); shown.forEach((r) => (allShown ? n.delete(r.id!) : n.add(r.id!))); return n; })}>{allShown ? "Tout décocher" : "Tout cocher"}</button>
        <button className="btn-secondary !py-1" disabled={!shown.length} onClick={exportCsv}>Exporter (.csv)</button>
      </div>

      <datalist id="bank-domains">{allDomains.map((d) => <option key={d} value={d} />)}</datalist>
      <div className="mt-3 border border-line rounded-lg divide-y divide-line bg-surface">
        {rows && !rows.length && <p className="p-6 text-sm text-muted">La banque est vide : importez un fichier ou reprenez les questions d&apos;une épreuve.</p>}
        {shown.slice(0, 1000).map((r) => (
          <div key={r.id} className="flex items-start gap-3 p-3">
            <input type="checkbox" className="mt-1.5" checked={sel.has(r.id!)} aria-label="Cocher"
              onChange={() => setSel((s) => { const n = new Set(s); n.has(r.id!) ? n.delete(r.id!) : n.add(r.id!); return n; })} />
            <div className="min-w-0 flex-1">
              <p className="text-sm whitespace-pre-wrap line-clamp-3">{r.prompt}</p>
              <p className="text-xs text-muted mt-1">{labelOf(r.type)} · {r.points} pt{r.points > 1 ? "s" : ""}{r.source ? ` · ${r.source}` : ""}</p>
            </div>
            <select className="input w-24 !py-1 text-sm" value={r.level} onChange={(e) => patch([r.id!], { level: e.target.value })} aria-label="Niveau">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input className="input w-44 !py-1 text-sm" list="bank-domains" defaultValue={r.domain || ""} placeholder="Domaine" aria-label="Domaine"
              onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== r.domain) patch([r.id!], { domain: v }); }} />
          </div>
        ))}
        {shown.length > 1000 && <p className="p-3 text-xs text-muted">1000 premières questions affichées : affinez les filtres.</p>}
      </div>
    </main>
  );
}
