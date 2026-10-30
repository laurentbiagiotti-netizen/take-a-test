"use client";
import { useEffect, useRef, useState } from "react";

export type TermResult = { output?: string; cwd?: string; prompt?: string; clear?: boolean; error?: string };

/**
 * Terminal affiché dans le navigateur. Il n'exécute RIEN localement : chaque
 * commande est envoyée au serveur (fonction `run`), qui l'interprète sur un
 * système de fichiers simulé et renvoie uniquement la sortie.
 */
export default function Terminal({ run, initialCwd, initialPrompt, motd, height = 320 }: {
  run: (command: string, cwd: string) => Promise<TermResult>;
  initialCwd: string;
  initialPrompt: string;
  motd?: string | null;
  height?: number;
}) {
  const [lines, setLines] = useState<{ kind: "in" | "out" | "err"; text: string }[]>(motd ? [{ kind: "out", text: motd }] : []);
  const [cwd, setCwd] = useState(initialCwd);
  const [prompt, setPrompt] = useState(initialPrompt);
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
    setLines((l) => [...l, { kind: "in", text: `${prompt} ${cmd}` }]);
    if (!cmd.trim()) return;
    setHistory((h) => [...h.slice(-99), cmd]);
    if (cmd.trim() === "clear") { setLines([]); return; }
    setBusy(true);
    const r = await run(cmd, cwd).catch(() => ({ error: "Connexion au serveur impossible." }) as TermResult);
    setBusy(false);
    if (r.clear) { setLines([]); }
    else if (r.error) setLines((l) => [...l, { kind: "err", text: r.error! }]);
    else if (r.output) setLines((l) => [...l, { kind: "out", text: r.output! }]);
    if (r.cwd) setCwd(r.cwd);
    if (r.prompt) setPrompt(r.prompt);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); if (!busy) submit(); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const i = hIdx === null ? history.length - 1 : Math.max(0, hIdx - 1);
      setHIdx(i); setValue(history[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hIdx === null) return;
      const i = hIdx + 1;
      if (i >= history.length) { setHIdx(null); setValue(""); } else { setHIdx(i); setValue(history[i]); }
    } else if (e.key.toLowerCase() === "l" && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };

  return (
    <div className="rounded-lg border border-line bg-[#05070d] font-mono text-[13px] leading-relaxed"
      onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-line text-xs text-faint">
        <span>terminal</span>
        <span className="text-ok">● connecté</span>
      </div>
      <div ref={boxRef} className="px-3 py-2 overflow-y-auto" style={{ height }}>
        {lines.map((l, i) => (
          <pre key={i} className={`whitespace-pre-wrap break-words ${l.kind === "in" ? "text-fg" : l.kind === "err" ? "text-danger" : "text-[#c9d1e3]"}`}>{l.text}</pre>
        ))}
        <div className="flex items-center gap-2">
          <span className="text-ok shrink-0">{prompt}</span>
          <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onKey}
            className="flex-1 bg-transparent outline-none text-fg caret-accent" spellCheck={false}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" maxLength={500} disabled={busy}
            aria-label="Commande" />
        </div>
      </div>
    </div>
  );
}
