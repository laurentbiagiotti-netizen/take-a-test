"use client";
import { useEffect, useMemo, useRef } from "react";
import { HEADER_QUESTIONS, hops, summary, type HeaderField } from "@/lib/questions/headers";
import { basicProblem, FIELD_LABEL, vlsmProblem, type SubnetOptions } from "@/lib/questions/subnet";
import { connected, makeGrid, shown, solved } from "@/lib/questions/netpuzzle";
import { seedOf } from "@/lib/questions/seed";

/* ---------------- En-têtes de mail ---------------- */

export function HeadersQuestion({ q, value, onText, onChange }: { q: any; value: any; onText: (r: any) => void; onChange: (r: any) => void }) {
  const o = q.options || {};
  const raw: string = o.raw || "";
  const f = value?.fields || {};
  const s = useMemo(() => summary(raw), [raw]);
  const hs = useMemo(() => hops(raw), [raw]);
  const ask: HeaderField[] = o.ask || [];
  const set = (k: string, v: string, typed = false) => (typed ? onText : onChange)({ fields: { ...f, [k]: v } });

  return (
    <div className="space-y-4">
      {o.view === "table" ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-line overflow-hidden">
            <div className="px-3 py-2 bg-surface-2 text-[11px] uppercase tracking-wider text-muted">Résumé du message</div>
            <dl className="grid grid-cols-[8rem_1fr] text-sm">
              {[["Expéditeur (From)", s.from], ["Répondre à (Reply-To)", s.replyTo], ["Retour (Return-Path)", s.returnPath], ["Objet", s.subject], ["Date", s.date]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="contents"><dt className="px-3 py-1.5 text-muted border-t border-line">{k}</dt><dd className="px-3 py-1.5 font-mono text-xs border-t border-line break-all">{v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="rounded-lg border border-line overflow-auto">
            <div className="px-3 py-2 bg-surface-2 text-[11px] uppercase tracking-wider text-muted">Trajet du message, du premier serveur au dernier</div>
            <table className="w-full text-xs font-mono">
              <thead><tr className="text-muted">{["Saut", "Depuis", "Reçu par", "IP", "Délai"].map((h) => <th key={h} className="text-left px-3 py-1.5 font-normal">{h}</th>)}</tr></thead>
              <tbody>{hs.map((h) => (
                <tr key={h.n} className="border-t border-line"><td className="px-3 py-1.5">{h.n}</td><td className="px-3 break-all">{h.from}</td><td className="px-3 break-all">{h.by}</td><td className="px-3">{h.ip || "-"}</td><td className="px-3">{h.delay_s === null ? "-" : `${h.delay_s} s`}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {s.auth && <div className="rounded-lg border border-line p-3"><div className="text-[11px] uppercase tracking-wider text-muted mb-1">Authentication-Results</div><pre className="text-xs font-mono whitespace-pre-wrap break-all">{s.auth}</pre></div>}
        </div>
      ) : (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted mb-1">En-têtes bruts du message</div>
          <pre className="text-xs font-mono whitespace-pre-wrap break-all rounded-lg bg-bg border border-line p-3 max-h-80 overflow-auto leading-relaxed">{raw}</pre>
        </div>
      )}
      <div className="grid gap-3">
        {ask.map((k) => {
          const meta = HEADER_QUESTIONS[k];
          return (
            <div key={k} className="rounded-lg border border-line bg-surface-2/50 p-3">
              <div className="text-sm font-medium">{meta.label}</div>
              {meta.choices ? (
                <div className="flex flex-wrap gap-2 mt-2" role="radiogroup" aria-label={meta.label}>
                  {meta.choices.map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={f[k] === v} onClick={() => set(k, v)}
                      className={`px-3 py-1.5 rounded-md border text-sm ${f[k] === v ? "border-accent bg-accent/15 text-fg" : "border-line text-muted hover:text-fg"}`}>{l}</button>
                  ))}
                </div>
              ) : (
                <input className="input mt-2 font-mono" maxLength={60} placeholder="ex. 203.0.113.10" autoComplete="off" spellCheck={false}
                  value={f[k] || ""} onChange={(e) => set(k, e.target.value, true)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Sous-réseaux ---------------- */

export function SubnetQuestion({ q, value, onText }: { q: any; value: any; onText: (r: any) => void }) {
  const o: SubnetOptions = q.options || { mode: "basic" };
  const seed = seedOf(q.seed || "apercu", q.id);
  if (o.mode === "vlsm") {
    const pb = vlsmProblem(seed, o);
    const sub = value?.subnets || {};
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm">
          Bloc attribué à l&apos;école : <b className="font-mono text-base">{pb.block}</b>. Découpez-le pour que chaque service ait le plus petit sous-réseau qui suffit, sans chevauchement.
        </div>
        {o.help && <p className="text-xs text-muted">Rappel : un /n contient 2^(32-n) adresses, dont 2 réservées (réseau et broadcast). Commencez par le plus gros besoin.</p>}
        <div className="grid gap-2">
          {pb.services.map((s) => (
            <label key={s.id} className="grid sm:grid-cols-[1fr_14rem] items-center gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-sm">
              <span><b>{s.name}</b> <span className="text-muted">: {s.hosts} machines</span></span>
              <input className="input font-mono !py-1.5" placeholder="192.168.x.y/zz" maxLength={20} autoComplete="off" spellCheck={false}
                value={sub[s.id] || ""} onChange={(e) => onText({ subnets: { ...sub, [s.id]: e.target.value } })} />
            </label>
          ))}
        </div>
      </div>
    );
  }
  const pb = basicProblem(seed, o);
  const f = value?.fields || {};
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-center">
        <div className="text-xs text-muted">Adresse de la machine</div>
        <div className="font-mono text-2xl mt-1">{pb.ip}<span className="text-accent">/{pb.prefix}</span></div>
      </div>
      {o.help && (
        <details className="rounded-lg border border-line p-3 text-sm">
          <summary className="cursor-pointer text-muted">Besoin d&apos;un rappel ? (lisez-le, il suffit pour répondre)</summary>
          <div className="mt-2 space-y-1.5 text-fg/90">
            <p>Une adresse IPv4 compte 32 bits. Le « /{pb.prefix} » dit que les {pb.prefix} premiers bits désignent le réseau ; les {32 - pb.prefix} derniers désignent la machine.</p>
            <p>Le réseau contient donc 2^{32 - pb.prefix} = {2 ** (32 - pb.prefix)} adresses. La première est l&apos;adresse du réseau, la dernière le broadcast ; les autres sont utilisables.</p>
            <p>Exemple : 192.168.1.77/26 → blocs de 64 adresses (0, 64, 128, 192) → réseau 192.168.1.64, broadcast 192.168.1.127.</p>
          </div>
        </details>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {pb.ask.map((k) => (
          <label key={k} className="block text-sm">{FIELD_LABEL[k]}
            <input className="input mt-1 font-mono" maxLength={20} autoComplete="off" spellCheck={false} inputMode={k === "hosts" ? "numeric" : "decimal"}
              value={f[k] || ""} onChange={(e) => onText({ fields: { ...f, [k]: e.target.value } })} />
          </label>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Puzzle réseau (jeu « Net ») ---------------- */

const S = 52;
function Tile({ m, on, center, done }: { m: number; on: boolean; center: boolean; done: boolean }) {
  const c = S / 2, col = done ? "#34d399" : on ? "#fd7119" : "#7c859b";
  const ends: [number, number][] = [[c, 0], [S, c], [c, S], [0, c]];
  const leaf = [1, 2, 4, 8].filter((b) => m & b).length === 1;
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
      {[1, 2, 4, 8].map((b, i) => (m & b ? <line key={b} x1={c} y1={c} x2={ends[i][0]} y2={ends[i][1]} stroke={col} strokeWidth={6} strokeLinecap="square" /> : null))}
      {center ? <rect x={c - 11} y={c - 11} width={22} height={22} rx={4} fill={col} />
        : leaf ? <rect x={c - 8} y={c - 7} width={16} height={12} rx={2} fill="#0b0e16" stroke={col} strokeWidth={3} />
        : <circle cx={c} cy={c} r={4} fill={col} />}
    </svg>
  );
}

export function NetPuzzle({ q, value, onText }: { q: any; value: any; onText: (r: any) => void }) {
  const g = useMemo(() => makeGrid(seedOf(q.seed || "apercu", q.id), q.options || {}), [q.seed, q.id, q.options]);
  const rot: number[] = Array.isArray(value?.rot) && value.rot.length === g.tiles.length ? value.rot : new Array(g.tiles.length).fill(0);
  const cur = shown(g, rot);
  const on = connected(g, cur);
  const done = solved(g, cur);
  const t0 = useRef(Date.now() - (value?.ms || 0));
  useEffect(() => { t0.current = Date.now() - (value?.ms || 0); }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const turn = (i: number, dir: 1 | -1) => {
    if (done || i === -1) return;
    const next = rot.slice(); next[i] = (((next[i] || 0) + dir) % 4 + 4) % 4;
    onText({ rot: next, moves: (value?.moves || 0) + 1, ms: Date.now() - t0.current });
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Tournez les tuiles (clic : sens horaire, Maj + clic : sens inverse) pour relier <b className="text-fg">tous les postes</b> au serveur central, sans aucun câble dans le vide.</p>
      <div className="flex flex-wrap items-start gap-6">
        <div className="inline-grid rounded-xl border border-line bg-bg p-2" style={{ gridTemplateColumns: `repeat(${g.w}, ${S}px)` }} role="grid" aria-label="Grille du puzzle réseau">
          {cur.map((m, i) => (
            <button key={i} type="button" className="rounded-md hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent" style={{ width: S, height: S }}
              aria-label={`Tuile ${Math.floor(i / g.w) + 1}-${(i % g.w) + 1}${on.has(i) ? ", reliée" : ""}`} disabled={done}
              onClick={(e) => turn(i, e.shiftKey ? -1 : 1)}>
              <Tile m={m} on={on.has(i)} center={i === g.center} done={done} />
            </button>
          ))}
        </div>
        <div className="text-sm space-y-1.5 min-w-[10rem]">
          <div><span className="text-muted">Postes reliés :</span> <b>{on.size - 1}</b> / {g.tiles.length - 1}</div>
          <div><span className="text-muted">Rotations :</span> {value?.moves || 0}</div>
          {done && <div className="text-ok font-semibold mt-2" role="status">Réseau complet, bravo. Validez pour continuer.</div>}
        </div>
      </div>
    </div>
  );
}
