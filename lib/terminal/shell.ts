/**
 * Mini-shell Linux simulé, exécuté CÔTÉ SERVEUR sur un système de fichiers
 * décrit en JSON. Aucune commande réelle n'est jamais lancée : tout est
 * interprété ici, en lecture seule. Le scénario (et donc le flag) ne quitte
 * jamais le serveur ; le navigateur ne reçoit que la sortie des commandes.
 *
 * Scénario :
 * {
 *   "user": "eve", "hostname": "lab", "home": "/home/eve",
 *   "motd": "texte d'accueil",
 *   "files": { "/home/eve/notes.txt": "contenu", ... },
 *   "dirs": ["/tmp"],                         // dossiers vides éventuels
 *   "denied": ["/root"],                      // chemins interdits en lecture
 *   "env": { "FLAG_HINT": "..." }
 * }
 */

export type Scenario = {
  user?: string;
  hostname?: string;
  home?: string;
  motd?: string;
  files: Record<string, string>;
  dirs?: string[];
  denied?: string[];
  env?: Record<string, string>;
};

export type ShellResult = { output: string; cwd: string; clear?: boolean };

const MAX_OUT = 20_000;

class Fs {
  files = new Map<string, string>();
  dirs = new Set<string>(["/"]);
  denied: string[];
  constructor(s: Scenario) {
    for (const [p, c] of Object.entries(s.files || {})) {
      const n = normalize(p, "/");
      this.files.set(n, String(c));
      this.addParents(n);
    }
    for (const d of s.dirs || []) { const n = normalize(d, "/"); this.dirs.add(n); this.addParents(n); }
    this.denied = (s.denied || []).map((d) => normalize(d, "/"));
  }
  private addParents(p: string) {
    let cur = p;
    while (cur !== "/") { cur = cur.slice(0, cur.lastIndexOf("/")) || "/"; this.dirs.add(cur); }
  }
  isDir(p: string) { return this.dirs.has(p); }
  isFile(p: string) { return this.files.has(p); }
  exists(p: string) { return this.isDir(p) || this.isFile(p); }
  isDenied(p: string) { return this.denied.some((d) => p === d || p.startsWith(d === "/" ? "/" : d + "/")); }
  children(dir: string): string[] {
    const pre = dir === "/" ? "/" : dir + "/";
    const out = new Set<string>();
    for (const p of [...this.files.keys(), ...this.dirs]) {
      if (p !== dir && p.startsWith(pre)) out.add(p.slice(pre.length).split("/")[0]);
    }
    return [...out].sort((a, b) => a.replace(/^\./, "").localeCompare(b.replace(/^\./, "")));
  }
  walk(dir: string): string[] {
    const out: string[] = [dir];
    if (this.isDenied(dir)) return out;
    for (const c of this.children(dir)) {
      const p = dir === "/" ? "/" + c : dir + "/" + c;
      if (this.isDir(p)) out.push(...this.walk(p)); else out.push(p);
    }
    return out;
  }
}

export function normalize(path: string, cwd: string, home = "/"): string {
  let p = path.replace(/^~(?=\/|$)/, home);
  if (!p.startsWith("/")) p = (cwd === "/" ? "" : cwd) + "/" + p;
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop(); else parts.push(seg);
  }
  return "/" + parts.join("/");
}

/** Découpe une ligne en segments de pipe, puis en arguments (guillemets gérés). */
function parse(line: string): string[][] | string {
  const segs: string[][] = [[]];
  let cur = "", q: string | null = null, has = false;
  const push = () => { if (has) segs[segs.length - 1].push(cur); cur = ""; has = false; };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === q) q = null; else cur += ch; continue; }
    if (ch === "'" || ch === '"') { q = ch; has = true; continue; }
    if (ch === "\\" && i + 1 < line.length) { cur += line[++i]; has = true; continue; }
    if (ch === " " || ch === "\t") { push(); continue; }
    if (ch === "|") { push(); segs.push([]); continue; }
    if (ch === ">" || ch === "<" || ch === ";" || ch === "&" || ch === "`") {
      return ch === ">" ? "bash: système de fichiers en lecture seule" : `bash: le caractère « ${ch} » n'est pas pris en charge dans ce terminal`;
    }
    cur += ch; has = true;
  }
  if (q) return "bash: guillemet non fermé";
  push();
  return segs;
}

/** Correspondance « * » / « ? » sans expression régulière (temps linéaire borné). */
function globMatch(pattern: string, name: string, ci = false): boolean {
  const p = (ci ? pattern.toLowerCase() : pattern).slice(0, 100);
  const n = (ci ? name.toLowerCase() : name).slice(0, 255);
  let pi = 0, ni = 0, star = -1, mark = 0;
  while (ni < n.length) {
    if (pi < p.length && (p[pi] === "?" || p[pi] === n[ni])) { pi++; ni++; }
    else if (pi < p.length && p[pi] === "*") { star = pi++; mark = ni; }
    else if (star !== -1) { pi = star + 1; ni = ++mark; }
    else return false;
  }
  while (pi < p.length && p[pi] === "*") pi++;
  return pi === p.length;
}

function b64decode(s: string): string | null {
  const clean = s.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return null;
  try { return Buffer.from(clean, "base64").toString("utf8"); } catch { return null; }
}

const HELP = `Commandes disponibles :
  ls [-a] [-l] [chemin]    lister un dossier (-a : fichiers cachés)
  cd <dossier>             changer de dossier
  pwd                      dossier courant
  cat <fichier>            afficher un fichier
  head / tail [-n N]       début / fin d'un fichier
  grep [-i] [-r] [-n] [-v] texte [chemin]   chercher du texte
  find [chemin] [-name motif] [-type f|d]   chercher des fichiers
  wc [-l]                  compter lignes, mots, caractères
  sort, uniq, rev          trier, dédoublonner, inverser
  base64 [-d]              encoder / décoder en base64
  file <fichier>           type de fichier
  echo, whoami, id, hostname, uname [-a], date, env
  history, clear, help
Les pipes « | » fonctionnent (ex. cat fichier | grep motif | wc -l).`;

export function runShell(scn: Scenario, cwdIn: string, line: string): ShellResult {
  const fs = new Fs(scn);
  const user = scn.user || "candidat";
  const home = normalize(scn.home || `/home/${user}`, "/");
  const env: Record<string, string> = { USER: user, HOME: home, SHELL: "/bin/bash", HOSTNAME: scn.hostname || "lab", ...(scn.env || {}) };
  let cwd = fs.isDir(cwdIn) && !fs.isDenied(cwdIn) ? cwdIn : (fs.isDir(home) ? home : "/");

  const trimmed = line.trim().slice(0, 500);
  if (!trimmed) return { output: "", cwd };
  const expanded = trimmed.replace(/\$\{?([A-Z_][A-Z0-9_]*)\}?/g, (_, v) => env[v] ?? "");
  const parsed = parse(expanded);
  if (typeof parsed === "string") return { output: parsed, cwd };

  let stdin: string | null = null;
  let out = "";
  for (let i = 0; i < parsed.length; i++) {
    const [cmd, ...args] = parsed[i];
    if (!cmd) return { output: "bash: erreur de syntaxe près de « | »", cwd };
    const r = exec(cmd, args, stdin);
    if (r.clear) return { output: "", cwd, clear: true };
    if (r.err) return { output: (out ? out + "\n" : "") + r.err, cwd };
    stdin = r.out;
    out = r.out;
  }
  return { output: out.length > MAX_OUT ? out.slice(0, MAX_OUT) + "\n[sortie tronquée]" : out, cwd };

  function readFile(p: string, name: string): { text?: string; err?: string } {
    const abs = normalize(p, cwd, home);
    if (fs.isDenied(abs)) return { err: `${name}: ${p}: Permission non accordée` };
    if (fs.isDir(abs)) return { err: `${name}: ${p}: est un dossier` };
    if (!fs.isFile(abs)) return { err: `${name}: ${p}: Aucun fichier ou dossier de ce type` };
    return { text: fs.files.get(abs)! };
  }

  function inputOf(args: string[], name: string): { text?: string; err?: string } {
    if (args.length) {
      const parts: string[] = [];
      for (const a of args) { const r = readFile(a, name); if (r.err) return r; parts.push(r.text!); }
      return { text: parts.join("") };
    }
    if (stdin !== null) return { text: stdin };
    return { err: `${name}: opérande manquant` };
  }

  function flags(args: string[]) {
    const f = new Set<string>(); const rest: string[] = []; let n: number | null = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-n" && i + 1 < args.length && /^\d+$/.test(args[i + 1])) { n = parseInt(args[++i], 10); continue; }
      if (/^-\d+$/.test(a)) { n = parseInt(a.slice(1), 10); continue; }
      if (/^-[a-zA-Z]+$/.test(a)) { for (const c of a.slice(1)) f.add(c); continue; }
      rest.push(a);
    }
    return { f, rest, n };
  }

  function exec(cmd: string, args: string[], input: string | null): { out: string; err?: string; clear?: boolean } {
    const lines = (t: string) => t.replace(/\n$/, "").split("\n");
    switch (cmd) {
      case "help": case "man": return { out: HELP };
      case "clear": return { out: "", clear: true };
      case "pwd": return { out: cwd };
      case "whoami": return { out: user };
      case "id": return { out: `uid=1000(${user}) gid=1000(${user}) groupes=1000(${user})` };
      case "hostname": return { out: env.HOSTNAME };
      case "uname": return { out: args.includes("-a") ? `Linux ${env.HOSTNAME} 6.8.0-cybersup #1 SMP x86_64 GNU/Linux` : "Linux" };
      case "date": return { out: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) };
      case "env": case "printenv": return { out: Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") };
      case "echo": return { out: args.join(" ") };
      case "history": return { out: "(l'historique s'affiche avec la flèche du haut)" };
      case "exit": case "logout": return { out: "Impossible de quitter le terminal pendant l'épreuve." };
      case "sudo": case "su": return { out: "", err: `${user} n'est pas dans le fichier sudoers. Cet incident sera signalé.` };
      case "rm": case "mv": case "cp": case "touch": case "mkdir": case "chmod": case "nano": case "vi": case "vim":
        return { out: "", err: `${cmd}: système de fichiers en lecture seule` };
      case "cd": {
        const target = normalize(args[0] || home, cwd, home);
        if (fs.isDenied(target)) return { out: "", err: `bash: cd: ${args[0]}: Permission non accordée` };
        if (fs.isFile(target)) return { out: "", err: `bash: cd: ${args[0]}: N'est pas un dossier` };
        if (!fs.isDir(target)) return { out: "", err: `bash: cd: ${args[0]}: Aucun fichier ou dossier de ce type` };
        cwd = target; return { out: "" };
      }
      case "ls": {
        const { f, rest } = flags(args);
        const targets = rest.length ? rest : ["."];
        const blocks: string[] = [];
        for (const t of targets) {
          const abs = normalize(t, cwd, home);
          if (fs.isDenied(abs)) { blocks.push(`ls: impossible d'ouvrir le dossier '${t}': Permission non accordée`); continue; }
          if (fs.isFile(abs)) { blocks.push(t); continue; }
          if (!fs.isDir(abs)) { blocks.push(`ls: impossible d'accéder à '${t}': Aucun fichier ou dossier de ce type`); continue; }
          let names = fs.children(abs);
          if (!f.has("a")) names = names.filter((n) => !n.startsWith("."));
          else names = [".", "..", ...names];
          const body = f.has("l")
            ? names.map((n) => {
                const p = n === "." ? abs : n === ".." ? normalize("..", abs) : (abs === "/" ? "/" : abs + "/") + n;
                const dir = fs.isDir(p);
                const size = dir || fs.isDenied(p) ? 4096 : (fs.files.get(p)?.length ?? 0);
                const perm = fs.isDenied(p) ? "drwx------ root root" : dir ? `drwxr-xr-x ${user} ${user}` : `-rw-r--r-- ${user} ${user}`;
                return `${perm} ${String(size).padStart(6)} ${n}`;
              }).join("\n")
            : names.join("  ");
          blocks.push(targets.length > 1 ? `${t}:\n${body}` : body);
        }
        return { out: blocks.join("\n\n") };
      }
      case "cat": case "strings": case "more": case "less": {
        const r = inputOf(args.filter((a) => !a.startsWith("-")), cmd);
        return r.err ? { out: "", err: r.err } : { out: r.text!.replace(/\n$/, "") };
      }
      case "head": case "tail": {
        const { rest, n } = flags(args);
        const r = inputOf(rest, cmd);
        if (r.err) return { out: "", err: r.err };
        const l = lines(r.text!); const k = n ?? 10;
        return { out: (cmd === "head" ? l.slice(0, k) : l.slice(-k)).join("\n") };
      }
      case "wc": {
        const { f, rest } = flags(args);
        const r = inputOf(rest, "wc");
        if (r.err) return { out: "", err: r.err };
        const t = r.text!;
        const nl = (t.match(/\n/g) || []).length + (t && !t.endsWith("\n") ? 1 : 0);
        const words = t.split(/\s+/).filter(Boolean).length;
        if (f.has("l")) return { out: String(nl) };
        if (f.has("w")) return { out: String(words) };
        if (f.has("c")) return { out: String(Buffer.byteLength(t)) };
        return { out: `${nl} ${words} ${Buffer.byteLength(t)}` };
      }
      case "sort": { const r = inputOf(flags(args).rest, "sort"); if (r.err) return { out: "", err: r.err };
        const l = lines(r.text!).sort(); return { out: (args.includes("-r") ? l.reverse() : l).join("\n") }; }
      case "uniq": { const r = inputOf(flags(args).rest, "uniq"); if (r.err) return { out: "", err: r.err };
        return { out: lines(r.text!).filter((x, i, a) => i === 0 || a[i - 1] !== x).join("\n") }; }
      case "rev": { const r = inputOf(args, "rev"); if (r.err) return { out: "", err: r.err };
        return { out: lines(r.text!).map((x) => [...x].reverse().join("")).join("\n") }; }
      case "base64": {
        const { f, rest } = flags(args);
        const r = inputOf(rest, "base64");
        if (r.err) return { out: "", err: r.err };
        if (f.has("d")) { const d = b64decode(r.text!); return d === null ? { out: "", err: "base64: entrée invalide" } : { out: d.replace(/\n$/, "") }; }
        return { out: Buffer.from(r.text!).toString("base64") };
      }
      case "file": {
        if (!args.length) return { out: "", err: "file: opérande manquant" };
        return { out: args.map((a) => {
          const abs = normalize(a, cwd, home);
          if (fs.isDenied(abs)) return `${a}: cannot open (Permission non accordée)`;
          if (fs.isDir(abs)) return `${a}: directory`;
          const c = fs.files.get(abs);
          if (c === undefined) return `${a}: cannot open (No such file or directory)`;
          if (/^[A-Za-z0-9+/=\s]+$/.test(c) && c.trim().length > 8 && b64decode(c) !== null) return `${a}: ASCII text (ressemble à du base64)`;
          return `${a}: ASCII text`;
        }).join("\n") };
      }
      case "grep": {
        const { f, rest } = flags(args);
        if (!rest.length) return { out: "", err: "usage : grep [-i] [-r] [-n] motif [chemin]" };
        const [pat, ...paths] = rest;
        // Recherche LITTÉRALE uniquement : aucune expression régulière n'est
        // construite à partir de la saisie du candidat (anti ReDoS, le shell
        // tourne sur le serveur partagé par tous les candidats).
        const ci = f.has("i");
        const needle = (ci ? pat.toLowerCase() : pat).slice(0, 200);
        const re = { test: (l: string) => (ci ? l.toLowerCase() : l).includes(needle) };
        const res: string[] = [];
        const scan = (text: string, label: string | null) => lines(text).forEach((l, i) => {
          if (re.test(l.slice(0, 2000)) !== f.has("v")) res.push(`${label ? label + ":" : ""}${f.has("n") ? i + 1 + ":" : ""}${l}`);
        });
        if (!paths.length && stdin !== null && !f.has("r")) { scan(stdin, null); return { out: res.join("\n") }; }
        const targets = paths.length ? paths : ["."];
        for (const t of targets) {
          const abs = normalize(t, cwd, home);
          if (fs.isDir(abs)) {
            if (!f.has("r")) { res.push(`grep: ${t}: est un dossier`); continue; }
            for (const p of fs.walk(abs)) if (fs.isFile(p) && !fs.isDenied(p)) scan(fs.files.get(p)!, p);
          } else {
            const r = readFile(t, "grep");
            if (r.err) res.push(r.err); else scan(r.text!, targets.length > 1 ? t : null);
          }
        }
        return { out: res.join("\n") };
      }
      case "find": {
        let start = "."; let name: { pat: string; ci: boolean } | null = null; let type: string | null = null;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "-name" || args[i] === "-iname") { const ci = args[i] === "-iname"; name = { pat: args[++i] || "*", ci }; }
          else if (args[i] === "-type") type = args[++i] || null;
          else if (!args[i].startsWith("-")) start = args[i];
        }
        const abs = normalize(start, cwd, home);
        if (!fs.exists(abs)) return { out: "", err: `find: '${start}': Aucun fichier ou dossier de ce type` };
        const res: string[] = [];
        for (const p of fs.walk(abs)) {
          const base = p.split("/").pop() || "/";
          if (name && !globMatch(name.pat, base, name.ci)) continue;
          if (type === "f" && !fs.isFile(p)) continue;
          if (type === "d" && !fs.isDir(p)) continue;
          res.push(fs.isDenied(p) && p !== abs ? `find: '${p}': Permission non accordée` : p);
        }
        return { out: res.join("\n") };
      }
      default:
        return { out: "", err: `${cmd}: commande introuvable (tapez « help »)` };
    }
  }
}

export function promptFor(scn: Scenario, cwd: string): string {
  const user = scn.user || "candidat";
  const home = normalize(scn.home || `/home/${user}`, "/");
  const shown = cwd === home ? "~" : cwd.startsWith(home + "/") ? "~" + cwd.slice(home.length) : cwd;
  return `${user}@${scn.hostname || "lab"}:${shown}$`;
}

/** Validation basique d'un scénario saisi par un admin. */
export function validateScenario(x: any): string | null {
  if (!x || typeof x !== "object") return "Scénario JSON attendu";
  if (!x.files || typeof x.files !== "object") return "« files » est obligatoire";
  const n = Object.keys(x.files).length;
  if (n > 500) return "500 fichiers maximum";
  if (JSON.stringify(x).length > 200_000) return "Scénario trop volumineux (200 Ko max)";
  for (const [k, v] of Object.entries(x.files)) {
    if (!String(k).startsWith("/")) return `Chemin absolu attendu : ${k}`;
    if (typeof v !== "string") return `Contenu texte attendu pour ${k}`;
  }
  return null;
}
