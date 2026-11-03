"use client";
import { useMemo, useRef, useState } from "react";
import AppWindow from "@/components/questions/AppWindow";
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

  const rel = (p: string) => (p.startsWith(BASH_HOME + "/") ? p.slice(BASH_HOME.length + 1) : p);
  const [tab, setTab] = useState<string>("script");
  const viewing = tab !== "script" ? tab : "";

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

      <AppWindow title="script.sh · srv-web (SSH)" dark bodyClass="bg-[#1e1e1e] text-[#cccccc] text-[12.5px]">
        <div className="flex">
          <div className="w-11 bg-[#333333] flex flex-col items-center gap-4 py-3 text-[18px] text-white/40 max-sm:hidden" aria-hidden><span className="text-white/90">❐</span><span>⌕</span><span>⑂</span><span>⚙</span></div>
          <div className="w-52 bg-[#252526] border-r border-black/30 max-sm:hidden">
            <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-white/50">Explorateur</div>
            <div className="px-3 py-1 text-[11px] font-semibold uppercase text-white/70">▾ user</div>
            <ul aria-label="Fichiers">
              <li><button type="button" onClick={() => setTab("script")} className={`w-full text-left pl-6 pr-2 py-0.5 flex items-center gap-1.5 ${tab === "script" ? "bg-[#37373d] text-white" : "hover:bg-white/5"}`}><span className="text-[#89e051]">$</span>script.sh</button></li>
              {Object.keys(files).sort().map((p) => (
                <li key={p}>
                  <button type="button" onClick={() => setTab(p)} className={`w-full text-left pl-6 pr-2 py-0.5 flex items-center gap-1.5 ${tab === p ? "bg-[#37373d] text-white" : "hover:bg-white/5"}`}>
                    <span className="text-[#519aba]" aria-hidden>≡</span><span className={`truncate ${tag(p) === "nouveau" ? "text-[#73c991]" : tag(p) === "modifié" ? "text-[#e2c08d]" : ""}`}>{rel(p)}</span>
                    {tag(p) && <span className={`ml-auto text-[10px] ${tag(p) === "nouveau" ? "text-[#73c991]" : "text-[#e2c08d]"}`}>{tag(p) === "nouveau" ? "U" : "M"}</span>}
                  </button>
                </li>
              ))}
              {gone.map((p) => <li key={p} className="pl-6 pr-2 py-0.5 text-[#f14c4c]/70 line-through">{rel(p)} <span className="text-[10px]">D</span></li>)}
            </ul>
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-stretch bg-[#252526] text-[12px]">
              <button type="button" onClick={() => setTab("script")} className={`px-3 py-1.5 border-r border-black/30 ${tab === "script" ? "bg-[#1e1e1e] text-white border-t border-t-[#0078d4]" : "text-white/50"}`}>$ script.sh</button>
              {viewing && <span className="px-3 py-1.5 bg-[#1e1e1e] text-white border-t border-t-[#0078d4] border-r border-black/30 italic">{rel(viewing)} <span className="text-white/40 not-italic">(lecture seule)</span></span>}
              <button type="button" onClick={exec} disabled={busy || !script.trim()} title="Exécuter (Ctrl + Entrée)" className="ml-auto px-3 text-[#89d185] hover:bg-white/10 disabled:opacity-40">{busy ? "…" : "▶"} Exécuter</button>
            </div>
            {tab === "script" ? (
              <div className="flex font-mono leading-5">
                <div ref={gutter} aria-hidden className="select-none text-right pr-3 pl-3 py-2 text-[#858585] overflow-hidden" style={{ maxHeight: "18rem" }}>
                  {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
                </div>
                <textarea aria-label="Votre script Bash" wrap="off" spellCheck={false} autoComplete="off" autoCapitalize="off" maxLength={8000}
                  className="flex-1 bg-transparent text-[#d4d4d4] font-mono leading-5 py-2 pr-3 outline-none resize-none caret-[#aeafad]"
                  style={{ height: `${Math.min(18, lines * 1.25 + 1)}rem` }}
                  value={script} onChange={(e) => onText({ script: e.target.value })} onKeyDown={onKey}
                  onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }} />
              </div>
            ) : (
              <pre className="p-3 font-mono text-[#d4d4d4] overflow-auto whitespace-pre" style={{ height: "18rem" }}>{files[viewing] ?? ""}</pre>
            )}
            <div className="border-t border-[#3c3c3c]">
              <div className="flex gap-5 px-3 pt-1.5 text-[11px] uppercase tracking-wider text-white/40"><span className="text-white border-b border-white pb-1">Terminal</span><span>Problèmes</span><span>Sortie</span></div>
              <div className="px-3 py-2 font-mono text-[12px] h-40 overflow-auto whitespace-pre-wrap">
                <div><span className="text-[#89d185]">candidat@srv-web</span>:<span className="text-[#569cd6]">~</span>$ {run ? "bash script.sh" : ""}<span className="animate-pulse">{run ? "" : "▌"}</span></div>
                {run && <>
                  {run.stdout && <div className="text-[#cccccc]">{run.stdout.replace(/\n$/, "")}</div>}
                  {run.stderr && <div className="text-[#f48771]">{run.stderr.replace(/\n$/, "")}</div>}
                  {!run.stdout && !run.stderr && <div className="text-white/30">(rien n&apos;a été affiché)</div>}
                  <div><span className="text-[#89d185]">candidat@srv-web</span>:<span className="text-[#569cd6]">~</span>$ echo $?</div><div>{run.exitCode}</div>
                  <div><span className="text-[#89d185]">candidat@srv-web</span>:<span className="text-[#569cd6]">~</span>$ <span className="animate-pulse">▌</span></div>
                </>}
              </div>
            </div>
            <div className="flex gap-4 px-3 py-0.5 bg-[#007acc] text-white text-[11px]">
              <span>⎇ main</span><span>{run ? (run.exitCode === 0 ? "✓ terminé" : `✗ code ${run.exitCode}`) : "Prêt"}</span>
              <span className="ml-auto">Ln {script.split("\n").length} · Bash · UTF-8</span>
            </div>
          </div>
        </div>
      </AppWindow>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" onClick={exec} disabled={busy || !script.trim()}>{busy ? "Exécution…" : "▶ Exécuter le script"}</button>
        {run && <button type="button" className="btn-secondary" onClick={() => { setRun(null); setTab("script"); }}>Revenir aux fichiers de départ</button>}
        <span className="text-xs text-faint">Tab = indentation, Ctrl + Entrée = exécuter. Chaque exécution repart des fichiers de départ ; seule la dernière version du script compte.</span>
      </div>
    </div>
  );
}
