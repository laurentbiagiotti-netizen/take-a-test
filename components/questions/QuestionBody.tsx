"use client";
import { useMemo, useState } from "react";
import Terminal, { type TermResult } from "@/components/Terminal";

/**
 * Affiche une question selon son type et remonte la réponse via onChange.
 * Ne contient jamais de bonne réponse : la correction est faite par le serveur.
 */
export type PublicQ = {
  id: string; type: string; prompt: string; points: number; image_url?: string | null;
  options: any;
  terminal?: { cwd: string; prompt: string; motd?: string | null; has_flag?: boolean; objectives?: { id: string; title: string; done: boolean }[] } | null;
};

export default function QuestionBody({ q, value, onChange, onText, runTerminal }: {
  q: PublicQ;
  value: any;
  onChange: (response: any) => void;
  onText?: (response: any) => void;
  runTerminal?: (command: string) => Promise<TermResult>;
}) {
  switch (q.type) {
    case "mcq_single": case "mcq_multi": return <Mcq q={q} value={value} onChange={onChange} />;
    case "long_text":
      return (
        <textarea className="input min-h-[220px] font-mono" maxLength={20000} spellCheck={false} autoComplete="off"
          value={value?.text || ""} onChange={(e) => (onText || onChange)({ text: e.target.value })} onDrop={(e) => e.preventDefault()} />
      );
    case "ordering": return <Ordering q={q} value={value} onChange={onChange} />;
    case "matching": return <Matching q={q} value={value} onChange={onChange} />;
    case "hotspot": return <Hotspot q={q} value={value} onChange={onChange} />;
    case "short_answer": return <ShortAnswer q={q} value={value} onChange={onText || onChange} />;
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

function Mcq({ q, value, onChange }: { q: PublicQ; value: any; onChange: (r: any) => void }) {
  const sel: string[] = value?.selected || [];
  return (
    <div className="space-y-2">
      {(q.options || []).map((opt: any) => {
        const checked = sel.includes(opt.id);
        return (
          <label key={opt.id} className={`flex gap-3 items-center p-3 rounded-md border cursor-pointer transition-colors ${checked ? "border-accent bg-surface-2" : "border-line hover:border-line-strong"}`}>
            <input type={q.type === "mcq_single" ? "radio" : "checkbox"} name={`q-${q.id}`} checked={checked}
              onChange={(e) => {
                let next = sel.slice();
                if (q.type === "mcq_single") next = e.target.checked ? [opt.id] : [];
                else next = e.target.checked ? [...next, opt.id] : next.filter((x) => x !== opt.id);
                onChange({ selected: next });
              }} />
            <div className="flex-1">
              <div>{opt.text}</div>
              {opt.image_url && <img src={opt.image_url} alt="" className="mt-1 max-h-32 rounded border border-line" draggable={false} />}
            </div>
          </label>
        );
      })}
    </div>
  );
}

function Ordering({ q, value, onChange }: { q: PublicQ; value: any; onChange: (r: any) => void }) {
  const byId = useMemo(() => new Map((q.options || []).map((o: any) => [o.id, o.text])), [q.options]);
  const order: string[] = value?.order || (q.options || []).map((o: any) => o.id);
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = order.slice(); const [x] = next.splice(from, 1); next.splice(to, 0, x);
    onChange({ order: next });
  };
  return (
    <div>
      <p className="text-xs text-muted mb-2">Glissez les étapes ou utilisez les flèches. L&apos;ordre affiché est votre réponse.</p>
      <ol className="space-y-2">
        {order.map((id, i) => (
          <li key={id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }}
            className={`flex items-center gap-3 p-3 rounded-md border bg-surface-2 cursor-grab ${drag === i ? "border-accent opacity-60" : "border-line"}`}>
            <span className="font-display text-accent w-6 text-center">{i + 1}</span>
            <span className="flex-1">{String(byId.get(id) ?? "")}</span>
            <span className="flex gap-1">
              <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Monter">↑</button>
              <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} aria-label="Descendre">↓</button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Matching({ q, value, onChange }: { q: PublicQ; value: any; onChange: (r: any) => void }) {
  const pairs: Record<string, string> = value?.pairs || {};
  const used = new Set(Object.values(pairs));
  return (
    <div className="space-y-2">
      {(q.options?.left || []).map((l: any) => (
        <div key={l.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-3 rounded-md border border-line bg-surface-2">
          <span className="font-medium">{l.text}</span>
          <span className="text-faint">→</span>
          <select className="input" value={pairs[l.id] || ""} onChange={(e) => {
            const next = { ...pairs };
            if (e.target.value) next[l.id] = e.target.value; else delete next[l.id];
            onChange({ pairs: next });
          }}>
            <option value="">Choisir…</option>
            {(q.options?.right || []).map((r: any) => (
              <option key={r.id} value={r.id}>{r.text}{used.has(r.id) && pairs[l.id] !== r.id ? " (déjà utilisé)" : ""}</option>
            ))}
          </select>
        </div>
      ))}
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
  const mark = (id: string) => sel.includes(id) ? "bg-accent/15 outline outline-1 outline-accent" : "hover:bg-surface-2";
  const hint = <p className="text-xs text-muted mb-2">{multi ? "Cliquez sur tous les éléments concernés (une erreur retire des points)." : "Cliquez sur un seul élément."} Recliquez pour désélectionner.</p>;

  if (o.layout === "email") {
    return (
      <div>{hint}
        <div className="rounded-lg border border-line bg-[#f6e9e0] text-[#0a1047] overflow-hidden">
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
      <div className="rounded-lg border border-line bg-[#05070d] font-mono text-[13px] overflow-x-auto py-2">
        {(o.segments || []).map((s: any, i: number) => (
          <button type="button" key={s.id} onClick={() => toggle(s.id)}
            className={`flex w-full text-left px-3 py-0.5 whitespace-pre ${mark(s.id)}`}>
            <span className="text-faint select-none w-8 shrink-0 text-right pr-3">{i + 1}</span>
            <span className={o.layout === "log" ? "text-[#c9d1e3]" : "text-fg"}>{s.text}</span>
          </button>
        ))}
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
          <div className="overflow-auto max-h-80 rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 sticky top-0">
                <tr>{(d.columns || []).map((c: string, i: number) => (
                  <th key={i} className="text-left px-3 py-2 font-medium cursor-pointer select-none"
                    onClick={() => setSort((s) => (s?.col === i ? { col: i, dir: (s.dir * -1) as 1 | -1 } : { col: i, dir: 1 }))}>
                    {c}{sort?.col === i ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </th>
                ))}</tr>
              </thead>
              <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className="px-3 py-1.5 font-mono text-xs">{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      {d?.kind === "text" && <pre className="rounded-lg border border-line bg-[#05070d] p-3 font-mono text-xs whitespace-pre-wrap max-h-80 overflow-auto text-[#c9d1e3]">{d.text}</pre>}
      <input className="input font-mono" maxLength={500} placeholder={q.options?.placeholder || "Votre réponse"} autoComplete="off" spellCheck={false}
        value={value?.text || ""} onChange={(e) => onChange({ text: e.target.value })} />
    </div>
  );
}
