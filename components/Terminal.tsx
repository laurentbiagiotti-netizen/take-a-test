"use client";
import { useEffect, useRef, useState } from "react";

export type Objective = { id: string; title: string; done: boolean };
export type TermResult = { output?: string; prompt?: string; clear?: boolean; error?: string; objectives?: Objective[] };

/**
 * Terminal affiché dans le navigateur. Il n'exécute RIEN localement : chaque
 * commande part au serveur, qui l'exécute sur la machine simulée du candidat
 * et renvoie la sortie, le prompt et l'état des missions.
 */
export default function Terminal({ run, initialPrompt, motd, initialObjectives = [], height = 360 }: {
  run: (command: string) => Promise<TermResult>;
  initialPrompt: string;
  motd?: string | null;
  initialObjectives?: Objective[];
  height?: number;
}) {
  const [lines, setLines] = useState<{ kind: "in" | "out" | "err"; text: string }[]>(motd ? [{ kind: "out", text: motd }] : []);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [objectives, setObjectives] = useState<Objective[]>(initialObjectives);
  const [flash, setFlash] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }, [lines, busy]);

  const submit = async () => {
    const cmd = value;
    setValue(""); setHIdx(null);
    setLines((l) => [...l.slice(-400), { kind: "in", text: `${prompt} ${cmd}` }]);
    if (!cmd.trim()) return;
    setHistory((h) => [...h.slice(-99), cmd]);
    setBusy(true);
    const r = await run(cmd).catch(() => ({ error: "Connexion au serveur impossible." }) as TermResult);
    setBusy(false);
    if (r.clear) setLines([]);
    else if (r.error) setLines((l) => [...l, { kind: "err", text: r.error! }]);
    else if (r.output) setLines((l) => [...l, { kind: "out", text: r.output! }]);
    if (r.prompt) setPrompt(r.prompt);
    if (r.objectives) {
      const newly = r.objectives.find((o) => o.done && !objectives.find((x) => x.id === o.id)?.done);
      if (newly) { setFlash(newly.id); setTimeout(() => setFlash(null), 1800); }
      setObjectives(r.objectives);
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); if (!busy) submit(); }
    else if (e.key === "ArrowUp") {
      e.preventDefault(); if (!history.length) return;
      const i = hIdx === null ? history.length - 1 : Math.max(0, hIdx - 1);
      setHIdx(i); setValue(history[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault(); if (hIdx === null) return;
      const i = hIdx + 1;
      if (i >= history.length) { setHIdx(null); setValue(""); } else { setHIdx(i); setValue(history[i]); }
    } else if (e.key.toLowerCase() === "l" && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };

  const done = objectives.filter((o) => o.done).length;

  return (
    <div className={objectives.length ? "grid lg:grid-cols-[1fr_260px] gap-3" : ""}>
      <div className="rounded-lg border border-line bg-[#05070d] font-mono text-[13px] leading-relaxed min-w-0" onClick={() => inputRef.current?.focus()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-line text-xs text-faint">
          <span>terminal</span>
          <span className={busy ? "text-warn" : "text-ok"}>● {busy ? "exécution…" : "connecté"}</span>
        </div>
        <div ref={boxRef} className="px-3 py-2 overflow-y-auto" style={{ height }}>
          {lines.map((l, i) => (
            <pre key={i} className={`whitespace-pre-wrap break-words ${l.kind === "in" ? "text-fg" : l.kind === "err" ? "text-danger" : "text-[#c9d1e3]"}`}>{l.text}</pre>
          ))}
          <div className="flex items-center gap-2">
            <span className="text-ok shrink-0">{prompt}</span>
            <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onKey}
              className="flex-1 bg-transparent outline-none text-fg caret-accent min-w-0" spellCheck={false}
              autoComplete="off" autoCorrect="off" autoCapitalize="off" maxLength={500} disabled={busy} aria-label="Commande" />
          </div>
        </div>
      </div>
      {objectives.length > 0 && (
        <aside className="rounded-lg border border-line bg-surface p-4 text-sm h-fit">
          <div className="flex items-center justify-between">
            <span className="h2 !text-sm">Missions</span>
            <span className={`badge ${done === objectives.length ? "badge-ok" : "badge-muted"}`}>{done}/{objectives.length}</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${(done / objectives.length) * 100}%` }} />
          </div>
          <ul className="mt-3 space-y-2">
            {objectives.map((o) => (
              <li key={o.id} className={`flex gap-2 items-start rounded-md px-2 py-1.5 transition-colors ${flash === o.id ? "bg-ok/15" : ""}`}>
                <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${o.done ? "border-ok bg-ok text-bg" : "border-line-strong"}`}>{o.done ? "✓" : ""}</span>
                <span className={o.done ? "text-muted line-through decoration-ok/60" : "text-fg"}>{o.title}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
