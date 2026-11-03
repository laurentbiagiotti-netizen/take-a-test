/**
 * Exercice « script Bash » : le candidat écrit un script, exécuté dans un bash simulé
 * (just-bash, Apache 2.0) : système de fichiers en mémoire, sans réseau ni accès au serveur.
 * La note porte sur l'état final (fichiers produits, affichage) comparé à celui du script
 * de référence, sur les fichiers visibles ET sur des jeux de fichiers cachés : recopier les
 * résultats à la main ne suffit pas.
 */

export const BASH_HOME = "/home/user";
export const BASH_LIMITS = { maxCommandCount: 20000, maxExecutionTimeMs: 2000, maxOutputSize: 200_000, maxCallDepth: 50 };
export const MAX_FILE = 20_000;

export type BashOptions = { mission: string; files: Record<string, string>; checks: { label: string }[]; starter?: string; help?: boolean };
export type BashCheck = {
  label: string;
  /** stdout / file / tree : comparés au script de référence ; contains : texte attendu ; exists / absent : chemin. */
  kind: "stdout" | "file" | "tree" | "contains" | "exists" | "absent";
  path?: string;
  compare?: "exact" | "lines" | "sorted";
  value?: string;
};
export type BashKey = { solution: string; checks: BashCheck[]; variants?: Record<string, string>[] };
export type BashRun = { stdout: string; stderr: string; exitCode: number; files: Record<string, string>; dirs: string[]; error?: string };

const KINDS = ["stdout", "file", "tree", "contains", "exists", "absent"];

export function abs(p: string) {
  const x = p.startsWith("/") ? p : `${BASH_HOME}/${p}`;
  const out: string[] = [];
  for (const s of x.split("/")) { if (!s || s === ".") continue; if (s === "..") out.pop(); else out.push(s); }
  return "/" + out.join("/");
}

export function validBash(o: any, k: any): string | null {
  if (!o || typeof o.mission !== "string" || !o.mission.trim()) return "la mission est vide";
  if (!o.files || typeof o.files !== "object" || Array.isArray(o.files)) return "« files » doit être un objet { chemin: contenu }";
  if (!Object.keys(o.files).length) return "il faut au moins un fichier de départ";
  if (Object.values(o.files).some((v) => typeof v !== "string")) return "chaque fichier doit avoir un contenu texte";
  if (!k || typeof k.solution !== "string" || !k.solution.trim()) return "le script de référence est vide";
  if (!Array.isArray(k.checks) || !k.checks.length) return "il faut au moins une vérification";
  for (const [i, c] of k.checks.entries()) {
    if (!c?.label?.trim()) return `vérification ${i + 1} : libellé manquant`;
    if (!KINDS.includes(c.kind)) return `vérification ${i + 1} : type inconnu`;
    if (["file", "tree", "exists", "absent"].includes(c.kind) && !c.path?.trim()) return `vérification ${i + 1} : chemin manquant`;
    if (c.kind === "contains" && !c.value?.trim()) return `vérification ${i + 1} : texte attendu manquant`;
  }
  if (k.variants && (!Array.isArray(k.variants) || k.variants.some((v: any) => !v || typeof v !== "object"))) return "« variants » doit être une liste d'objets";
  if (!Array.isArray(o.checks) || o.checks.length !== k.checks.length) return "les vérifications affichées ne correspondent pas au corrigé";
  return null;
}

/** Normalisation : fins de ligne, espaces multiples, lignes vides en fin de texte. */
export function norm(t: string, mode: BashCheck["compare"] = "exact") {
  let lines = String(t ?? "").replace(/\r/g, "").split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim());
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  if (mode === "lines" || mode === "sorted") lines = lines.filter(Boolean);
  if (mode === "sorted") lines.sort();
  return lines.join("\n");
}

function listUnder(run: BashRun, dir: string) {
  const d = abs(dir).replace(/\/$/, "") + "/";
  return [...Object.keys(run.files).filter((p) => p.startsWith(d)).map((p) => p.slice(d.length)),
    ...run.dirs.filter((p) => p.startsWith(d)).map((p) => p.slice(d.length) + "/")].sort().join("\n");
}

/** Une vérification, pour un jeu de fichiers : réponse du candidat contre la référence. */
export function checkOne(c: BashCheck, mine: BashRun, ref: BashRun): boolean {
  if (mine.error) return false;
  const p = c.path ? abs(c.path) : "";
  switch (c.kind) {
    case "exists": return p in mine.files || mine.dirs.includes(p);
    case "absent": return !(p in mine.files) && !mine.dirs.includes(p);
    case "contains": return mine.stdout.toLowerCase().includes(String(c.value).trim().toLowerCase());
    case "stdout": return norm(mine.stdout, c.compare) === norm(ref.stdout, c.compare);
    case "file": return p in mine.files && norm(mine.files[p], c.compare) === norm(ref.files[p] ?? "\u0000", c.compare);
    case "tree": return listUnder(mine, p) === listUnder(ref, p) && listUnder(ref, p) !== "";
  }
  return false;
}

/** Jeux de fichiers sur lesquels le script est lancé : le visible, puis les variantes cachées (fusionnées). */
export function datasets(o: BashOptions, k: BashKey) {
  return [o.files, ...(k.variants || []).map((v) => ({ ...o.files, ...v }))];
}

export function scoreBash(k: BashKey, mine: BashRun[], refs: BashRun[], points: number) {
  const ok = k.checks.filter((c) => mine.every((m, i) => checkOne(c, m, refs[i]))).length;
  return Math.round((points * ok / k.checks.length) * 100) / 100;
}

/** Exécution, partagée par le navigateur (essai) et le serveur (correction). */
export async function runWith(BashCtor: any, files: Record<string, string>, script: string): Promise<BashRun> {
  const init: Record<string, string> = {};
  for (const [p, v] of Object.entries(files)) init[abs(p)] = v;
  const sh = new BashCtor({ files: init, cwd: BASH_HOME, env: { HOME: BASH_HOME, USER: "candidat", LANG: "fr_FR.UTF-8" }, executionLimits: BASH_LIMITS });
  let r: any;
  try { r = await sh.exec(script); }
  catch (e: any) { return { stdout: "", stderr: String(e?.message || e).slice(0, 500), exitCode: 1, files: {}, dirs: [], error: "Le script n'a pas pu s'exécuter" }; }
  const out: BashRun = { stdout: String(r.stdout || "").slice(0, MAX_FILE), stderr: String(r.stderr || "").slice(0, 4000), exitCode: r.exitCode ?? 0, files: {}, dirs: [] };
  const all: string[] = sh.fs.getAllPaths ? sh.fs.getAllPaths() : [];
  for (const p of all.sort()) {
    if (!p.startsWith(BASH_HOME + "/") && !p.startsWith("/tmp/") && !p.startsWith("/srv/") && !p.startsWith("/var/") && !p.startsWith("/etc/") && !p.startsWith("/opt/")) continue;
    try {
      const st = await sh.fs.stat(p);
      if (st.isDirectory) out.dirs.push(p);
      else if (st.isFile && Object.keys(out.files).length < 300) out.files[p] = String(await sh.fs.readFile(p)).slice(0, MAX_FILE);
    } catch { /* lien cassé */ }
  }
  return out;
}
