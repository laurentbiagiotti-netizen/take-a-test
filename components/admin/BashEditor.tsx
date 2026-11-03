"use client";
import { useState } from "react";
import type { BashCheck } from "@/lib/questions/bash-task";

const KIND: [BashCheck["kind"], string][] = [
  ["file", "Fichier produit identique à la référence"], ["stdout", "Affichage identique à la référence"],
  ["tree", "Contenu d'un dossier identique"], ["exists", "Le fichier ou dossier existe"],
  ["absent", "Le fichier ou dossier n'existe plus"], ["contains", "L'affichage contient un texte"],
];
const COMPARE: [string, string][] = [["lines", "lignes (espaces ignorés)"], ["exact", "à l'identique"], ["sorted", "dans n'importe quel ordre"]];

function FilesEditor({ files, onChange, label }: { files: Record<string, string>; onChange: (f: Record<string, string>) => void; label: string }) {
  const entries = Object.entries(files);
  const setAt = (i: number, p: string, v: string) => onChange(Object.fromEntries(entries.map(([a, b], j) => (j === i ? [p, v] : [a, b]))));
  return (
    <div className="space-y-2">
      <div className="text-sm">{label}</div>
      {entries.map(([p, v], i) => (
        <div key={i} className="rounded border border-line p-2 space-y-1">
          <div className="flex gap-2">
            <input className="input font-mono text-xs flex-1" value={p} placeholder="logs/auth.log" onChange={(e) => setAt(i, e.target.value, v)} aria-label="Chemin du fichier" />
            <button className="btn-secondary !py-1 text-xs" onClick={() => onChange(Object.fromEntries(entries.filter((_, j) => j !== i)))}>Retirer</button>
          </div>
          <textarea className="input font-mono text-xs min-h-[70px]" value={v} onChange={(e) => setAt(i, p, e.target.value)} aria-label={`Contenu de ${p}`} />
        </div>
      ))}
      <button className="btn-secondary !py-1 text-xs" onClick={() => onChange({ ...files, [`fichier${entries.length + 1}.txt`]: "" })}>+ Fichier</button>
    </div>
  );
}

/** Formulaire de l'exercice « script Bash » : fichiers de départ, script de référence, vérifications, jeux cachés. */
export default function BashEditor({ o, k, set }: { o: any; k: any; set: (o: any, k: any) => void }) {
  const checks: BashCheck[] = k.checks || [];
  const variants: Record<string, string>[] = k.variants || [];
  const [test, setTest] = useState<string>("");
  const setChecks = (cs: BashCheck[]) => set({ ...o, checks: cs.map((c) => ({ label: c.label })) }, { ...k, checks: cs });
  const setCheck = (i: number, c: Partial<BashCheck>) => setChecks(checks.map((x, j) => (j === i ? { ...x, ...c } : x)));

  const tryRef = async () => {
    setTest("Exécution…");
    const [{ Bash }, { runWith }] = await Promise.all([import("just-bash/browser"), import("@/lib/questions/bash-task")]);
    const r = await runWith(Bash, o.files || {}, k.solution || "");
    const made = Object.keys(r.files).filter((p) => !(p.replace("/home/user/", "") in (o.files || {})));
    setTest([`Affichage :\n${r.stdout || "(rien)"}`, r.stderr && `Erreurs :\n${r.stderr}`, made.length && `Fichiers créés : ${made.join(", ")}`].filter(Boolean).join("\n\n"));
  };

  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <label className="block text-sm">Mission affichée au candidat
        <textarea className="input mt-1 min-h-[110px]" value={o.mission || ""} onChange={(e) => set({ ...o, mission: e.target.value }, k)} />
      </label>
      <FilesEditor label="Fichiers de départ (chemins relatifs au dossier personnel /home/user)" files={o.files || {}} onChange={(f) => set({ ...o, files: f }, k)} />
      <label className="block text-sm">Début de script proposé (facultatif)
        <textarea className="input mt-1 font-mono text-xs min-h-[50px]" value={o.starter || ""} onChange={(e) => set({ ...o, starter: e.target.value }, k)} />
      </label>
      <label className="block text-sm">Script de référence (jamais envoyé au candidat)
        <textarea className="input mt-1 font-mono text-xs min-h-[90px]" value={k.solution || ""} onChange={(e) => set(o, { ...k, solution: e.target.value })} />
      </label>
      <div className="flex items-start gap-3">
        <button className="btn-secondary !py-1 text-xs" onClick={tryRef}>Tester la référence</button>
        {test && <pre className="text-xs bg-black/40 rounded p-2 flex-1 whitespace-pre-wrap max-h-48 overflow-auto">{test}</pre>}
      </div>

      <div className="space-y-2">
        <div className="text-sm">Vérifications (chacune rapporte une part égale des points)</div>
        {checks.map((c, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-[2fr_1.6fr_1fr_1fr_auto] items-center">
            <input className="input text-xs" value={c.label} placeholder="Libellé vu par le candidat" onChange={(e) => setCheck(i, { label: e.target.value })} aria-label="Libellé" />
            <select className="input text-xs" value={c.kind} onChange={(e) => setCheck(i, { kind: e.target.value as BashCheck["kind"] })} aria-label="Type de vérification">
              {KIND.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {c.kind === "contains"
              ? <input className="input text-xs" value={c.value || ""} placeholder="texte attendu" onChange={(e) => setCheck(i, { value: e.target.value })} aria-label="Texte attendu" />
              : <input className="input text-xs font-mono" value={c.path || ""} placeholder={c.kind === "stdout" ? "(sans objet)" : "rapport.txt"} disabled={c.kind === "stdout"} onChange={(e) => setCheck(i, { path: e.target.value })} aria-label="Chemin" />}
            <select className="input text-xs" value={c.compare || "lines"} disabled={!["file", "stdout"].includes(c.kind)} onChange={(e) => setCheck(i, { compare: e.target.value as BashCheck["compare"] })} aria-label="Comparaison">
              {COMPARE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="btn-secondary !py-1 text-xs" onClick={() => setChecks(checks.filter((_, j) => j !== i))}>Retirer</button>
          </div>
        ))}
        <button className="btn-secondary !py-1 text-xs" onClick={() => setChecks([...checks, { label: "", kind: "file", path: "", compare: "lines" }])}>+ Vérification</button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted">Jeux de fichiers cachés : le script du candidat et la référence y sont aussi lancés. Ils remplacent ou complètent les fichiers de départ. Une vérification n&apos;est validée que si elle passe partout : recopier les résultats à la main ne suffit pas.</p>
        {variants.map((v, i) => (
          <div key={i} className="rounded border border-dashed border-line-strong p-2">
            <FilesEditor label={`Jeu caché ${i + 1}`} files={v} onChange={(f) => set(o, { ...k, variants: variants.map((x, j) => (j === i ? f : x)) })} />
            <button className="btn-secondary !py-1 text-xs mt-2" onClick={() => set(o, { ...k, variants: variants.filter((_, j) => j !== i) })}>Retirer ce jeu</button>
          </div>
        ))}
        <button className="btn-secondary !py-1 text-xs" onClick={() => set(o, { ...k, variants: [...variants, { ...(o.files || {}) }] })}>+ Jeu caché (copie des fichiers de départ, à modifier)</button>
      </div>
    </div>
  );
}
