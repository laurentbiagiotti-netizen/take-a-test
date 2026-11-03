"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSolved, parseLevel, replay, step, type SokoOptions } from "@/lib/questions/sokoban";
import { CMD_LABEL, parseMap, run, sanitize, type RobotCmd, type RobotOptions, type RobotProgram } from "@/lib/questions/robot";
import { LEVELS, priority, PRIORITY_LABEL, type TicketsOptions } from "@/lib/questions/tickets";
import AppWindow from "@/components/questions/AppWindow";
import { ART, SitePage } from "@/components/questions/FeedArt";
import { ACTIONS, REASONS, VERDICTS, type Action, type FeedOptions, type Post } from "@/lib/questions/feed";

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

const PRIO_COLOR: Record<number, string> = { 1: "#d9534f", 2: "#f0ad4e", 3: "#f7e463", 4: "#9fd89f", 5: "#cfe8cf" };

/** File de tickets façon GLPI : liste, puis formulaire du ticket (impact, urgence, groupe ; priorité calculée). */
export function Tickets({ q, value, onChange }: { q: any; value: any; onChange: (r: any) => void }) {
  const o: TicketsOptions = q.options || { tickets: [], groups: [] };
  const a: Record<string, any> = value?.tickets || {};
  const [open, setOpen] = useState<string | null>(null);
  const set = (id: string, k: string, v: string) => onChange({ tickets: { ...a, [id]: { ...(a[id] || {}), [k]: v } } });
  const sel = "w-full rounded border border-[#ced4da] bg-white px-2 py-1 text-[13px] text-[#212529]";
  const t = o.tickets.find((x) => x.id === open);
  const idx = t ? o.tickets.indexOf(t) : -1;
  const hour = (i: number) => `08:${String(41 + i * 5).padStart(2, "0")}`;
  const done = o.tickets.filter((x) => a[x.id]?.impact && a[x.id]?.urgence && a[x.id]?.groupe).length;
  const Prio = ({ p }: { p: number | null }) => p ? <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-black/10" style={{ background: PRIO_COLOR[p] }} />{PRIORITY_LABEL[p]}</span> : <span className="text-[#adb5bd]">-</span>;

  return (
    <AppWindow title="Support" kind="browser" url={t ? `https://support.ecole.example/front/ticket.form.php?id=${1040 + idx}` : "https://support.ecole.example/front/ticket.php"} bodyClass="bg-[#f5f7fb] text-[#212529] text-[13px]">
      <div className="grid grid-cols-[11rem_1fr] max-md:grid-cols-1 min-h-[28rem]">
        <nav className="bg-[#2f3f64] text-white/80 py-3 max-md:hidden" aria-label="Menu">
          <div className="px-4 pb-3 mb-2 border-b border-white/10 font-bold text-white tracking-wide">🛠️ Support</div>
          {[["🏠", "Accueil"], ["💻", "Parc"], ["🎧", "Assistance"], ["📊", "Gestion"], ["🔧", "Outils"], ["⚙️", "Administration"]].map(([i, l]) => (
            <div key={l}>
              <div className={`px-4 py-1.5 flex gap-2 ${l === "Assistance" ? "bg-white/10 text-white font-semibold" : ""}`}><span aria-hidden>{i}</span>{l}</div>
              {l === "Assistance" && ["Tickets", "Créer un ticket", "Problèmes", "Changements", "Statistiques"].map((x) => <div key={x} className={`pl-11 pr-3 py-1 text-[12px] ${x === "Tickets" ? "text-white" : "text-white/50"}`}>{x}</div>)}
            </div>
          ))}
        </nav>
        <div className="min-w-0">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-[#e3e6ea] text-[12px] text-[#6c757d]">
            <span>Accueil</span>›<span>Assistance</span>›<button type="button" className="text-[#2f6fd6] hover:underline" onClick={() => setOpen(null)}>Tickets</button>{t && <>›<span className="text-[#212529]">#{1040 + idx}</span></>}
            <span className="ml-auto">Technicien : vous · {done}/{o.tickets.length} tickets qualifiés</span>
          </div>
          {!t ? (
            <div className="p-4">
              <div className="bg-white rounded border border-[#e3e6ea] overflow-auto">
                <table className="w-full">
                  <thead className="bg-[#f8f9fa] text-[12px] text-[#495057]"><tr>{["ID", "Titre", "Statut", "Ouverture", "Demandeur", "Priorité", "Groupe de techniciens"].map((h) => <th key={h} className="text-left px-3 py-2 font-semibold border-b border-[#e3e6ea] whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody>{o.tickets.map((x, i) => {
                    const r = a[x.id] || {}, ok = r.impact && r.urgence && r.groupe;
                    return (
                      <tr key={x.id} className="border-b border-[#eef0f3] hover:bg-[#f1f5ff] cursor-pointer" onClick={() => setOpen(x.id)}>
                        <td className="px-3 py-2 text-[#6c757d]">{1040 + i}</td>
                        <td className="px-3 py-2"><button type="button" className="text-[#2f6fd6] font-semibold hover:underline text-left">{x.title}</button></td>
                        <td className="px-3 py-2 whitespace-nowrap">{ok ? <span className="text-[#198754]">● En cours (attribué)</span> : <span className="text-[#0d6efd]">● Nouveau</span>}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-[#6c757d]">Aujourd&apos;hui {hour(i)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{x.from}</td>
                        <td className="px-3 py-2 whitespace-nowrap"><Prio p={priority(r.impact, r.urgence)} /></td>
                        <td className="px-3 py-2 text-[#495057]">{r.groupe || <span className="text-[#adb5bd]">-</span>}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] text-[#6c757d]">Ouvrez chaque ticket pour le qualifier.</p>
            </div>
          ) : (
            <div className="p-4 grid lg:grid-cols-[1fr_17rem] gap-4">
              <div className="space-y-3">
                <div className="bg-white rounded border border-[#e3e6ea] px-4 py-3"><div className="text-[11px] text-[#6c757d]">Ticket #{1040 + idx} · Incident</div><div className="text-[16px] font-semibold">{t.title}</div></div>
                <div className="flex gap-3">
                  <span aria-hidden className="w-9 h-9 rounded-full bg-[#6f42c1] text-white grid place-items-center font-semibold shrink-0">{t.from.slice(0, 1)}</span>
                  <div className="flex-1 bg-white rounded border border-[#e3e6ea] px-4 py-3">
                    <div className="text-[12px] text-[#6c757d] mb-1"><b className="text-[#212529]">{t.from}</b> · Aujourd&apos;hui {hour(idx)}</div>
                    <p className="leading-relaxed">{t.text}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {idx > 0 && <button type="button" className="rounded border border-[#ced4da] bg-white px-3 py-1.5" onClick={() => setOpen(o.tickets[idx - 1].id)}>‹ Ticket précédent</button>}
                  {idx < o.tickets.length - 1 && <button type="button" className="rounded border border-[#ced4da] bg-white px-3 py-1.5" onClick={() => setOpen(o.tickets[idx + 1].id)}>Ticket suivant ›</button>}
                </div>
              </div>
              <aside className="bg-white rounded border border-[#e3e6ea] p-3 space-y-2.5 h-fit">
                <div className="font-semibold text-[12px] uppercase tracking-wide text-[#495057] border-b border-[#eef0f3] pb-1.5">Ticket</div>
                <div className="grid grid-cols-[6rem_1fr] items-center gap-x-2 gap-y-2">
                  <span className="text-[#6c757d]">Statut</span><span>{a[t.id]?.groupe ? "En cours (attribué)" : "Nouveau"}</span>
                  <label className="text-[#6c757d]" htmlFor={`imp-${t.id}`}>Impact</label>
                  <select id={`imp-${t.id}`} className={sel} value={a[t.id]?.impact || ""} onChange={(e) => set(t.id, "impact", e.target.value)}><option value="">-----</option>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <label className="text-[#6c757d]" htmlFor={`urg-${t.id}`}>Urgence</label>
                  <select id={`urg-${t.id}`} className={sel} value={a[t.id]?.urgence || ""} onChange={(e) => set(t.id, "urgence", e.target.value)}><option value="">-----</option>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <span className="text-[#6c757d]">Priorité</span><span className="text-[12px]"><Prio p={priority(a[t.id]?.impact, a[t.id]?.urgence)} /> <span className="text-[#adb5bd]">(calculée)</span></span>
                </div>
                <div className="font-semibold text-[12px] uppercase tracking-wide text-[#495057] border-b border-[#eef0f3] pb-1.5 pt-2">Acteurs</div>
                <label className="block text-[#6c757d]" htmlFor={`grp-${t.id}`}>Attribué à (groupe)</label>
                <select id={`grp-${t.id}`} className={sel} value={a[t.id]?.groupe || ""} onChange={(e) => set(t.id, "groupe", e.target.value)}><option value="">-----</option>{o.groups.map((g) => <option key={g} value={g}>{g}</option>)}</select>
                <button type="button" className="w-full mt-2 rounded bg-[#2f6fd6] text-white py-1.5 font-semibold" onClick={() => setOpen(null)}>💾 Sauvegarder</button>
              </aside>
            </div>
          )}
        </div>
      </div>
    </AppWindow>
  );
}

/* ---------------- Fil d'actualité : vrai ou fake ? ---------------- */


function Avatar({ p, big }: { p: Post; big?: boolean }) {
  const hue = [...p.handle].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return <span aria-hidden className={`${big ? "w-16 h-16 text-2xl border-4 border-white" : "w-10 h-10 text-sm"} rounded-full grid place-items-center font-bold text-white shrink-0`} style={{ background: `hsl(${hue} 55% 45%)` }}>{p.author.slice(0, 1)}</span>;
}

function Badge({ p }: { p: Post }) {
  if (p.badge === "officiel") return <span title="Compte certifié" aria-label="compte certifié" className="inline-grid place-items-center w-4 h-4 rounded-full bg-[#1d9bf0] text-white text-[10px] font-bold">✓</span>;
  if (p.badge === "media") return <span className="text-[10px] px-1.5 rounded bg-[#eff3f4] text-[#536471] font-semibold">Média</span>;
  return null;
}

/** Vrai ou fake, une publication à la fois dans un téléphone : profils, liens vers de faux sites, réactions
 *  (inspiré de The Misinformation Game, CC BY 4.0). La réponse se donne dans le panneau à côté. */
export function Feed({ q, value, onChange }: { q: any; value: any; onChange: (r: any) => void }) {
  const o: FeedOptions = q.options || { posts: [] };
  const v: Record<string, string> = value?.verdicts || {};
  const reasons: Record<string, string[]> = value?.reasons || {};
  const actions: Record<string, Action[]> = value?.actions || {};
  const opened: string[] = Array.isArray(value?.opened) ? value.opened : [];
  const [ci, setCi] = useState(0);
  const [view, setView] = useState<"post" | "profil" | "site">("post");
  const save = (patch: any) => onChange({ verdicts: v, reasons, actions, opened, ...patch });
  const mark = (id: string) => { if (!opened.includes(id)) save({ opened: [...opened, id] }); };
  const cur = o.posts[ci];
  if (!cur) return null;
  const mine = actions[cur.id] || [];
  const act = (a: Action) => save({ actions: { ...actions, [cur.id]: mine.includes(a) ? mine.filter((x) => x !== a) : [...mine, a] } });
  const rs = reasons[cur.id] || [];
  const done = o.posts.filter((p) => v[p.id]).length;
  const go = (k: number) => { if (k >= 0 && k < o.posts.length) { setCi(k); setView("post"); } };
  const openProfile = () => { if (cur.profile) { setView("profil"); mark(cur.id); } };
  const openSite = () => { if (cur.link) { setView("site"); mark(`lien:${cur.id}`); } };
  const Art = cur.art ? ART[cur.art] : null;
  const domain = (u: string) => (u.match(/^https?:\/\/([^/]+)/) || [])[1] || u;

  return (
    <div className="grid lg:grid-cols-[430px_1fr] gap-6 items-start">
      <div className="mx-auto w-[430px] max-w-full rounded-[2.8rem] bg-[#111] p-[11px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
        <div className="relative rounded-[2.2rem] overflow-hidden bg-white text-[#0f1419] h-[780px] flex flex-col">
          <div className="flex items-center justify-between px-7 pt-3 pb-1 text-[13px] font-semibold" aria-hidden>
            <span>09:41</span><span className="absolute left-1/2 -translate-x-1/2 top-2.5 w-28 h-7 rounded-full bg-black" /><span>📶 🔋</span>
          </div>

          {view === "site" && cur.link ? (
            <>
              <div className="px-3 py-2 bg-[#f2f2f7] border-b border-[#d1d1d6] flex items-center gap-2">
                <button type="button" className="text-[#007aff] text-[15px]" onClick={() => setView("post")}>‹ Pulse</button>
                <div className="flex-1 rounded-lg bg-[#e3e3e8] px-3 py-1.5 text-[13px] text-center truncate">
                  <span aria-hidden>{cur.link.url.startsWith("https") ? "🔒 " : "⚠️ "}</span><b>{domain(cur.link.url)}</b><span className="text-[#8e8e93]">{cur.link.url.replace(/^https?:\/\/[^/]+/, "")}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {cur.link.site ? <SitePage site={cur.link.site} url={cur.link.url} /> : <div className="p-6 text-center text-[#666]">Page indisponible</div>}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center px-4 py-2.5 border-b border-[#eff3f4]">
                {view === "profil" ? <button type="button" className="text-[22px] mr-3" onClick={() => setView("post")} aria-label="Retour à la publication">←</button>
                  : <span className="w-8 h-8 rounded-full bg-[#ff6b00] text-white grid place-items-center text-sm font-bold mr-3" aria-hidden>P</span>}
                <span className="font-bold text-[18px]">{view === "profil" ? cur.author : "Pulse"}</span>
                {view === "post" && <span className="ml-auto text-[13px] text-[#536471]">Publication {ci + 1}/{o.posts.length}</span>}
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {view === "profil" && cur.profile ? (
                  <div>
                    <div className="h-24 bg-gradient-to-r from-[#cfd9de] to-[#e7ecef]" />
                    <div className="px-4 -mt-8"><Avatar p={cur} big /></div>
                    <div className="px-4 pt-2 pb-3 border-b border-[#eff3f4]">
                      <div className="font-bold text-[20px] flex items-center gap-1.5">{cur.author} <Badge p={cur} /></div>
                      <div className="text-[15px] text-[#536471]">{cur.handle}</div>
                      {cur.profile.bio && <p className="mt-2 text-[15px]">{cur.profile.bio}</p>}
                      <div className="mt-2 text-[14px] text-[#536471]">📅 A rejoint Pulse {cur.profile.created}</div>
                      <div className="mt-1.5 text-[14px] text-[#536471] flex gap-4">
                        {cur.profile.following && <span><b className="text-[#0f1419]">{cur.profile.following}</b> abonnements</span>}
                        <span><b className="text-[#0f1419]">{cur.profile.followers}</b> abonnés</span>
                      </div>
                    </div>
                    <div className="flex text-[15px] font-semibold border-b border-[#eff3f4]"><span className="flex-1 text-center py-3 border-b-4 border-[#1d9bf0]">Publications</span><span className="flex-1 text-center py-3 text-[#536471]">Réponses</span><span className="flex-1 text-center py-3 text-[#536471]">Médias</span></div>
                    {[{ date: cur.date, text: cur.text }, ...(cur.profile.posts || [])].map((x, k) => (
                      <div key={k} className="flex gap-3 px-4 py-3 border-b border-[#eff3f4]">
                        <Avatar p={cur} />
                        <div className="min-w-0 text-[15px]"><div><b>{cur.author}</b> <span className="text-[#536471]">· {x.date}</span></div><p className="whitespace-pre-wrap leading-snug">{x.text}</p></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <article className="px-4 py-4">
                    <div className="flex gap-3 items-center">
                      <button type="button" onClick={openProfile} disabled={!cur.profile} aria-label={`Profil de ${cur.author}`}><Avatar p={cur} /></button>
                      <div className="min-w-0">
                        <button type="button" onClick={openProfile} disabled={!cur.profile} className="font-bold text-[16px] hover:underline flex items-center gap-1">{cur.author} <Badge p={cur} /></button>
                        <div className="text-[14px] text-[#536471] truncate">{cur.handle} · {cur.date}</div>
                      </div>
                      <span className="ml-auto text-[20px] text-[#536471]" aria-hidden>⋯</span>
                    </div>
                    <p className="mt-3 text-[17px] whitespace-pre-wrap leading-[1.45]">{cur.text}</p>
                    {!cur.link && (Art || cur.image) && (
                      <div className="mt-3 rounded-2xl border border-[#cfd9de] overflow-hidden">{Art ? <Art /> : <div className="aspect-[16/9] grid place-items-center bg-[#eff3f4] text-[13px] text-[#536471] px-6 text-center">🖼️ {cur.image}</div>}</div>
                    )}
                    {cur.link && (
                      <button type="button" onClick={openSite} className="mt-3 w-full text-left rounded-2xl border border-[#cfd9de] overflow-hidden hover:bg-[#f7f9f9]">
                        {Art ? <Art /> : <div className="h-24 bg-[#eff3f4] grid place-items-center text-2xl" aria-hidden>🔗</div>}
                        <div className="px-3 py-2.5 border-t border-[#cfd9de]"><div className="text-[13px] text-[#536471]">{domain(cur.link.url)}</div><div className="text-[15px] leading-5">{cur.link.title}</div></div>
                      </button>
                    )}
                    {cur.stats && <div className="mt-3 text-[14px] text-[#536471]">{cur.stats}</div>}
                    <div className="mt-2 pt-2 border-t border-[#eff3f4] flex items-center justify-around text-[14px] text-[#536471]">
                      {ACTIONS.map(([a, l]) => (
                        <button key={a} type="button" aria-pressed={mine.includes(a)} onClick={() => act(a)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${mine.includes(a) ? (a === "like" ? "text-[#f91880] bg-[#f91880]/10" : a === "share" ? "text-[#00ba7c] bg-[#00ba7c]/10" : "text-[#f4212e] bg-[#f4212e]/10") : "hover:bg-[#eff3f4]"}`}>
                          <span className="text-[18px]" aria-hidden>{a === "like" ? (mine.includes(a) ? "♥" : "♡") : a === "share" ? "⟲" : "⚑"}</span>{l}
                        </button>
                      ))}
                    </div>
                    {(cur.profile || cur.link) && <p className="mt-4 text-center text-[12px] text-[#8b98a5]">{cur.profile ? "Touchez le nom pour voir le profil" : ""}{cur.profile && cur.link ? " · " : ""}{cur.link ? "touchez l'aperçu pour ouvrir le lien" : ""}</p>}
                  </article>
                )}
              </div>
            </>
          )}
          <div className="flex justify-around py-3 border-t border-[#eff3f4] text-[22px] text-[#0f1419] bg-white" aria-hidden><span>⌂</span><span>⌕</span><span>🔔</span><span>✉</span></div>
        </div>
      </div>

      <div className="lg:sticky lg:top-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-line overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: `${(100 * done) / o.posts.length}%` }} /></div>
          <span className="text-sm text-muted whitespace-nowrap">{done}/{o.posts.length} jugées</span>
        </div>
        <div className="rounded-xl border border-line bg-surface-2/60 p-5 space-y-5">
          <div className="text-xs uppercase tracking-wider text-muted">Publication {ci + 1} sur {o.posts.length} · {cur.author}</div>
          <div>
            <div className="text-base font-semibold mb-2">Cette publication est…</div>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Votre avis sur la publication de ${cur.author}`}>
              {VERDICTS.map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={v[cur.id] === k} onClick={() => save({ verdicts: { ...v, [cur.id]: k } })}
                  className={`py-3 rounded-lg border-2 text-base font-semibold ${v[cur.id] === k ? (k === "fiable" ? "border-ok bg-ok/20 text-fg" : k === "faux" ? "border-danger bg-danger/20 text-fg" : "border-warn bg-warn/20 text-fg") : "border-line text-muted hover:text-fg hover:border-line-strong"}`}>
                  {k === "fiable" ? "✅ " : k === "faux" ? "❌ " : "⚠️ "}{l}
                </button>
              ))}
            </div>
          </div>
          {o.ask_reason && v[cur.id] && (
            <div>
              <div className="text-base font-semibold mb-2">Pourquoi ? <span className="text-sm font-normal text-muted">Cochez ce qui vous a guidé</span></div>
              <div className="flex flex-wrap gap-2">
                {REASONS.map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={rs.includes(k)} onClick={() => save({ reasons: { ...reasons, [cur.id]: rs.includes(k) ? rs.filter((x) => x !== k) : [...rs, k] } })}
                    className={`px-3 py-1.5 rounded-full border text-sm ${rs.includes(k) ? "border-accent bg-accent text-white" : "border-line text-muted hover:text-fg"}`}>{rs.includes(k) ? "✓ " : ""}{l}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-secondary" disabled={ci === 0} onClick={() => go(ci - 1)}>‹ Précédente</button>
            <button type="button" className="btn ml-auto" disabled={ci >= o.posts.length - 1} onClick={() => go(ci + 1)}>Publication suivante ›</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Aller à une publication">
          {o.posts.map((p, k) => (
            <button key={p.id} type="button" onClick={() => go(k)} aria-label={`Publication ${k + 1}`}
              className={`w-8 h-8 rounded-md text-xs font-bold border ${k === ci ? "border-accent bg-accent text-white" : v[p.id] ? "border-ok/60 bg-ok/15 text-ok" : "border-line text-muted hover:text-fg"}`}>{k + 1}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
