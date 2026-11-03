"use client";
import { useMemo, useState } from "react";
import Terminal, { type TermResult } from "@/components/Terminal";
import ExternalExercise, { type ExternalInfo, type LaunchResult } from "@/components/questions/ExternalExercise";
import dynamic from "next/dynamic";
import { DecodeQuestion, PasswordCreate, SqlQuestion } from "@/components/questions/Practical";
import { HeadersQuestion, NetPuzzle, SubnetQuestion } from "@/components/questions/Networky";
import MiniCours from "@/components/questions/MiniCours";
import { Feed, RobotGame, Sokoban, Tickets } from "@/components/questions/Games";
const AdConsole = dynamic(() => import("@/components/questions/AdConsole"), { ssr: false });
const EventViewer = dynamic(() => import("@/components/questions/EventViewer"), { ssr: false });
const SimQuestion = dynamic(() => import("@/components/questions/Sims"), { ssr: false });
const BashScript = dynamic(() => import("@/components/questions/BashScript"), { ssr: false });
const FirewallBlocks = dynamic(() => import("@/components/questions/FirewallBlocks"), { ssr: false, loading: () => <p className="text-sm text-muted">Chargement de l&apos;éditeur de blocs…</p> });

/**
 * Affiche une question selon son type et remonte la réponse via onChange.
 * Ne contient jamais de bonne réponse : la correction est faite par le serveur.
 */
export type PublicQ = {
  id: string; seed?: string; type: string; prompt: string; points: number; image_url?: string | null;
  options: any;
  terminal?: { cwd: string; prompt: string; motd?: string | null; has_flag?: boolean; objectives?: { id: string; title: string; done: boolean }[] } | null;
  external?: ExternalInfo | null;
};

export default function QuestionBody({ q, value, onChange, onText, runTerminal, launchExternal, onExternalBlur }: {
  q: PublicQ;
  value: any;
  onChange: (response: any) => void;
  onText?: (response: any) => void;
  runTerminal?: (command: string) => Promise<TermResult>;
  launchExternal?: () => Promise<LaunchResult>;
  onExternalBlur?: () => void;
}) {
  const body = renderBody();
  return q.options?.help && q.type !== "subnet" ? <><MiniCours type={q.type} />{body}</> : body;
  function renderBody() {
  switch (q.type) {
    case "external":
      return launchExternal
        ? <ExternalExercise key={q.id} q={q} launch={launchExternal} onCompleted={() => onChange({ completed: true })} onToolBlur={onExternalBlur} />
        : <p className="text-sm text-muted">Exercice disponible uniquement pendant l&apos;épreuve.</p>;
    case "mcq_single": case "mcq_multi": return <Mcq q={q} value={value} onChange={onChange} />;
    case "long_text":
      return (
        <div>
          <textarea className="input min-h-[240px] font-mono !rounded-xl !p-4 leading-relaxed" maxLength={20000} spellCheck={false} autoComplete="off"
            placeholder="Rédigez votre réponse ici…"
            value={value?.text || ""} onChange={(e) => (onText || onChange)({ text: e.target.value })} onDrop={(e) => e.preventDefault()} />
          <div className="mt-1 text-right text-xs text-faint">{(value?.text || "").trim() ? (value.text as string).trim().split(/\s+/).length : 0} mot(s)</div>
        </div>
      );
    case "ordering": return <Ordering q={q} value={value} onChange={onChange} />;
    case "matching": return <Matching q={q} value={value} onChange={onChange} />;
    case "hotspot": return <Hotspot q={q} value={value} onChange={onChange} />;
    case "short_answer": return <ShortAnswer q={q} value={value} onChange={onText || onChange} />;
    case "sql": return <SqlQuestion key={q.id} q={q} value={value} onText={onText || onChange} />;
    case "decode": return <DecodeQuestion key={q.id} q={q} value={value} onText={onText || onChange} />;
    case "blocks": return <FirewallBlocks key={q.id} q={q} value={value} onText={onText || onChange} />;
    case "headers": return <HeadersQuestion q={q} value={value} onText={onText || onChange} onChange={onChange} />;
    case "subnet": return <SubnetQuestion q={q} value={value} onText={onText || onChange} />;
    case "netpuzzle": return <NetPuzzle key={q.id} q={q} value={value} onText={onText || onChange} />;
    case "sokoban": return <Sokoban key={q.id} q={q} value={value} onText={onText || onChange} />;
    case "robot": return <RobotGame key={q.id} q={q} value={value} onText={onText || onChange} />;
    case "adsim": return <AdConsole key={q.id} q={q} value={value} onChange={onText || onChange} />;
    case "tickets": return <Tickets q={q} value={value} onChange={onChange} />;
    case "feed": return <Feed q={q} value={value} onChange={onChange} />;
    case "sim": return <SimQuestion key={q.id} q={q} value={value} onChange={onChange} onText={onText || onChange} />;
    case "bash": return <BashScript key={q.id} q={q} value={value} onText={onText || onChange} />;
    case "evtx": return <EventViewer key={q.id} q={q} value={value} onText={onText || onChange} />;
    case "password":
      if (q.options?.mode === "create") return <PasswordCreate q={q} value={value} onText={onText || onChange} />;
      return <PasswordRank q={q} value={value} onChange={onChange} />;
    case "terminal":
      return q.terminal && runTerminal ? (
        <div className="space-y-3">
          <Terminal key={q.id} run={(c) => runTerminal(c)} initialPrompt={q.terminal.prompt} motd={q.terminal.motd}
            initialObjectives={q.terminal.objectives || []} />
          {q.terminal.has_flag !== false && (
            <label className="block text-sm text-muted">Flag trouvé (si la mission en cache un)
              <input className="input mt-1 font-mono" maxLength={200} placeholder="CYBER{...}" autoComplete="off" spellCheck={false}
                value={value?.flag || ""} onChange={(e) => (onText || onChange)({ flag: e.target.value })} />
            </label>
          )}
        </div>
      ) : null;
    default: return <p className="text-muted text-sm">Type de question non pris en charge.</p>;
  }
  }
}

const LETTERS = "ABCDEFGHIJKLMNOP";

function Mcq({ q, value, onChange }: { q: PublicQ; value: any; onChange: (r: any) => void }) {
  const sel: string[] = value?.selected || [];
  const single = q.type === "mcq_single";
  return (
    <div>
      <p className="sr-only">{single ? "Une seule bonne réponse." : "Plusieurs réponses possibles : cochez toutes les bonnes."}</p>
      {!single && sel.length > 0 && <p className="text-xs text-muted mb-2" aria-live="polite">{sel.length} réponse(s) cochée(s)</p>}
      <div className="grid gap-2.5">
        {(q.options || []).map((opt: any, k: number) => {
          const checked = sel.includes(opt.id);
          return (
            <label key={opt.id}
              className={`group relative flex gap-4 items-center p-4 rounded-xl border cursor-pointer transition-all duration-150
                ${checked ? "border-accent bg-gradient-to-r from-accent/15 to-transparent shadow-[0_0_0_1px_rgba(253,113,25,0.35),0_8px_24px_-12px_rgba(253,113,25,0.6)]"
                  : "border-line bg-surface-2/60 hover:border-line-strong hover:bg-surface-2 hover:-translate-y-px"}`}>
              <input className="sr-only peer" type={single ? "radio" : "checkbox"} name={`q-${q.id}`} checked={checked}
                onChange={(e) => {
                  let next = sel.slice();
                  if (single) next = e.target.checked ? [opt.id] : [];
                  else next = e.target.checked ? [...next, opt.id] : next.filter((x) => x !== opt.id);
                  onChange({ selected: next });
                }} />
              <span aria-hidden className={`shrink-0 w-9 h-9 grid place-items-center font-display text-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent
                ${single ? "rounded-full" : "rounded-lg"} ${checked ? "bg-accent text-bg" : "bg-bg border border-line-strong text-muted group-hover:text-fg"}`}>
                {checked ? "✓" : LETTERS[k] || k + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className={checked ? "text-fg" : "text-fg/90"}>{opt.text}</div>
                {opt.image_url && <img src={opt.image_url} alt="" className="mt-2 max-h-32 rounded-lg border border-line" draggable={false} />}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Mots de passe à classer du plus faible au plus fort : mélangés de façon stable par question. */
function PasswordRank({ q, value, onChange }: { q: PublicQ; value: any; onChange: (r: any) => void }) {
  const items = useMemo(() => {
    const list = [...(q.options?.items || [])];
    let h = 0; for (const c of q.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    for (let i = list.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  }, [q.id, q.options]);
  return (
    <div>
      <p className="text-sm text-muted mb-3">Du <b className="text-fg">plus faible</b> (en haut) au <b className="text-fg">plus robuste</b> (en bas).</p>
      <Ordering q={{ ...q, options: items.map((x: any) => ({ id: x.id, text: x.text })) }} value={value} onChange={onChange} mono />
    </div>
  );
}

function Ordering({ q, value, onChange, mono }: { q: PublicQ; value: any; onChange: (r: any) => void; mono?: boolean }) {
  const byId = useMemo(() => new Map((q.options || []).map((o: any) => [o.id, o.text])), [q.options]);
  const order: string[] = value?.order || (q.options || []).map((o: any) => o.id);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = order.slice(); const [x] = next.splice(from, 1); next.splice(to, 0, x);
    onChange({ order: next });
  };
  return (
    <div>
      <p className="text-xs text-muted mb-3">Glissez les étapes ou utilisez les flèches. L&apos;ordre affiché est votre réponse.</p>
      <ol className="relative space-y-2.5 before:absolute before:left-[1.35rem] before:top-4 before:bottom-4 before:w-px before:bg-gradient-to-b before:from-accent/60 before:to-line">
        {order.map((id, i) => (
          <li key={id} draggable onDragStart={() => setDrag(i)} onDragEnd={() => { setDrag(null); setOver(null); }}
            onDragOver={(e) => { e.preventDefault(); setOver(i); }}
            onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
            className={`relative flex items-center gap-4 pl-1 pr-3 py-2.5 rounded-xl border bg-surface-2 cursor-grab active:cursor-grabbing transition-all
              ${drag === i ? "opacity-50 scale-[0.99] border-accent" : over === i && drag !== null ? "border-accent shadow-[0_0_0_1px_rgba(253,113,25,0.4)]" : "border-line hover:border-line-strong"}`}>
            <span className="relative z-10 shrink-0 w-10 h-10 grid place-items-center rounded-full bg-bg border-2 border-accent/70 font-display text-accent">{i + 1}</span>
            <span className={`flex-1 ${mono ? "font-mono" : ""}`}>{String(byId.get(id) ?? "")}</span>
            <span aria-hidden className="text-faint select-none tracking-tighter mr-1">⋮⋮</span>
            <span className="flex gap-1">
              <button type="button" className="w-8 h-8 grid place-items-center rounded-md border border-line-strong text-muted hover:text-accent hover:border-accent disabled:opacity-30" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Monter">↑</button>
              <button type="button" className="w-8 h-8 grid place-items-center rounded-md border border-line-strong text-muted hover:text-accent hover:border-accent disabled:opacity-30" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} aria-label="Descendre">↓</button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Associer : on clique un élément à gauche, puis sa réponse dans la liste de droite.
 * Chaque ligne garde aussi une liste déroulante (clavier, lecteurs d'écran).
 */
function Matching({ q, value, onChange }: { q: PublicQ; value: any; onChange: (r: any) => void }) {
  const pairs: Record<string, string> = value?.pairs || {};
  const left: any[] = q.options?.left || [];
  const right: any[] = q.options?.right || [];
  const [active, setActive] = useState<string | null>(null);
  const used = new Map(Object.entries(pairs).map(([l, r]) => [r, l]));
  const setPair = (l: string, r: string | null) => {
    const next = { ...pairs };
    for (const [k, v] of Object.entries(next)) if (r && v === r && k !== l) delete next[k];
    if (r) next[l] = r; else delete next[l];
    onChange({ pairs: next });
  };
  const pick = (r: string) => {
    const target = active ?? left.find((l) => !pairs[l.id])?.id;
    if (!target) return;
    setPair(target, pairs[target] === r ? null : r);
    const nextEmpty = left.find((l) => l.id !== target && !pairs[l.id]);
    setActive(nextEmpty ? nextEmpty.id : null);
  };
  const textOf = (id?: string) => right.find((r) => r.id === id)?.text;
  const PAIR = ["#fd7119", "#34d399", "#60a5fa", "#f472b6", "#fbbf24", "#a78bfa", "#22d3ee", "#f87171"];
  const colorOf = (l: string) => PAIR[left.findIndex((x) => x.id === l) % PAIR.length];
  return (
    <div className="grid md:grid-cols-[1.3fr_1fr] gap-4">
      <ul className="space-y-2">
        {left.map((l) => {
          const isActive = active === l.id;
          return (
            <li key={l.id}>
              <div className={`rounded-xl border p-3 transition-all ${isActive ? "border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(253,113,25,0.35)]" : pairs[l.id] ? "border-line-strong bg-surface-2" : "border-line bg-surface-2/60"}`}
                style={pairs[l.id] && !isActive ? { borderLeft: `4px solid ${colorOf(l.id)}` } : undefined}>
                <button type="button" className="w-full text-left flex items-center gap-3" onClick={() => setActive(isActive ? null : l.id)} aria-pressed={isActive}>
                  <span className="font-medium flex-1">{l.text}</span>
                  <span aria-hidden className="text-faint">→</span>
                  <span className={`text-sm px-2.5 py-1 rounded-lg ${pairs[l.id] ? "font-medium text-bg" : "text-faint border border-dashed border-line-strong"}`}
                    style={pairs[l.id] ? { background: colorOf(l.id) } : undefined}>
                    {textOf(pairs[l.id]) || (isActive ? "choisissez à droite" : "à associer")}
                  </span>
                </button>
                <label className="sr-only" htmlFor={`m-${l.id}`}>Réponse pour {l.text}</label>
                <select id={`m-${l.id}`} className="sr-only focus:not-sr-only focus:input focus:mt-2" value={pairs[l.id] || ""} onChange={(e) => setPair(l.id, e.target.value || null)}>
                  <option value="">Choisir…</option>
                  {right.map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
                </select>
              </div>
            </li>
          );
        })}
      </ul>
      <div>
        <div className="text-xs text-muted mb-2">{active ? "Cliquez la bonne réponse :" : "Cliquez un élément à gauche, puis sa réponse :"}</div>
        <div className="flex flex-wrap gap-2">
          {right.map((r) => {
            const owner = used.get(r.id);
            return (
              <button type="button" key={r.id} onClick={() => pick(r.id)}
                className={`px-3.5 py-2.5 rounded-xl border text-sm text-left transition-all ${owner ? "bg-bg text-muted" : "border-line-strong bg-surface-2 hover:border-accent hover:-translate-y-px"}`}
                style={owner ? { borderColor: colorOf(owner), boxShadow: `inset 3px 0 0 ${colorOf(owner)}` } : undefined}>
                {r.text}{owner && <span className="sr-only"> (déjà associé)</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Hotspot({ q, value, onChange }: { q: PublicQ; value: any; onChange: (r: any) => void }) {
  const o = q.options || {};
  const sel: string[] = value?.selected || [];
  const multi = o.multi !== false;
  const toggle = (id: string) => {
    const on = sel.includes(id);
    onChange({ selected: on ? sel.filter((x) => x !== id) : multi ? [...sel, id] : [id] });
  };
  const mark = (id: string) => sel.includes(id) ? "bg-accent/20 shadow-[inset_3px_0_0_#fd7119]" : "hover:bg-white/5";
  const hint = (
    <p className="text-xs text-muted mb-3 flex flex-wrap items-center gap-2">
      <span>{multi ? "Cliquez sur tous les éléments concernés (une erreur retire des points)." : "Cliquez sur un seul élément."} Recliquez pour désélectionner.</span>
      {sel.length > 0 && <span className="badge border-accent/50 text-accent">{sel.length} sélectionné{sel.length > 1 ? "s" : ""}</span>}
    </p>
  );

  if (o.layout === "email") {
    return (
      <div>{hint}
        <div className="rounded-xl border border-line overflow-hidden shadow-[0_20px_50px_-25px_rgba(0,0,0,0.9)]">
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border-b border-line">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-xs text-muted">Messagerie · Boîte de réception</span>
          </div>
          <div className="bg-[#f6e9e0] text-[#0a1047]">
          <div className="px-4 py-3 border-b border-[#0a1047]/15 text-sm space-y-0.5">
            {o.header?.from && <div><span className="opacity-60">De : </span>{o.header.from}</div>}
            {o.header?.to && <div><span className="opacity-60">À : </span>{o.header.to}</div>}
            {o.header?.date && <div><span className="opacity-60">Date : </span>{o.header.date}</div>}
            {o.header?.subject && <div className="font-bold text-base pt-1">{o.header.subject}</div>}
          </div>
          <div className="p-4 space-y-1">
            {(o.segments || []).map((s: any) => (
              <button type="button" key={s.id} onClick={() => toggle(s.id)}
                className={`block w-full text-left px-2 py-1 rounded ${sel.includes(s.id) ? "bg-[#fd7119]/25 outline outline-2 outline-[#fd7119]" : "hover:bg-[#0a1047]/5"}`}>
                {s.text}
              </button>
            ))}
          </div>
          </div>
        </div>
      </div>
    );
  }
  if (o.layout === "table") {
    return (
      <div>{hint}
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            {o.columns?.length > 0 && <thead className="bg-surface-2"><tr>{o.columns.map((c: string, i: number) => <th key={i} className="text-left px-3 py-2 font-medium">{c}</th>)}</tr></thead>}
            <tbody>
              {(o.segments || []).map((s: any) => (
                <tr key={s.id} onClick={() => toggle(s.id)} className={`cursor-pointer border-t border-line ${mark(s.id)}`}>
                  {(s.cells || [s.text]).map((c: string, i: number) => <td key={i} className="px-3 py-1.5 font-mono text-xs">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return (
    <div>{hint}
      <div className="rounded-xl border border-line overflow-hidden shadow-[0_20px_50px_-25px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border-b border-line">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-xs text-muted font-mono">{o.layout === "log" ? "journal.log" : o.filename || "source"}</span>
        </div>
      <div className="bg-[#05070d] font-mono text-[13px] overflow-x-auto py-2">
        {(o.segments || []).map((s: any, i: number) => (
          <button type="button" key={s.id} onClick={() => toggle(s.id)}
            className={`flex w-full text-left px-3 py-0.5 whitespace-pre ${mark(s.id)}`}>
            <span className="text-faint select-none w-8 shrink-0 text-right pr-3">{i + 1}</span>
            <span className={o.layout === "log" ? "text-[#c9d1e3]" : "text-fg"}>{s.text}</span>
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}

function ShortAnswer({ q, value, onChange }: { q: PublicQ; value: any; onChange: (r: any) => void }) {
  const d = q.options?.data;
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const rows: string[][] = useMemo(() => {
    if (d?.kind !== "table") return [];
    let r = (d.rows || []) as string[][];
    if (filter) { const f = filter.toLowerCase(); r = r.filter((row) => row.some((c) => String(c).toLowerCase().includes(f))); }
    if (sort) r = [...r].sort((a, b) => {
      const x = a[sort.col] ?? "", y = b[sort.col] ?? "";
      const nx = parseFloat(x), ny = parseFloat(y);
      return (!isNaN(nx) && !isNaN(ny) ? nx - ny : String(x).localeCompare(String(y))) * sort.dir;
    });
    return r;
  }, [d, filter, sort]);
  return (
    <div className="space-y-3">
      {d?.kind === "table" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input className="input max-w-xs" placeholder="Filtrer les lignes…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <span className="text-xs text-muted">{rows.length} ligne(s) · cliquez un en-tête pour trier</span>
          </div>
          <div className="overflow-auto max-h-80 rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 sticky top-0">
                <tr>{(d.columns || []).map((c: string, i: number) => (
                  <th key={i} className="text-left px-3 py-2 font-medium cursor-pointer select-none"
                    onClick={() => setSort((s) => (s?.col === i ? { col: i, dir: (s.dir * -1) as 1 | -1 } : { col: i, dir: 1 }))}>
                    {c}{sort?.col === i ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </th>
                ))}</tr>
              </thead>
              <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line odd:bg-white/[0.02] hover:bg-accent/5">{r.map((c, j) => <td key={j} className="px-3 py-1.5 font-mono text-xs">{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      {d?.kind === "text" && <pre className="rounded-lg border border-line bg-[#05070d] p-3 font-mono text-xs whitespace-pre-wrap max-h-80 overflow-auto text-[#c9d1e3]">{d.text}</pre>}
      <label className="block">
        <span className="text-xs uppercase tracking-wider text-muted">Votre réponse</span>
        <input className="input mt-1 font-mono !text-base !py-3 !rounded-xl" maxLength={500} placeholder={q.options?.placeholder || "Votre réponse"} autoComplete="off" spellCheck={false}
          value={value?.text || ""} onChange={(e) => onChange({ text: e.target.value })} />
      </label>
    </div>
  );
}
