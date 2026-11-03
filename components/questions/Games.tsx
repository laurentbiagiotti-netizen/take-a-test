"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSolved, parseLevel, replay, step, type SokoOptions } from "@/lib/questions/sokoban";
import { CMD_LABEL, parseMap, run, sanitize, type RobotCmd, type RobotOptions, type RobotProgram } from "@/lib/questions/robot";
import { LEVELS, priority, PRIORITY_LABEL, type TicketsOptions } from "@/lib/questions/tickets";
import { VERDICTS, type FeedOptions } from "@/lib/questions/feed";

/* ---------------- Caisses à pousser ---------------- */

export function Sokoban({ q, value, onText }: { q: any; value: any; onText: (r: any) => void }) {
  const o: SokoOptions = q.options || { levels: [] };
  const moves: string[] = Array.isArray(value?.moves) ? value.moves : o.levels.map(() => "");
  const [lv, setLv] = useState(() => Math.max(0, moves.findIndex((m, i) => !replay(o.levels[i].map, m).solved)));
  const cur = o.levels[lv];
  const res = useMemo(() => replay(cur?.map || "", moves[lv] || ""), [cur, moves, lv]);
  const s = res.state;
  const t0 = useRef(Date.now() - (value?.ms || 0));
  const box = useRef<HTMLDivElement>(null);
  const save = useCallback((m: string[], extra: Record<string, number> = {}) =>
    onText({ moves: m, undos: value?.undos || 0, restarts: value?.restarts || 0, ...extra, ms: Date.now() - t0.current }), [onText, value]);

  const go = (d: string) => {
    if (res.solved) return;
    if (step(s, d) === s) return;
    const m = [...moves]; m[lv] = (m[lv] || "") + d; save(m);
  };
  const undo = () => { const m = [...moves]; m[lv] = (m[lv] || "").slice(0, -1); save(m, { undos: (value?.undos || 0) + 1 }); };
  const restart = () => { const m = [...moves]; m[lv] = ""; save(m, { restarts: (value?.restarts || 0) + 1 }); };
  useEffect(() => { box.current?.focus(); }, [lv]);

  if (!cur) return null;
  const cellPx = Math.min(44, Math.floor(560 / s.w));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {o.levels.map((l, i) => {
          const ok = replay(l.map, moves[i] || "").solved;
          return <button key={i} className={`px-3 py-1 rounded-md border text-sm ${i === lv ? "border-accent bg-accent/15" : "border-line"} ${ok ? "text-ok" : ""}`} onClick={() => setLv(i)}>Niveau {i + 1}{ok ? " ✓" : ""}</button>;
        })}
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <div ref={box} tabIndex={0} className="inline-grid rounded-xl border border-line bg-bg p-2 outline-none focus:border-accent" aria-label="Plateau : utilisez les flèches du clavier"
          style={{ gridTemplateColumns: `repeat(${s.w}, ${cellPx}px)` }}
          onKeyDown={(e) => { const k = { ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r" }[e.key]; if (k) { e.preventDefault(); go(k); } }}>
          {Array.from({ length: s.w * s.h }, (_, i) => {
            const wall = s.walls.has(i), goal = s.goals.has(i), b = s.boxes.has(i), p = s.player === i;
            return (
              <div key={i} style={{ width: cellPx, height: cellPx }} className={`relative flex items-center justify-center ${wall ? "bg-[#2a3248] rounded-sm" : "bg-surface"}`}>
                {goal && !b && <span className="w-1/3 h-1/3 rounded-full border-2 border-accent/70" />}
                {b && <span className={`absolute inset-[12%] rounded-md border-2 ${goal ? "bg-ok/80 border-ok" : "bg-accent/80 border-accent"}`} />}
                {p && <span className="absolute inset-[22%] rounded-full bg-[#7dd3fc] shadow-[0_0_0_3px_rgba(125,211,252,0.25)]" />}
              </div>
            );
          })}
        </div>
        <div className="space-y-2 text-sm min-w-[12rem]">
          <div className="grid grid-cols-3 gap-1 w-32">
            <span /><button className="btn-secondary !px-0 justify-center" onClick={() => go("u")} aria-label="Haut">↑</button><span />
            <button className="btn-secondary !px-0 justify-center" onClick={() => go("l")} aria-label="Gauche">←</button>
            <button className="btn-secondary !px-0 justify-center" onClick={() => go("d")} aria-label="Bas">↓</button>
            <button className="btn-secondary !px-0 justify-center" onClick={() => go("r")} aria-label="Droite">→</button>
          </div>
          <div className="flex gap-2"><button className="btn-secondary !py-1" onClick={undo} disabled={!moves[lv]}>Annuler</button><button className="btn-secondary !py-1" onClick={restart}>Recommencer</button></div>
          <div><span className="text-muted">Coups :</span> <b>{res.count}</b> <span className="text-faint">(objectif : {cur.par} ou moins)</span></div>
          {res.solved && <div className="text-ok font-semibold" role="status">Niveau réussi{res.count <= cur.par ? ", dans l'objectif" : ""} !{lv < o.levels.length - 1 ? <> <button className="underline ml-1" onClick={() => setLv(lv + 1)}>Niveau suivant</button></> : " Validez pour continuer."}</div>}
          {!res.solved && isSolved(parseLevel(cur.map)) && null}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Robot à programmer ---------------- */

const ICON: Record<RobotCmd, string> = { F: "⬆", L: "↺", R: "↻", A: "💡", P: "P1" };

export function RobotGame({ q, value, onText }: { q: any; value: any; onText: (r: any) => void }) {
  const o: RobotOptions = q.options || { levels: [] };
  const progs: RobotProgram[] = Array.isArray(value?.programs) ? value.programs.map(sanitize) : o.levels.map(() => ({ main: [], p1: [] }));
  const [lv, setLv] = useState(0);
  const [slot, setSlot] = useState<"main" | "p1">("main");
  const [frame, setFrame] = useState<number | null>(null);
  const L = o.levels[lv];
  const prog = progs[lv] || { main: [], p1: [] };
  const result = useMemo(() => (L ? run(L, prog) : null), [L, prog]);
  const map = useMemo(() => (L ? parseMap(L.map) : null), [L]);
  const timer = useRef<any>(null);
  useEffect(() => () => clearInterval(timer.current), []);
  useEffect(() => { setFrame(null); clearInterval(timer.current); }, [lv]);
  const save = (p: RobotProgram) => { const all = [...progs]; all[lv] = p; onText({ programs: all, runs: (value?.runs || 0) }); setFrame(null); };
  const add = (c: RobotCmd) => {
    const list = [...prog[slot]]; if (list.length >= (slot === "main" ? L.main : L.p1)) return;
    save({ ...prog, [slot]: [...list, c] });
  };
  const play = () => {
    if (!result) return;
    clearInterval(timer.current); setFrame(0);
    onText({ programs: progs, runs: (value?.runs || 0) + 1 });
    let i = 0;
    timer.current = setInterval(() => { i++; if (i >= result.trace.length) { clearInterval(timer.current); return; } setFrame(i); }, 380);
  };
  if (!L || !map || !result) return null;
  const t = result.trace[frame ?? 0];
  const finished = frame !== null && frame >= result.trace.length - 1;
  const cell = 46;
  const arrow = ["▲", "▶", "▼", "◀"][t.dir];
  const Slots = ({ k, n }: { k: "main" | "p1"; n: number }) => (
    <div className={`rounded-lg border p-2 ${slot === k ? "border-accent" : "border-line"}`} onClick={() => setSlot(k)}>
      <div className="text-xs text-muted mb-1">{k === "main" ? "Programme principal" : "Routine P1"} <span className="text-faint">({prog[k].length}/{n})</span></div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: n }, (_, i) => {
          const c = prog[k][i];
          return <button key={i} className={`w-9 h-9 rounded-md border text-sm ${c ? "border-line-strong bg-surface-2" : "border-dashed border-line"}`}
            title={c ? `${CMD_LABEL[c]} (cliquer pour retirer)` : "Case vide"} aria-label={c ? `Retirer ${CMD_LABEL[c]}` : "Case vide"}
            onClick={(e) => { e.stopPropagation(); if (c) save({ ...prog, [k]: prog[k].filter((_, j) => j !== i) }); setSlot(k); }}>{c ? ICON[c] : ""}</button>;
        })}
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {o.levels.map((l, i) => {
          const ok = run(l, progs[i] || { main: [], p1: [] }).solved;
          return <button key={i} className={`px-3 py-1 rounded-md border text-sm ${i === lv ? "border-accent bg-accent/15" : "border-line"} ${ok ? "text-ok" : ""}`} onClick={() => setLv(i)}>Niveau {i + 1}{ok ? " ✓" : ""}</button>;
        })}
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <div className="inline-grid rounded-xl border border-line bg-bg p-2" style={{ gridTemplateColumns: `repeat(${map.w}, ${cell}px)` }} aria-label="Plateau du robot">
          {Array.from({ length: map.w * map.h }, (_, i) => {
            const x = i % map.w, y = Math.floor(i / map.w), c = map.cell(x, y);
            const lamp = c === "L", lit = t.lit.includes(`${x},${y}`), here = t.x === x && t.y === y;
            return (
              <div key={i} style={{ width: cell, height: cell }} className={`relative flex items-center justify-center ${c === "#" ? "" : "bg-surface border border-line"}`}>
                {lamp && <span className={`w-5 h-5 rounded-full ${lit ? "bg-[#facc15] shadow-[0_0_14px_#facc15]" : "bg-[#facc15]/25 border border-[#facc15]/60"}`} />}
                {here && <span className="absolute text-[#7dd3fc] text-xl leading-none">{arrow}</span>}
              </div>
            );
          })}
        </div>
        <div className="space-y-3 flex-1 min-w-[16rem]">
          <div className="flex flex-wrap gap-1.5">
            {(["F", "L", "R", "A", ...(L.p1 > 0 ? ["P"] : [])] as RobotCmd[]).map((c) => (
              <button key={c} className="btn-secondary !py-1.5 !px-2.5 text-sm" onClick={() => add(c)}>{ICON[c]} {CMD_LABEL[c]}</button>
            ))}
          </div>
          <Slots k="main" n={L.main} />
          {L.p1 > 0 && <Slots k="p1" n={L.p1} />}
          <div className="flex items-center gap-3">
            <button className="btn !py-1.5" onClick={play}>▶ Lancer</button>
            <span className="text-sm">{finished ? (result.solved ? <b className="text-ok">Toutes les lampes sont allumées !</b> : <span className="text-warn">{result.lit}/{result.lamps} lampe(s) allumée(s) : modifiez le programme.</span>) : <span className="text-faint">Les boutons ajoutent une instruction dans le cadre orange.</span>}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tickets de support ---------------- */

export function Tickets({ q, value, onChange }: { q: any; value: any; onChange: (r: any) => void }) {
  const o: TicketsOptions = q.options || { tickets: [], groups: [] };
  const a: Record<string, any> = value?.tickets || {};
  const set = (id: string, k: string, v: string) => onChange({ tickets: { ...a, [id]: { ...(a[id] || {}), [k]: v } } });
  const sel = "input !py-1 !text-xs min-w-[7rem]";
  return (
    <div className="rounded-lg border border-line overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-xs text-muted">
          <tr>{["Ticket", "Impact", "Urgence", "Priorité", "Groupe attribué"].map((h) => <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {o.tickets.map((t, i) => {
            const r = a[t.id] || {};
            const p = priority(r.impact, r.urgence);
            return (
              <tr key={t.id} className="border-t border-line align-top">
                <td className="px-3 py-2 min-w-[16rem]"><div className="text-xs text-faint">#{1040 + i} · {t.from}</div><div className="font-medium">{t.title}</div><div className="text-xs text-muted mt-0.5">{t.text}</div></td>
                <td className="px-2 py-2"><select className={sel} value={r.impact || ""} onChange={(e) => set(t.id, "impact", e.target.value)} aria-label={`Impact du ticket ${t.title}`}><option value="">…</option>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                <td className="px-2 py-2"><select className={sel} value={r.urgence || ""} onChange={(e) => set(t.id, "urgence", e.target.value)} aria-label={`Urgence du ticket ${t.title}`}><option value="">…</option>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                <td className="px-2 py-2 whitespace-nowrap">{p ? <span className={`badge ${p <= 2 ? "border-danger/50 text-danger" : p === 3 ? "border-warn/50 text-warn" : "border-line-strong text-muted"}`}>{PRIORITY_LABEL[p]}</span> : <span className="text-faint">-</span>}</td>
                <td className="px-2 py-2 min-w-[14rem]"><select className={`${sel} w-full`} value={r.groupe || ""} onChange={(e) => set(t.id, "groupe", e.target.value)} aria-label={`Groupe du ticket ${t.title}`}><option value="">…</option>{o.groups.map((g) => <option key={g} value={g}>{g}</option>)}</select></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Fil d'actualité : vrai ou fake ? ---------------- */


export function Feed({ q, value, onChange }: { q: any; value: any; onChange: (r: any) => void }) {
  const o: FeedOptions = q.options || { posts: [] };
  const v: Record<string, string> = value?.verdicts || {};
  return (
    <div className="max-w-xl mx-auto space-y-3">
      {o.posts.map((p) => (
        <article key={p.id} className="rounded-xl border border-line bg-surface-2/60 p-4">
          <header className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-full bg-line-strong grid place-items-center text-sm font-bold" aria-hidden>{p.author.slice(0, 1)}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-1.5 flex-wrap">{p.author}
                {p.badge === "officiel" && <span className="text-[10px] px-1.5 rounded bg-[#1d9bf0]/20 text-[#7cc4f5]">compte officiel</span>}
                {p.badge === "media" && <span className="text-[10px] px-1.5 rounded bg-ok/15 text-ok">média</span>}
                {p.badge === "nouveau" && <span className="text-[10px] px-1.5 rounded bg-warn/15 text-warn">compte créé {p.age || "récemment"}</span>}
              </div>
              <div className="text-xs text-faint">{p.handle} · {p.date}</div>
            </div>
          </header>
          <p className="mt-3 text-[15px] whitespace-pre-wrap leading-relaxed">{p.text}</p>
          {p.link && <div className="mt-3 rounded-lg border border-line bg-bg px-3 py-2"><div className="text-sm font-medium">{p.link.title}</div><div className="text-xs text-muted font-mono break-all">{p.link.url}</div></div>}
          {p.stats && <div className="mt-2 text-xs text-faint">{p.stats}</div>}
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={`Votre avis sur la publication de ${p.author}`}>
            {VERDICTS.map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={v[p.id] === k} onClick={() => onChange({ verdicts: { ...v, [p.id]: k } })}
                className={`px-3 py-1.5 rounded-md border text-sm ${v[p.id] === k ? (k === "fiable" ? "border-ok bg-ok/15" : k === "faux" ? "border-danger bg-danger/15" : "border-warn bg-warn/15") : "border-line text-muted hover:text-fg"}`}>{l}</button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
