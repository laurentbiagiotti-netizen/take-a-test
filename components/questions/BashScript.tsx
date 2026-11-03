"use client";
import { useMemo, useRef, useState } from "react";
import { BASH_HOME, runWith, type BashOptions, type BashRun } from "@/lib/questions/bash-task";

/**
 * Exercice « script Bash » côté candidat : éditeur, fichiers de départ, exécution dans
 * un bash simulé du navigateur (just-bash). Seul le script est envoyé ; la note est
 * calculée par le serveur, qui le relance aussi sur d'autres fichiers.
 */
export default function BashScript({ q, value, onText }: { q: any; value: any; onText: (r: any) => void }) {
  const o: BashOptions = q.options || { mission: "", files: {}, checks: [] };
  const script: string = typeof value?.script === "string" ? value.script : (o.starter || "");
  const [run, setRun] = useState<BashRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string>(Object.keys(o.files || {})[0] ? `${BASH_HOME}/${Object.keys(o.files)[0]}` : "");
  const gutter = useRef<HTMLDivElement>(null);
  const lines = Math.max(8, script.split("\n").length);

  const initial = useMemo(() => Object.fromEntries(Object.entries(o.files || {}).map(([p, v]) => [p.startsWith("/") ? p : `${BASH_HOME}/${p}`, v])), [o.files]);
  const files = run ? run.files : initial;
  const tag = (p: string) => (!run ? "" : !(p in initial) ? "nouveau" : initial[p] !== run.files[p] ? "modifié" : "");
  const gone = run ? Object.keys(initial).filter((p) => !(p in run.files)) : [];

  const exec = async () => {
    setBusy(true);
    try {
      const { Bash } = await import("just-bash/browser");
      const r = await runWith(Bash, o.files || {}, script);
      setRun(r);
      const made = Object.keys(r.files).find((p) => !(p in initial));
      if (made) setOpen(made);
    } catch { setRun({ stdout: "", stderr: "Le bash simulé n'a pas pu démarrer. Votre script est quand même enregistré et sera corrigé.", exitCode: 1, files: initial, dirs: [] }); }
    setBusy(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); exec(); return; }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const t = e.currentTarget, a = t.selectionStart, b = t.selectionEnd;
      onText({ script: script.slice(0, a) + "  " + script.slice(b) });
      requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = a + 2; });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface-2/60 p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Mission</div>
        <p className="text-sm whitespace-pre-line leading-relaxed">{o.mission}</p>
        {!!o.checks?.length && (
          <ul className="mt-3 space-y-1 text-sm">
            {o.checks.map((c, i) => <li key={i} className="flex gap-2"><span className="text-accent">○</span>{c.label}</li>)}
          </ul>
        )}
      </div>

      <div className="grid lg:grid-cols-[15rem_1fr] gap-3">
        <div className="rounded-xl border border-line bg-[#0d1117] text-[#c9d1d9] font-mono text-xs overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 text-[11px] text-white/50">~ (/home/user)</div>
          <ul className="py-1 max-h-72 overflow-auto" aria-label="Fichiers">
            {Object.keys(files).sort().map((p) => (
              <li key={p}>
                <button type="button" onClick={() => setOpen(p)} className={`w-full text-left px-3 py-1 flex items-center gap-2 hover:bg-white/5 ${open === p ? "bg-white/10 text-white" : ""}`}>
                  <span className="truncate">{p.startsWith(BASH_HOME + "/") ? p.slice(BASH_HOME.length + 1) : p}</span>
                  {tag(p) && <span className={`ml-auto shrink-0 text-[10px] px-1.5 rounded ${tag(p) === "nouveau" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>{tag(p)}</span>}
                </button>
              </li>
            ))}
            {gone.map((p) => <li key={p} className="px-3 py-1 text-white/30 line-through">{p.slice(BASH_HOME.length + 1)}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-[#0d1117] overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 text-[11px] text-white/50 font-mono">{open ? open.replace(BASH_HOME + "/", "") : "aucun fichier"} · lecture seule</div>
          <pre className="p-3 text-xs font-mono text-[#c9d1d9] max-h-72 overflow-auto whitespace-pre">{open ? files[open] ?? "" : ""}</pre>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-[#0d1117] overflow-hidden">
        <div className="px-3 py-2 border-b border-white/10 text-[11px] text-white/50 font-mono flex items-center">script.sh
          <span className="ml-auto">Tab = indentation · Ctrl + Entrée = exécuter</span>
        </div>
        <div className="flex">
          <div ref={gutter} aria-hidden className="select-none text-right pr-2 pl-3 py-3 text-xs font-mono leading-5 text-white/30 overflow-hidden" style={{ maxHeight: "20rem" }}>
            {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
          </div>
          <textarea aria-label="Votre script Bash" spellCheck={false} autoComplete="off" autoCapitalize="off" maxLength={8000}
            className="flex-1 bg-transparent text-[#e6edf3] font-mono text-xs leading-5 py-3 pr-3 outline-none resize-none caret-[#ff7a1a]"
            style={{ height: `${Math.min(20, lines * 1.25 + 1.5)}rem` }}
            value={script} onChange={(e) => onText({ script: e.target.value })} onKeyDown={onKey}
            onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" onClick={exec} disabled={busy || !script.trim()}>{busy ? "Exécution…" : "▶ Exécuter le script"}</button>
        {run && <button type="button" className="btn-secondary" onClick={() => { setRun(null); setOpen(Object.keys(initial)[0] || ""); }}>Revenir aux fichiers de départ</button>}
        <span className="text-xs text-faint">Chaque exécution repart des fichiers de départ. Seule la dernière version du script compte.</span>
      </div>

      {run && (
        <div className="rounded-xl border border-line bg-black text-xs font-mono overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 text-[11px] text-white/50 flex">Sortie du script<span className="ml-auto">code de retour {run.exitCode}</span></div>
          <pre className="p-3 max-h-60 overflow-auto whitespace-pre-wrap text-[#c9d1d9]">{run.stdout || <span className="text-white/30">(rien n&apos;a été affiché)</span>}</pre>
          {run.stderr && <pre className="px-3 pb-3 whitespace-pre-wrap text-red-300">{run.stderr}</pre>}
        </div>
      )}
    </div>
  );
}
