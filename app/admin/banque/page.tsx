"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { notify } from "@/components/Toaster";
import { createClient } from "@/lib/supabase/client";
import { LEVELS, bankToDraft, draftToBank, fileToBank, normLevel, type BankRow } from "@/lib/admin/bank";
import { readExamFile, importReport } from "@/components/admin/ExamFileTools";
import { TYPE_LABEL } from "@/lib/questions/kinds";
import { PageTitle } from "@/components/admin/ui";
import QuestionEditor, { type EditTarget } from "@/components/admin/QuestionEditor";

type Item = {
  key: string; source: "exam" | "bank"; id: string; test_id?: string; level: string; promo: string | null;
  type: string; prompt: string; options: any; correct: any; points: number; domain: string | null; explanation: string | null;
  terminal?: any; external?: any; rate: number | null; position: number; bank?: BankRow;
  difficulty?: string | null; image_url?: string | null; disc?: number | null; n?: number; alerte?: string | null; unused?: string[];
};
type Exam = { id: string; title: string; formation: string | null; opens_at: string | null; created_at: string; locked: boolean };

const norm = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LETTERS = "ABCDEFGHIJ";
const labelOf = (t: string) => (TYPE_LABEL as any)[t] || t;
const day = (d?: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" }) : "";
const optText = (o: any) => (typeof o === "string" ? o : o?.text ?? "");
const optId = (o: any, i: number) => (typeof o === "object" && o?.id != null ? String(o.id) : String(i));

/**
 * Banque de questions : toutes les questions des examens, rangées par examen, avec la bonne
 * réponse, l'explication et le taux de réussite ; plus la banque libre (hors examen).
 */
export default function BankPage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Item[] | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { const v = new URLSearchParams(window.location.search).get("q"); if (v) setQ(v); }, []);
  const [promo, setPromo] = useState("");
  const [exam, setExam] = useState("");
  const [domain, setDomain] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<"exam" | "rate" | "domain">("exam");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [copyFor, setCopyFor] = useState<Item | null>(null);
  const [panel, setPanel] = useState(false);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [flag, setFlag] = useState("");

  const load = useCallback(async () => {
    const [{ data: tests }, { data: qs }, { data: bank }, { data: prev }, { data: atts }] = await Promise.all([
      supabase.from("tests").select("id, title, formation, opens_at, created_at").order("created_at", { ascending: false }),
      supabase.from("questions").select("*").order("position"),
      supabase.from("question_bank").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("invites").select("test_id, email").eq("preview", true),
      supabase.from("attempts").select("test_id, candidate:profiles(email)").neq("status", "pending"),
    ]);
    const ids = (qs || []).map((x: any) => x.id);
    const empty = { data: [] as any[] };
    const [{ data: keys }, { data: terms }, { data: exts }] = ids.length ? await Promise.all([
      supabase.from("answer_keys").select("question_id, correct").in("question_id", ids),
      supabase.from("question_terminals").select("question_id, scenario, flag").in("question_id", ids),
      supabase.from("question_externals").select("question_id, tool, label, time_limit_s, scenario, answer_key").in("question_id", ids),
    ]) : [empty, empty, empty];
    const withQ = new Set((qs || []).map((x: any) => x.test_id));
    const [stats, picks] = await Promise.all([
      Promise.all((tests || []).filter((t: any) => withQ.has(t.id)).map((t: any) => supabase.rpc("item_stats", { p_test: t.id }).then((r) => (Array.isArray(r.data?.questions) ? r.data.questions : [])))),
      Promise.all((tests || []).filter((t: any) => withQ.has(t.id)).map((t: any) => supabase.rpc("option_stats", { p_test: t.id }).then((r) => (r.data || {}) as Record<string, Record<string, number>>))),
    ]);
    const rate = new Map<string, number>(); const st = new Map<string, any>();
    stats.flat().forEach((s: any) => { if (!s?.id) return; st.set(s.id, s); if (s.n > 0 && s.reussite != null) rate.set(s.id, Number(s.reussite)); });
    const chosen: Record<string, Record<string, number>> = Object.assign({}, ...picks);
    const k = new Map((keys || []).map((x: any) => [x.question_id, x.correct]));
    const tm = new Map((terms || []).map((x: any) => [x.question_id, { scenario: x.scenario, flag: x.flag }]));
    const xm = new Map((exts || []).map(({ question_id, ...x }: any) => [question_id, x]));
    const pv = new Set((prev || []).map((p: any) => `${p.test_id}|${p.email}`));
    const lockedSet = new Set((atts || []).filter((a: any) => !pv.has(`${a.test_id}|${a.candidate?.email}`)).map((a: any) => a.test_id));
    const tmap = new Map((tests || []).map((t: any) => [t.id, t]));
    setExams((tests || []).map((t: any) => ({ ...t, locked: lockedSet.has(t.id) })));
    setItems([
      ...(qs || []).map((x: any) => {
        const t: any = tmap.get(x.test_id) || {};
        return { key: `q-${x.id}`, source: "exam" as const, id: x.id, test_id: x.test_id, level: normLevel(t.formation), promo: t.formation || null,
          type: x.type, prompt: x.prompt, options: x.options, correct: k.get(x.id) ?? null, points: Number(x.points), domain: x.domain,
          explanation: x.explanation, terminal: tm.get(x.id) ?? null, external: xm.get(x.id) ?? null, rate: rate.get(x.id) ?? null, position: x.position,
          difficulty: x.difficulty, image_url: x.image_url, n: st.get(x.id)?.n ?? 0, disc: st.get(x.id)?.n >= 10 ? Number(st.get(x.id)?.discrimination) : null, alerte: st.get(x.id)?.alerte ?? null,
          unused: (x.type === "mcq_single" || x.type === "mcq_multi") && Array.isArray(x.options) && (st.get(x.id)?.n ?? 0) >= 10
            ? x.options.filter((o: any) => !(chosen[x.id]?.[String(o.id)] > 0) && !(Array.isArray(k.get(x.id)) && (k.get(x.id) as any[]).map(String).includes(String(o.id)))).map((o: any) => String(o.id)) : [] };
      }),
      ...((bank as BankRow[]) || []).map((b) => ({ key: `b-${b.id}`, source: "bank" as const, id: b.id!, level: b.level, promo: null,
        type: b.type, prompt: b.prompt, options: b.options, correct: b.correct, points: Number(b.points), domain: b.domain, explanation: b.explanation,
        terminal: b.terminal, external: b.external, rate: null, position: 0, bank: b, difficulty: (b as any).difficulty, image_url: b.image_url })),
    ]);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  const examMap = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);
  const promos = useMemo(() => Array.from(new Set(exams.map((e) => e.formation).filter(Boolean))).sort() as string[], [exams]);
  const domains = useMemo(() => Array.from(new Set((items || []).map((i) => i.domain).filter(Boolean))).sort() as string[], [items]);
  const types = useMemo(() => Array.from(new Set((items || []).map((i) => i.type))).sort(), [items]);
  const nExams = useMemo(() => new Set((items || []).filter((i) => i.source === "exam").map((i) => i.test_id)).size, [items]);

  const shown = useMemo(() => {
    const f = norm(q.trim());
    return (items || []).filter((i) =>
      (!promo || (promo === "__bank" ? i.source === "bank" : i.promo === promo || (i.source === "bank" && (i.level === normLevel(promo) || i.level === "Tous"))))
      && (!exam || (exam === "__bank" ? i.source === "bank" : i.test_id === exam))
      && (!domain || i.domain === domain) && (!type || i.type === type)
      && (!flag || (flag === "alerte" ? !!i.alerte : flag === "distracteur" ? !!i.unused?.length : flag === "disc" ? i.disc != null && i.disc < 0.15 : true))
      && (!f || norm(`${i.prompt} ${i.explanation || ""} ${JSON.stringify(i.options || "")}`).includes(f)));
  }, [items, q, promo, exam, domain, type, flag]);

  const groups = useMemo(() => {
    if (sort !== "exam") {
      const list = [...shown].sort((a, b) => sort === "rate" ? (a.rate ?? 2) - (b.rate ?? 2) : norm(a.domain || "zzz").localeCompare(norm(b.domain || "zzz")));
      return [{ key: "all", title: sort === "rate" ? "Les moins réussies d'abord" : "Par thème", items: list, exam: null as Exam | null }];
    }
    const g = new Map<string, Item[]>();
    shown.forEach((i) => { const k = i.source === "bank" ? "__bank" : i.test_id!; g.set(k, [...(g.get(k) || []), i]); });
    return [...g.entries()].map(([k, list]) => ({ key: k, title: k === "__bank" ? "Banque libre" : examMap.get(k)?.title || "Examen", exam: examMap.get(k) || null, items: list.sort((a, b) => a.position - b.position) }))
      .sort((a, b) => (a.key === "__bank" ? 1 : b.key === "__bank" ? -1 : +new Date(b.exam?.opens_at || b.exam?.created_at || 0) - +new Date(a.exam?.opens_at || a.exam?.created_at || 0)));
  }, [shown, sort, examMap]);

  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const copyTo = async (it: Item, target: string) => {
    if (target === "__bank") {
      const d = bankToDraft({ level: it.level, domain: it.domain, type: it.type, prompt: it.prompt, options: it.options, correct: it.correct, points: it.points,
        explanation: it.explanation, image_url: null, time_limit_s: null, terminal: it.terminal, external: it.external, source: null });
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("question_bank").insert({ ...draftToBank(d, it.level, examMap.get(it.test_id || "")?.title || null), created_by: user?.id });
      if (error) return notify(error.message);
      notify("Question ajoutée à la banque libre.", "ok"); setCopyFor(null); return load();
    }
    const t = examMap.get(target);
    if (t?.locked) return notify("Des étudiants ont déjà composé cet examen : ses questions sont figées. Dupliquez-le.");
    const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("test_id", target);
    const { data: row, error } = await supabase.from("questions").insert({
      test_id: target, position: count ?? 0, type: it.type, prompt: it.prompt, options: it.options, points: it.points,
      domain: it.domain, explanation: it.explanation, image_url: it.image_url ?? null, difficulty: it.difficulty ?? null, origin_id: it.id,
    }).select("id").single();
    if (error || !row) return notify(error?.message || "Copie impossible.");
    if (it.correct != null && !["long_text", "terminal", "external"].includes(it.type)) await supabase.from("answer_keys").upsert({ question_id: row.id, correct: it.correct });
    if (it.type === "terminal" && it.terminal) await supabase.from("question_terminals").upsert({ question_id: row.id, scenario: it.terminal.scenario, flag: it.terminal.flag || null });
    if (it.type === "external" && it.external) await supabase.from("question_externals").upsert({ question_id: row.id, tool: it.external.tool, label: it.external.label || null, time_limit_s: it.external.time_limit_s || null, scenario: it.external.scenario || {}, answer_key: it.external.answer_key ?? null });
    notify(`Question copiée dans « ${t?.title} ».`, "ok"); setCopyFor(null); load();
  };

  const remove = async (it: Item) => {
    if (it.source === "exam" && examMap.get(it.test_id!)?.locked) return notify("Des étudiants ont déjà composé cet examen : on ne peut plus retirer ses questions.");
    if (!confirm(it.source === "exam" ? `Retirer cette question de « ${examMap.get(it.test_id!)?.title} » ?` : "Supprimer cette question de la banque libre ?")) return;
    const { error } = await supabase.from(it.source === "exam" ? "questions" : "question_bank").delete().eq("id", it.id);
    if (error) return notify(error.message.includes("questions_locked") ? "Questions figées : des étudiants ont déjà composé." : error.message);
    setItems((xs) => (xs || []).filter((x) => x.key !== it.key));
  };

  const select = "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent";
  const nExamQ = (items || []).filter((i) => i.source === "exam").length;
  const nBankQ = (items || []).length - nExamQ;
  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageTitle>Banque de questions</PageTitle>
          <p className="mt-1.5 text-[15px] text-muted">
            {items ? <>{nExamQ} questions dans {nExams} examen(s) · {domains.length} thème(s){nBankQ > 0 && <> · {nBankQ} dans la banque libre</>}</> : "Chargement…"}
          </p>
        </div>
        <button className="btn-secondary" onClick={() => setPanel((p) => !p)}>{panel ? "Fermer" : "Alimenter la banque libre"}</button>
      </div>

      {panel && <FeedPanel onDone={load} />}

      <section className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
        <div className="relative">
          <svg aria-hidden viewBox="0 0 20 20" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
          <input className="w-full rounded-xl border border-line-strong bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="Rechercher dans les énoncés, les réponses, les explications…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <select className={select} value={promo} onChange={(e) => setPromo(e.target.value)} aria-label="Classe">
            <option value="">Toutes les classes</option>{promos.map((p) => <option key={p} value={p}>{p}</option>)}<option value="__bank">Banque libre seulement</option>
          </select>
          <select className={select} value={exam} onChange={(e) => setExam(e.target.value)} aria-label="Examen">
            <option value="">Tous les examens</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}<option value="__bank">Banque libre</option>
          </select>
          <select className={select} value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Thème">
            <option value="">Tous les thèmes</option>{domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className={select} value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
            <option value="">Tous les types</option>{types.map((t) => <option key={t} value={t}>{labelOf(t)}</option>)}
          </select>
          <select className={select} value={flag} onChange={(e) => setFlag(e.target.value)} aria-label="Qualité">
            <option value="">Toutes les qualités</option><option value="alerte">À revoir (alerte)</option><option value="disc">Ne départage pas</option><option value="distracteur">Réponse jamais choisie</option>
          </select>
          <select className={select} value={sort} onChange={(e) => setSort(e.target.value as "exam" | "rate" | "domain")} aria-label="Tri">
            <option value="exam">Trier par examen</option><option value="rate">Les moins réussies d&apos;abord</option><option value="domain">Trier par thème</option>
          </select>
        </div>
      </section>
      {items && <p className="mt-3 px-1 text-sm text-muted">{shown.length} question(s) sur {items.length}</p>}

      {groups.map((g) => (
        <section key={g.key} className="mt-6">
          <h2 className="flex flex-wrap items-center gap-3 px-1 text-xs font-bold uppercase tracking-[0.14em] text-fg/75">
            {g.exam ? <Link href={`/admin/tests/${g.exam.id}`} className="hover:text-accent">{g.title}</Link> : g.title}
            <span className="text-fg/45">{g.items.length}</span>
            {g.exam?.formation && <span className="rounded-md bg-navy/[0.08] px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-navy">{g.exam.formation}</span>}
            {g.exam && <span className="text-[11px] font-normal normal-case tracking-normal text-muted">{day(g.exam.opens_at || g.exam.created_at)}</span>}
            {g.exam?.locked && <span className="text-[11px] font-normal normal-case tracking-normal text-muted">· figé (copies rendues)</span>}
          </h2>
          <div className="mt-3 space-y-3">
            {g.items.map((it) => {
              const isOpen = open.has(it.key);
              const opts: any[] = Array.isArray(it.options) ? it.options : [];
              const good = new Set((Array.isArray(it.correct) ? it.correct : []).map(String));
              const isQcm = (it.type === "mcq_single" || it.type === "mcq_multi") && opts.length > 0;
              const goodOpts = opts.map((o, i) => ({ o, i })).filter(({ o, i }) => good.has(optId(o, i)));
              const others = isQcm ? opts.length - goodOpts.length : 0;
              return (
                <article key={it.key} className="group rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,22,64,0.04)] transition-shadow hover:shadow-[0_14px_34px_-24px_rgba(15,22,64,0.4)]">
                  <div className="flex flex-wrap items-center gap-2">
                    {it.domain && <span className="rounded-md bg-fg/[0.06] px-2 py-0.5 text-xs text-fg/75">{it.domain}</span>}
                    {it.source === "bank" && <span className="rounded-md bg-navy/[0.08] px-2 py-0.5 text-xs font-semibold text-navy">{it.level === "Tous" ? "Tous niveaux" : it.level}</span>}
                    {!isQcm && <span className="text-xs text-muted">{labelOf(it.type)}</span>}
                    {it.difficulty && <span className="rounded-md bg-fg/[0.06] px-2 py-0.5 text-xs text-fg/75">{it.difficulty}</span>}
                    {it.alerte && <span className="rounded-md bg-[#f08a3e]/[0.14] px-2 py-0.5 text-xs font-semibold text-[#a64a12]" title="D'après les copies rendues">{it.alerte}</span>}
                    {it.disc != null && <span className={`text-xs tabular-nums ${it.disc < 0.15 ? "font-semibold text-[#a64a12]" : it.disc >= 0.3 ? "text-[#1f7a44]" : "text-muted"}`} title="Indice de discrimination : réussite du quart des meilleurs moins celle du quart des plus faibles. 0,30 et plus : bonne question.">discrimination {it.disc.toFixed(2).replace(".", ",")}</span>}
                    {!!it.unused?.length && <span className="rounded-md bg-[#c23b17]/10 px-2 py-0.5 text-xs font-semibold text-[#b3361a]" title="Mauvaises réponses que personne n'a choisies : elles n'apportent rien, à réécrire.">{it.unused.length} réponse(s) jamais choisie(s)</span>}
                    <div className="ml-auto flex items-center gap-4">
                      <div className="flex items-center gap-3 text-sm opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button className="inline-flex items-center gap-1.5 text-navy hover:text-accent" onClick={() => setCopyFor(it)}>
                          <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></svg>Copier vers…
                        </button>
                        <button className="text-navy hover:text-accent" onClick={() => setEdit({ source: it.source, id: it.id, type: it.type, prompt: it.prompt, options: it.options, correct: it.correct, points: it.points,
                          domain: it.domain, explanation: it.explanation, difficulty: it.difficulty, level: it.level, image_url: it.image_url, terminal: it.terminal, external: it.external,
                          locked: it.source === "exam" && !!examMap.get(it.test_id!)?.locked, examTitle: examMap.get(it.test_id || "")?.title })}>Modifier</button>
                        <button className="text-[#c23b17] hover:underline" onClick={() => remove(it)}>Supprimer</button>
                      </div>
                      {it.rate != null && (
                        <span className="flex items-center gap-2 text-sm font-semibold tabular-nums text-navy" title="Taux de réussite sur les copies rendues">
                          <span className="relative h-1.5 w-20 overflow-hidden rounded-full bg-fg/10"><span className="absolute inset-y-0 left-0 rounded-full bg-navy" style={{ width: `${Math.round(it.rate * 100)}%` }} /></span>
                          {Math.round(it.rate * 100)} %
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[15px] font-medium text-fg">{it.prompt}</p>

                  {isQcm && (
                    <div className="mt-2.5 space-y-1.5">
                      {(isOpen ? opts.map((o, i) => ({ o, i })) : goodOpts).map(({ o, i }) => {
                        const ok = good.has(optId(o, i));
                        return (
                          <div key={i} className={`flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm ${ok ? "bg-[#2fa862]/[0.12] text-[#1f6b3d]" : "text-fg/80"}`}>
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${ok ? "bg-[#2fa862] text-white" : "bg-fg/[0.07] text-fg/60"}`}>{LETTERS[i] || i + 1}</span>
                            <span className="min-w-0 flex-1">{optText(o)}</span>
                            {!ok && it.unused?.includes(optId(o, i)) && <span className="shrink-0 text-xs font-semibold text-[#b3361a]">jamais choisie</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {isOpen && it.explanation && <div className="mt-2.5 rounded-lg border-l-4 border-navy/60 bg-navy/[0.05] px-3.5 py-2.5 text-sm text-fg/85">{it.explanation}</div>}
                  {(others > 0 || it.explanation) && (
                    <button className="mt-2 text-xs text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => toggle(it.key)}>
                      {isOpen ? "Masquer" : [others > 0 ? `+ ${others} autre${others > 1 ? "s" : ""} réponse${others > 1 ? "s" : ""}` : "", it.explanation ? "l'explication" : ""].filter(Boolean).join(" et ")}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {items && !shown.length && <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center text-muted">Aucune question ne correspond.</div>}

      {edit && <QuestionEditor target={edit} domains={domains} onClose={() => setEdit(null)} onSaved={load} />}
      {copyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal aria-label="Copier la question" onClick={() => setCopyFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg uppercase text-navy">Copier vers…</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{copyFor.prompt}</p>
            <div className="mt-4 max-h-[50vh] space-y-1.5 overflow-y-auto">
              {copyFor.source === "exam" && (
                <button onClick={() => copyTo(copyFor, "__bank")} className="flex w-full items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-left text-sm hover:border-accent">
                  <span className="font-medium">Banque libre</span><span className="text-xs text-muted">{copyFor.level === "Tous" ? "tous niveaux" : copyFor.level}</span>
                </button>
              )}
              {exams.filter((e) => e.id !== copyFor.test_id).map((e) => (
                <button key={e.id} disabled={e.locked} onClick={() => copyTo(copyFor, e.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-left text-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-45">
                  <span className="truncate font-medium">{e.title}</span>
                  <span className="shrink-0 text-xs text-muted">{e.locked ? "figé" : e.formation || ""}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 text-right"><button className="btn-secondary" onClick={() => setCopyFor(null)}>Annuler</button></div>
          </div>
        </div>
      )}
    </main>
  );
}

/** Ajout de questions à la banque libre depuis un fichier (.csv ou .json). */
function FeedPanel({ onDone }: { onDone: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [level, setLevel] = useState("Tous");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const fromFile = async (f: File) => {
    setBusy(true);
    try {
      const x = await readExamFile(f);
      const { data: { user } } = await supabase.auth.getUser();
      const rows = x.questions.map((qq) => ({ ...fileToBank(qq, level, f.name.slice(0, 200)), created_by: user?.id }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("question_bank").insert(rows.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }
      const rep = importReport(x);
      notify(`${rows.length} question(s) ajoutée(s) à la banque libre.${rep ? ` ${rep}.` : ""}`, rep ? "info" : "ok");
      onDone();
    } catch (e: any) { notify(`Import impossible : ${e?.message || "fichier illisible"}.`); }
    finally { setBusy(false); if (file.current) file.current.value = ""; }
  };
  return (
    <section className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
      <label>Niveau par défaut
        <select className="input mt-1" value={level} onChange={(e) => setLevel(e.target.value)}>
          {LEVELS.map((l) => <option key={l} value={l}>{l === "Tous" ? "Tous niveaux" : l}</option>)}
        </select>
      </label>
      <button className="btn" disabled={busy} onClick={() => file.current?.click()}>{busy ? "Import…" : "Importer un fichier (.csv, .json)"}</button>
      <input ref={file} type="file" accept=".json,.csv,.tsv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && fromFile(e.target.files[0])} />
      <p className="basis-full text-xs text-muted">Une colonne « Niveau » dans le CSV prime sur le niveau par défaut. Pour reprendre une question d&apos;examen : « Copier vers… › Banque libre » sur sa carte.</p>
    </section>
  );
}
