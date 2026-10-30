/**
 * Machine Linux simulée, exécutée CÔTÉ SERVEUR. Aucune vraie commande n'est
 * lancée : tout est interprété ici, sur un état JSON propre à chaque
 * candidat (système de fichiers avec droits, processus, environnement).
 * Le scénario, ses fichiers cachés, ses missions et son flag ne quittent
 * jamais le serveur : le navigateur ne reçoit que la sortie des commandes
 * et la liste des missions (titres + état coché).
 *
 * Aucune expression régulière n'est construite à partir de la saisie du
 * candidat (anti ReDoS : le shell tourne sur un serveur partagé).
 */
import { createHash } from "node:crypto";

export type FileSpec = string | { content: string; mode?: string; owner?: string };
export type Check =
  | { type: "exists"; path: string; kind?: "file" | "dir" }
  | { type: "absent"; path: string }
  | { type: "contains"; path: string; text: string }
  | { type: "equals"; path: string; text: string }
  | { type: "mode"; path: string; mode: string }
  | { type: "process_absent"; name: string }
  | { type: "process_present"; name: string }
  | { type: "ran"; command: string };
export type Objective = { id: string; title: string; check: Check };

export type Scenario = {
  user?: string;
  hostname?: string;
  home?: string;
  motd?: string;
  files: Record<string, FileSpec>;
  dirs?: (string | { path: string; mode?: string; owner?: string })[];
  denied?: string[];
  env?: Record<string, string>;
  processes?: { pid: number; user?: string; cmd: string; cpu?: number; mem?: number }[];
  listen?: { proto?: string; port: number; process: string; addr?: string }[];
  interfaces?: { name: string; ip: string }[];
  sudo?: string[];
  crontab?: string;
  objectives?: Objective[];
};

type Node = { t: "f" | "d"; c?: string; m: number; o: string };
type Proc = { pid: number; user: string; cmd: string; cpu: number; mem: number };
export type ShellState = {
  v: 2;
  cwd: string;
  nodes: Record<string, Node>;
  procs: Proc[];
  env: Record<string, string>;
  history: string[];
  ran: string[];
};
export type ObjectiveStatus = { id: string; title: string; done: boolean };
export type ShellResult = { output: string; state: ShellState; clear?: boolean };

const MAX_OUT = 20_000;          // sortie renvoyée au navigateur
const MAX_PIPE = 256 * 1024;     // taille max de toute sortie intermédiaire
const MAX_NODES = 1500;
const MAX_BYTES = 1_000_000;     // contenu + chemins de tout l'état
const MAX_PATH = 1024;
const MAX_SEG = 255;
const STICKY = 0o1000;

// ------------------------------------------------------------------ chemins
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
const lines = (t: string) => (t === "" ? [] : t.replace(/\n$/, "").split("\n"));
const parentOf = (p: string) => (p === "/" ? "/" : p.slice(0, p.lastIndexOf("/")) || "/");
const baseOf = (p: string) => (p === "/" ? "/" : p.slice(p.lastIndexOf("/") + 1));
const homeOf = (s: Scenario) => normalize(s.home || `/home/${s.user || "candidat"}`, "/");
const userOf = (s: Scenario) => s.user || "candidat";

function parseMode(m: string | undefined, def: number): number {
  return m && /^[0-7]{3,4}$/.test(m) ? parseInt(m, 8) & 0o777 : def;
}

// ------------------------------------------------------------- état initial
export function initState(s: Scenario): ShellState {
  const user = userOf(s), home = homeOf(s);
  const nodes: Record<string, Node> = { "/": { t: "d", m: 0o755, o: "root" } };
  const ownerFor = (p: string) => (p === home || p.startsWith(home + "/") ? user : "root");
  const addDir = (p: string, mode?: number, owner?: string) => {
    const chain: string[] = [];
    for (let cur = p; cur !== "/"; cur = parentOf(cur)) chain.unshift(cur);
    for (const c of chain) if (!nodes[c]) nodes[c] = { t: "d", m: 0o755, o: ownerFor(c) };
    if (mode !== undefined) nodes[p].m = mode;
    if (owner) nodes[p].o = owner;
  };
  addDir(home);
  addDir("/tmp", 0o777 | STICKY, "root");
  for (const d of s.dirs || []) {
    const spec = typeof d === "string" ? { path: d } : d;
    addDir(normalize(spec.path, "/"), spec.mode ? parseMode(spec.mode, 0o755) : undefined, spec.owner);
  }
  for (const d of s.denied || []) addDir(normalize(d, "/"), 0o700, "root");
  const deniedRoots = (s.denied || []).map((d) => normalize(d, "/"));
  const underDenied = (p: string) => deniedRoots.some((d) => p.startsWith(d + "/"));
  for (const [raw, spec] of Object.entries(s.files || {})) {
    const p = normalize(raw, "/");
    const parent = parentOf(p);
    addDir(parent);
    const f = typeof spec === "string" ? { content: spec } : spec;
    const inDenied = underDenied(p);
    nodes[p] = {
      t: "f", c: String(f.content ?? "").replace(/\u0000/g, ""),
      m: parseMode(f.mode, inDenied ? 0o600 : 0o644),
      o: f.owner || (inDenied ? "root" : ownerFor(p)),
    };
  }
  // Sous-dossiers implicites d'un dossier interdit : root, 700
  const declared = new Set((s.dirs || []).map((d) => normalize(typeof d === "string" ? d : d.path, "/")));
  for (const [p, n] of Object.entries(nodes)) if (n.t === "d" && underDenied(p) && !declared.has(p)) { n.m = 0o700; n.o = "root"; }
  return {
    v: 2, cwd: home, nodes,
    procs: (s.processes || []).map((p) => ({ pid: p.pid, user: p.user || user, cmd: p.cmd, cpu: p.cpu ?? 0.1, mem: p.mem ?? 0.2 })),
    env: { USER: user, HOME: home, SHELL: "/bin/bash", HOSTNAME: s.hostname || "lab", PATH: "/usr/local/bin:/usr/bin:/bin", ...(s.env || {}) },
    history: [],
    ran: [],
  };
}

// ----------------------------------------------------------------- missions
export function evaluateObjectives(s: Scenario, st: ShellState): ObjectiveStatus[] {
  return (s.objectives || []).map((o) => ({ id: o.id, title: o.title, done: checkOne(o.check, st, s) }));
}

function checkOne(c: Check, st: ShellState, s: Scenario): boolean {
  const home = homeOf(s);
  const n = "path" in c ? st.nodes[normalize(c.path, home, home)] : undefined;
  switch (c.type) {
    case "exists": return !!n && (!c.kind || (c.kind === "dir" ? n.t === "d" : n.t === "f"));
    case "absent": return !n;
    case "contains": return !!n && n.t === "f" && (n.c || "").includes(c.text);
    case "equals": return !!n && n.t === "f" && (n.c || "").trim() === c.text.trim();
    case "mode": return !!n && (n.m & 0o777).toString(8).padStart(3, "0") === c.mode.replace(/^0(?=\d{3}$)/, "");
    case "process_absent": return !st.procs.some((p) => p.cmd.includes(c.name));
    case "process_present": return st.procs.some((p) => p.cmd.includes(c.name));
    case "ran": return (st.ran || []).includes(c.command);
    default: return false;
  }
}

// ------------------------------------------------------------------ lexique
type Token = { w: string } | { op: "|" | ";" | "&&" | ">" | ">>" };

function tokenize(line: string): Token[] | string {
  const out: Token[] = [];
  let cur = "", has = false, q: string | null = null;
  const push = () => { if (has) out.push({ w: cur }); cur = ""; has = false; };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === q) q = null; else cur += ch; continue; }
    if (ch === "'" || ch === '"') { q = ch; has = true; continue; }
    if (ch === "\\" && i + 1 < line.length) { cur += line[++i]; has = true; continue; }
    if (ch === "`" || (ch === "$" && line[i + 1] === "(")) return "bash: substitution de commande non prise en charge";
    if (ch === "<") return "bash: redirection d'entrée non prise en charge (utilisez cat fichier | …)";
    if (ch === " " || ch === "\t") { push(); continue; }
    if (ch === "|") { if (line[i + 1] === "|") return "bash: « || » non pris en charge (utilisez ; ou &&)"; push(); out.push({ op: "|" }); continue; }
    if (ch === ";") { push(); out.push({ op: ";" }); continue; }
    if (ch === "&") { if (line[i + 1] === "&") { push(); out.push({ op: "&&" }); i++; continue; } return "bash: tâches de fond non prises en charge"; }
    if (ch === ">") { push(); if (line[i + 1] === ">") { out.push({ op: ">>" }); i++; } else out.push({ op: ">" }); continue; }
    cur += ch; has = true;
  }
  if (q) return "bash: guillemet non fermé";
  push();
  return out;
}

type Pipeline = { cmds: string[][]; redirect?: { append: boolean; path: string } };
type Seq = { pipe: Pipeline; then: ";" | "&&" | null }[];

function parse(line: string): Seq | string {
  const toks = tokenize(line);
  if (typeof toks === "string") return toks;
  const seq: Seq = [];
  let pipe: Pipeline = { cmds: [[]] };
  const close = (then: ";" | "&&" | null) => {
    if (pipe.cmds.some((c) => !c.length)) return false;
    seq.push({ pipe, then }); pipe = { cmds: [[]] }; return true;
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if ("w" in t) {
      if (pipe.redirect) return "bash: une seule redirection, en fin de commande";
      pipe.cmds[pipe.cmds.length - 1].push(t.w); continue;
    }
    if (t.op === "|") { if (!pipe.cmds[pipe.cmds.length - 1].length) return "bash: erreur de syntaxe près de « | »"; pipe.cmds.push([]); continue; }
    if (t.op === ">" || t.op === ">>") {
      const nx = toks[i + 1];
      if (!nx || !("w" in nx)) return "bash: fichier de redirection manquant";
      pipe.redirect = { append: t.op === ">>", path: nx.w }; i++; continue;
    }
    if (!close(t.op)) return `bash: erreur de syntaxe près de « ${t.op} »`;
  }
  if (pipe.cmds[0].length) { if (!close(null)) return "bash: erreur de syntaxe"; }
  return seq;
}

// ------------------------------------------------------------------- aide
const HELP = `Fichiers   : ls [-a -l] · cd · pwd · cat · head/tail [-n N] · stat · file · tree
             touch · mkdir [-p] · cp · mv · rm [-r -f] · chmod (600, u+x…)
Texte      : grep [-i -v -n -c -r -l] · find [-name -type -perm -user] · wc [-l]
             sort [-n -r -u] · uniq [-c] · cut -d X -f N · tr · sed 's/a/b/g' [-i] · rev
Encodage   : base64 [-d] · md5sum · sha256sum
Système    : ps [aux] · kill [-9] PID · ss -tlnp · ip a · whoami · id · hostname · uname -a
             env · export VAR=valeur · crontab -l · sudo -l · sudo <commande> · history · date
Shell      : pipes « | », enchaînement « ; » et « && », redirections « > » et « >> »
Raccourcis : ↑ ↓ historique · Ctrl+L effacer`;

// ------------------------------------------------------------------ moteur
export function runShell(scn: Scenario, stIn: ShellState | null, line: string): ShellResult {
  const st: ShellState = stIn && stIn.v === 2 ? structuredClone(stIn) : initState(scn);
  if (!Array.isArray(st.ran)) st.ran = [];
  const user = userOf(scn), home = homeOf(scn);
  if (!st.nodes[st.cwd] || st.nodes[st.cwd].t !== "d") st.cwd = home;

  const raw = line.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, 500);
  if (!raw) return { output: "", state: st };
  st.history = [...st.history.slice(-199), raw];

  const seq = parse(raw);
  if (typeof seq === "string") return { output: seq, state: st };

  const outs: string[] = [];
  let lastOk = true;
  for (const step of seq) {
    if (!lastOk && seq[seq.indexOf(step) - 1]?.then === "&&") { lastOk = false; continue; }
    // Variables développées au moment d'exécuter chaque étape (export X=1; echo $X)
    const env = (w: string) => w.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (_, v) => (Object.prototype.hasOwnProperty.call(st.env, v) ? st.env[v] : ""));
    const pipe: Pipeline = { cmds: step.pipe.cmds.map((c) => c.map(env)), redirect: step.pipe.redirect && { ...step.pipe.redirect, path: env(step.pipe.redirect.path) } };
    const r = runPipeline(pipe);
    if (r.clear) return { output: "", state: st, clear: true };
    if (r.out) outs.push(r.out);
    lastOk = r.ok;
  }
  let output = outs.join("\n").replace(/\u0000/g, "");
  if (output.length > MAX_OUT) output = output.slice(0, MAX_OUT) + "\n[sortie tronquée]";
  return { output, state: st };

  // ---------------------------------------------------------- utilitaires
  function canAccess(p: string, bit: 4 | 2 | 1, root: boolean): boolean {
    if (root) return true;
    const n = st.nodes[p]; if (!n) return false;
    const m = n.o === user ? (n.m >> 6) & 7 : n.m & 7;
    return (m & bit) !== 0;
  }
  function traversable(p: string, root: boolean): boolean {
    for (let cur = parentOf(p); ; cur = parentOf(cur)) {
      if (!canAccess(cur, 1, root)) return false;
      if (cur === "/") return true;
    }
  }
  function resolve(arg: string) {
    const p = normalize(arg.slice(0, MAX_PATH * 2), st.cwd, home);
    if (p.length > MAX_PATH || p.split("/").some((seg) => seg.length > MAX_SEG)) throw new ShellError("Nom de fichier trop long");
    return p;
  }
  function canDelete(p: string, root: boolean): boolean {
    if (root) return true;
    const par = parentOf(p), pn = st.nodes[par], n = st.nodes[p];
    if (!canAccess(par, 2, root)) return false;
    return !(pn && pn.m & STICKY) || n?.o === user || pn.o === user;
  }
  function children(dir: string): string[] {
    const pre = dir === "/" ? "/" : dir + "/";
    return Object.keys(st.nodes).filter((p) => p !== dir && p.startsWith(pre) && !p.slice(pre.length).includes("/"))
      .map((p) => p.slice(pre.length)).sort((a, b) => a.replace(/^\./, "").localeCompare(b.replace(/^\./, "")));
  }
  function walk(dir: string, root: boolean): string[] {
    const out = [dir];
    if (st.nodes[dir]?.t !== "d" || !canAccess(dir, 4, root) || !canAccess(dir, 1, root)) return out;
    for (const c of children(dir)) {
      const p = dir === "/" ? "/" + c : dir + "/" + c;
      if (st.nodes[p].t === "d") out.push(...walk(p, root)); else out.push(p);
    }
    return out;
  }
  function modeStr(n: Node) {
    const b = (x: number) => (x & 4 ? "r" : "-") + (x & 2 ? "w" : "-") + (x & 1 ? "x" : "-");
    const other = b(n.m);
    return (n.t === "d" ? "d" : "-") + b(n.m >> 6) + b(n.m >> 3) + (n.m & STICKY ? other.slice(0, 2) + "t" : other);
  }
  function usage(): number {
    let bytes = 0; for (const [k, n] of Object.entries(st.nodes)) bytes += k.length + (n.c || "").length; return bytes;
  }
  function readFile(arg: string, name: string, root: boolean): { text?: string; err?: string } {
    const p = resolve(arg), n = st.nodes[p];
    if (!n) return { err: `${name}: ${arg}: Aucun fichier ou dossier de ce type` };
    if (!traversable(p, root) || !canAccess(p, 4, root)) return { err: `${name}: ${arg}: Permission non accordée` };
    if (n.t === "d") return { err: `${name}: ${arg}: est un dossier` };
    return { text: n.c || "" };
  }
  function writeFile(arg: string, content: string, append: boolean, name: string, root: boolean): string | null {
    const p = resolve(arg), n = st.nodes[p], par = st.nodes[parentOf(p)];
    if (n?.t === "d") return `${name}: ${arg}: est un dossier`;
    if (!par || par.t !== "d") return `${name}: ${arg}: Aucun fichier ou dossier de ce type`;
    if (!traversable(p, root)) return `${name}: ${arg}: Permission non accordée`;
    if (n ? !canAccess(p, 2, root) : !canAccess(parentOf(p), 2, root)) return `${name}: ${arg}: Permission non accordée`;
    const next = (append ? (n?.c || "") + content : content).replace(/\u0000/g, "");
    if (usage() - (n?.c?.length || 0) + next.length + (n ? 0 : p.length) > MAX_BYTES) return `${name}: plus d'espace disque`;
    if (!n && Object.keys(st.nodes).length >= MAX_NODES) return `${name}: trop de fichiers`;
    st.nodes[p] = n ? { ...n, c: next } : { t: "f", c: next, m: 0o644, o: root ? "root" : user };
    return null;
  }
  function flags(args: string[], withValue: string[] = []) {
    const f = new Set<string>(); const v: Record<string, string> = {}; const rest: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (withValue.includes(a) && i + 1 < args.length) { v[a] = args[++i]; continue; }
      const glued = withValue.find((w) => a.startsWith(w) && a.length > w.length);
      if (glued) { v[glued] = a.slice(glued.length); continue; }
      if (/^-\d+$/.test(a)) { v["-n"] = a.slice(1); continue; }
      if (/^-[a-zA-Z]+$/.test(a)) { for (const c of a.slice(1)) f.add(c); continue; }
      rest.push(a);
    }
    return { f, v, rest };
  }
  function runPipeline(pl: Pipeline): { out: string; ok: boolean; clear?: boolean } {
    let input: string | null = null;
    let ok = true;
    const errs: string[] = [];
    for (const words of pl.cmds) {
      let root = false, w = words;
      if (w[0] === "sudo") {
        if (w[1] === "-l") { input = sudoList(); continue; }
        const allowed = (scn.sudo || []).includes(w[1]);
        if (!w[1]) { errs.push("usage : sudo <commande>"); ok = false; input = ""; continue; }
        if (!allowed) { errs.push(`Désolé, l'utilisateur ${user} n'est pas autorisé à exécuter « ${w[1]} » en tant que root sur ${st.env.HOSTNAME}.`); ok = false; input = ""; continue; }
        root = true; w = w.slice(1);
      }
      let r: { out: string; err?: string; clear?: boolean };
      try { r = exec(w[0], w.slice(1), input, root); }
      catch (e) { if (e instanceof ShellError) r = { out: "", err: `${w[0]}: ${e.message}` }; else throw e; }
      if (r.clear) return { out: "", ok: true, clear: true };
      if (r.err) { errs.push(r.err); ok = false; }
      else if (!st.ran.includes(w[0]) && st.ran.length < 100 && /^[a-z0-9_.-]{1,32}$/.test(w[0])) st.ran.push(w[0]);
      input = r.out.length > MAX_PIPE ? r.out.slice(0, MAX_PIPE) : r.out;
    }
    let out = input ?? "";
    if (pl.redirect) {
      const e = writeFile(pl.redirect.path, out === "" ? "" : out.replace(/\n?$/, "\n"), pl.redirect.append, "bash", false);
      if (e) { errs.push(e); ok = false; }
      out = "";
    }
    return { out: [...errs, out].filter((x) => x !== "").join("\n"), ok };
  }

  function sudoList(): string {
    const l = scn.sudo || [];
    if (!l.length) return `Désolé, ${user} ne peut pas utiliser sudo sur ${st.env.HOSTNAME}.`;
    return `L'utilisateur ${user} peut exécuter les commandes suivantes sur ${st.env.HOSTNAME} :\n` + l.map((c) => `    (root) NOPASSWD: ${c}`).join("\n");
  }

  function textIn(args: string[], input: string | null, name: string, root: boolean): { text?: string; err?: string } {
    if (args.length) {
      const parts: string[] = [];
      let total = 0;
      for (const a of args.slice(0, 50)) {
        const r = readFile(a, name, root); if (r.err) return r;
        total += r.text!.length; if (total > MAX_PIPE) return { err: `${name}: entrée trop volumineuse` };
        parts.push(r.text!);
      }
      return { text: parts.join("") };
    }
    if (input !== null) return { text: input };
    return { err: `${name}: opérande manquant` };
  }

  function expandTr(set: string): string {
    let out = "";
    for (let i = 0; i < set.length; i++) {
      if (set[i + 1] === "-" && i + 2 < set.length) {
        const a = set.charCodeAt(i), b = set.charCodeAt(i + 2);
        for (let c = a; c <= b && out.length < 256; c++) out += String.fromCharCode(c);
        i += 2;
      } else out += set[i];
    }
    return out;
  }

  function chmod(spec: string, n: Node): number | null {
    if (/^[0-7]{3,4}$/.test(spec)) return parseInt(spec, 8) & (0o777 | STICKY);
    let m = n.m;
    for (const part of spec.split(",")) {
      const mm = part.match(/^([ugoa]*)([+\-=])([rwx]*)$/);
      if (!mm) return null;
      const who = mm[1] || "a";
      let bits = 0;
      if (mm[3].includes("r")) bits |= 4;
      if (mm[3].includes("w")) bits |= 2;
      if (mm[3].includes("x")) bits |= 1;
      for (const [w, sh] of [["u", 6], ["g", 3], ["o", 0]] as const) {
        if (!(who.includes(w) || who.includes("a"))) continue;
        const mask = 7 << sh;
        if (mm[2] === "+") m |= bits << sh;
        else if (mm[2] === "-") m &= ~(bits << sh);
        else m = (m & ~mask) | (bits << sh);
      }
    }
    return m & (0o777 | STICKY);
  }

  function exec(cmd: string, args: string[], input: string | null, root: boolean): { out: string; err?: string; clear?: boolean } {
    const E = (err: string) => ({ out: "", err });
    switch (cmd) {
      case "help": case "man": return { out: HELP };
      case "clear": return { out: "", clear: true };
      case "pwd": return { out: st.cwd };
      case "true": case ":": return { out: "" };
      case "false": return { out: "", err: "" };
      case "whoami": return { out: root ? "root" : user };
      case "id": return { out: root ? "uid=0(root) gid=0(root) groupes=0(root)" : `uid=1000(${user}) gid=1000(${user}) groupes=1000(${user})` };
      case "hostname": return { out: st.env.HOSTNAME };
      case "uname": return { out: args.includes("-a") ? `Linux ${st.env.HOSTNAME} 6.8.0-cybersup #1 SMP x86_64 GNU/Linux` : "Linux" };
      case "date": return { out: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) };
      case "env": case "printenv": return { out: Object.entries(st.env).map(([k, v]) => `${k}=${v}`).join("\n") };
      case "export": {
        for (const a of args) {
          const m = a.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
          if (!m) return E(`export: « ${a} » : identifiant non valable`);
          if (Object.keys(st.env).length > 60) return E("export: trop de variables");
          st.env[m[1]] = m[2].slice(0, 500);
        }
        return { out: "" };
      }
      case "echo": {
        const n = args[0] === "-n";
        return { out: (n ? args.slice(1) : args).join(" ") };
      }
      case "history": return { out: st.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join("\n") };
      case "exit": case "logout": return { out: "Impossible de quitter le terminal pendant l'épreuve." };
      case "su": return E("su: échec de l'authentification");
      case "crontab": return args.includes("-l") ? { out: scn.crontab || `aucune crontab pour ${user}` } : E("crontab: seul « crontab -l » est disponible");
      case "ping": case "curl": case "wget": case "ssh": case "nc": case "nmap": case "apt": case "pip":
        return E(`${cmd}: réseau extérieur indisponible sur cette machine d'épreuve`);
      case "nano": case "vi": case "vim":
        return E(`${cmd}: éditeur indisponible, utilisez echo "texte" > fichier ou sed -i`);

      case "cd": {
        const target = resolve(args[0] || home), n = st.nodes[target];
        if (!n) return E(`bash: cd: ${args[0]}: Aucun fichier ou dossier de ce type`);
        if (n.t !== "d") return E(`bash: cd: ${args[0]}: N'est pas un dossier`);
        if (!traversable(target, root) || !canAccess(target, 1, root)) return E(`bash: cd: ${args[0]}: Permission non accordée`);
        st.cwd = target; return { out: "" };
      }
      case "ls": case "ll": {
        const { f, rest } = flags(args);
        if (cmd === "ll") { f.add("l"); f.add("a"); }
        const targets = rest.length ? rest : ["."];
        const blocks: string[] = [];
        for (const t of targets) {
          const p = resolve(t), n = st.nodes[p];
          if (!n) { blocks.push(`ls: impossible d'accéder à '${t}': Aucun fichier ou dossier de ce type`); continue; }
          if (!traversable(p, root)) { blocks.push(`ls: impossible d'accéder à '${t}': Permission non accordée`); continue; }
          if (n.t === "f") { blocks.push(f.has("l") ? `${modeStr(n)} ${n.o.padEnd(8)} ${String((n.c || "").length).padStart(6)} ${t}` : t); continue; }
          if (!traversable(p, root) || !canAccess(p, 4, root)) { blocks.push(`ls: impossible d'ouvrir le dossier '${t}': Permission non accordée`); continue; }
          let names = children(p);
          if (!f.has("a")) names = names.filter((x) => !x.startsWith("."));
          else names = [".", "..", ...names];
          const body = f.has("l")
            ? names.map((x) => {
                const cp = x === "." ? p : x === ".." ? parentOf(p) : (p === "/" ? "/" : p + "/") + x;
                const cn = st.nodes[cp];
                const size = cn.t === "d" ? 4096 : (cn.c || "").length;
                return `${modeStr(cn)} ${cn.o.padEnd(8)} ${String(size).padStart(6)} ${x}`;
              }).join("\n")
            : names.join("  ");
          blocks.push(targets.length > 1 ? `${t}:\n${body}` : body);
        }
        return { out: blocks.join("\n\n") };
      }
      case "tree": {
        const p = resolve(args[0] || ".");
        if (st.nodes[p]?.t !== "d") return E(`tree: ${args[0] || "."}: dossier introuvable`);
        if (!traversable(p, root) || !canAccess(p, 4, root) || !canAccess(p, 1, root)) return E(`tree: ${args[0] || "."}: Permission non accordée`);
        const out: string[] = [args[0] || "."];
        const rec = (dir: string, pre: string, depth: number) => {
          if (depth > 6 || !canAccess(dir, 4, root) || !canAccess(dir, 1, root)) return;
          const kids = children(dir).filter((x) => !x.startsWith("."));
          kids.forEach((k, i) => {
            const last = i === kids.length - 1, cp = (dir === "/" ? "/" : dir + "/") + k;
            out.push(`${pre}${last ? "└── " : "├── "}${k}`);
            if (st.nodes[cp].t === "d") rec(cp, pre + (last ? "    " : "│   "), depth + 1);
          });
        };
        rec(p, "", 0);
        return { out: out.slice(0, 400).join("\n") };
      }
      case "cat": case "strings": case "more": case "less": {
        const r = textIn(args.filter((a) => !a.startsWith("-")), input, cmd, root);
        return r.err ? E(r.err) : { out: r.text!.replace(/\n$/, "") };
      }
      case "head": case "tail": {
        const { v, rest } = flags(args, ["-n"]);
        const r = textIn(rest, input, cmd, root); if (r.err) return E(r.err);
        const k = Math.min(10000, parseInt(v["-n"] || "10", 10) || 10), l = lines(r.text!);
        return { out: (cmd === "head" ? l.slice(0, k) : l.slice(-k)).join("\n") };
      }
      case "wc": {
        const { f, rest } = flags(args);
        const r = textIn(rest, input, "wc", root); if (r.err) return E(r.err);
        const t = r.text!, nl = (t.match(/\n/g) || []).length + (t && !t.endsWith("\n") ? 1 : 0), words = t.split(/\s+/).filter(Boolean).length;
        if (f.has("l")) return { out: String(nl) };
        if (f.has("w")) return { out: String(words) };
        if (f.has("c")) return { out: String(Buffer.byteLength(t)) };
        return { out: `${nl} ${words} ${Buffer.byteLength(t)}` };
      }
      case "sort": {
        const { f, rest } = flags(args);
        const r = textIn(rest, input, "sort", root); if (r.err) return E(r.err);
        let l = lines(r.text!);
        l = f.has("n") ? l.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)) : l.sort();
        if (f.has("r")) l.reverse();
        if (f.has("u")) l = l.filter((x, i, a) => i === 0 || a[i - 1] !== x);
        return { out: l.join("\n") };
      }
      case "uniq": {
        const { f, rest } = flags(args);
        const r = textIn(rest, input, "uniq", root); if (r.err) return E(r.err);
        const groups: [string, number][] = [];
        for (const x of lines(r.text!)) { const g = groups[groups.length - 1]; if (g && g[0] === x) g[1]++; else groups.push([x, 1]); }
        return { out: groups.map(([x, n]) => (f.has("c") ? `${String(n).padStart(7)} ${x}` : x)).join("\n") };
      }
      case "cut": {
        const { v, rest } = flags(args, ["-d", "-f", "-c"]);
        const r = textIn(rest, input, "cut", root); if (r.err) return E(r.err);
        const pick = (spec: string, max: number) => {
          const idx = new Set<number>();
          for (const part of spec.split(",")) {
            const [a, b] = part.split("-");
            const lo = a ? parseInt(a, 10) : 1, hi = part.includes("-") ? (b ? parseInt(b, 10) : max) : lo;
            for (let i = lo; i <= Math.min(hi, max, 1000); i++) idx.add(i);
          }
          return [...idx].sort((x, y) => x - y);
        };
        if (v["-c"]) return { out: lines(r.text!).map((l) => pick(v["-c"], l.length).map((i) => l[i - 1] ?? "").join("")).join("\n") };
        if (!v["-f"]) return E("cut: précisez -f N (avec -d séparateur) ou -c N-M");
        const d = v["-d"] ?? "\t";
        if (d.length !== 1) return E("cut: le séparateur doit être un seul caractère");
        return { out: lines(r.text!).map((l) => { const p = l.split(d); return pick(v["-f"], p.length).map((i) => p[i - 1] ?? "").join(d); }).join("\n") };
      }
      case "tr": {
        const { f, rest } = flags(args);
        if (input === null) return E("tr: s'utilise derrière un pipe (ex. cat f | tr a-z A-Z)");
        if (f.has("d")) { const del = expandTr(rest[0] || ""); return { out: [...input].filter((c) => !del.includes(c)).join("").replace(/\n$/, "") }; }
        if (rest.length < 2) return E("usage : tr ENSEMBLE1 ENSEMBLE2 ou tr -d ENSEMBLE");
        const a = expandTr(rest[0]), b = expandTr(rest[1]);
        return { out: [...input].map((c) => { const i = a.indexOf(c); return i < 0 ? c : b[Math.min(i, b.length - 1)] ?? c; }).join("").replace(/\n$/, "") };
      }
      case "rev": {
        const r = textIn(args, input, "rev", root); if (r.err) return E(r.err);
        return { out: lines(r.text!).map((x) => [...x].reverse().join("")).join("\n") };
      }
      case "sed": {
        const inPlace = args[0] === "-i";
        const a = inPlace ? args.slice(1) : args;
        const expr = a[0] || "";
        const m = expr.length > 2 && expr[0] === "s" ? expr : "";
        if (!m) return E("sed: seule la substitution est disponible : sed 's/ancien/nouveau/g' [fichier]");
        const sep = m[1], parts = m.slice(2).split(sep);
        if (parts.length < 3) return E("sed: expression incomplète, exemple : s/ancien/nouveau/g");
        const [from, to, opt] = parts;
        if (!from) return E("sed: motif vide");
        const sub = (t: string) => {
          const parts2 = t.split(from);
          const count = opt.includes("g") ? parts2.length - 1 : Math.min(parts2.length - 1, lines(t).length);
          if (t.length + count * Math.max(0, to.length - from.length) > MAX_PIPE) throw new ShellError("résultat trop volumineux");
          return opt.includes("g") ? parts2.join(to) : lines(t).map((l) => { const i = l.indexOf(from); return i < 0 ? l : l.slice(0, i) + to + l.slice(i + from.length); }).join("\n");
        };
        if (inPlace) {
          if (!a[1]) return E("sed: -i nécessite un fichier");
          const r = readFile(a[1], "sed", root); if (r.err) return E(r.err);
          const e = writeFile(a[1], sub(r.text!), false, "sed", root); return e ? E(e) : { out: "" };
        }
        const r = textIn(a.slice(1), input, "sed", root); if (r.err) return E(r.err);
        return { out: sub(r.text!).replace(/\n$/, "") };
      }
      case "base64": {
        const { f, rest } = flags(args);
        const r = textIn(rest, input, "base64", root); if (r.err) return E(r.err);
        if (f.has("d")) {
          const clean = r.text!.replace(/\s+/g, "");
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return E("base64: entrée invalide");
          return { out: Buffer.from(clean, "base64").toString("utf8").replace(/\n$/, "") };
        }
        return { out: Buffer.from(r.text!).toString("base64") };
      }
      case "md5sum": case "sha256sum": case "sha1sum": {
        const algo = cmd.replace("sum", "");
        if (!args.length) { if (input === null) return E(`${cmd}: opérande manquant`); return { out: `${createHash(algo).update(input).digest("hex")}  -` }; }
        const out: string[] = [];
        for (const a of args) { const r = readFile(a, cmd, root); if (r.err) out.push(r.err); else out.push(`${createHash(algo).update(r.text!).digest("hex")}  ${a}`); }
        return { out: out.join("\n") };
      }
      case "stat": {
        if (!args[0]) return E("stat: opérande manquant");
        const p = resolve(args[0]), n = st.nodes[p];
        if (!n) return E(`stat: impossible d'évaluer '${args[0]}': Aucun fichier ou dossier de ce type`);
        if (!traversable(p, root)) return E(`stat: '${args[0]}': Permission non accordée`);
        return { out: `  Fichier : ${args[0]}\n   Taille : ${n.t === "d" ? 4096 : (n.c || "").length}\t${n.t === "d" ? "répertoire" : "fichier"}\n   Accès : (0${(n.m & 0o777).toString(8)}/${modeStr(n)})  UID : (${n.o})` };
      }
      case "file": {
        if (!args.length) return E("file: opérande manquant");
        return { out: args.map((a) => {
          const p = resolve(a), n = st.nodes[p];
          if (!n) return `${a}: cannot open (Aucun fichier ou dossier de ce type)`;
          if (!traversable(p, root)) return `${a}: cannot open (Permission non accordée)`;
          if (n.t === "d") return `${a}: directory`;
          if (!canAccess(p, 4, root)) return `${a}: cannot open (Permission non accordée)`;
          const c = (n.c || "").trim();
          if (c.startsWith("#!/bin/bash") || c.startsWith("#!/bin/sh")) return `${a}: Bourne-Again shell script, ASCII text executable`;
          if (/^[A-Za-z0-9+/=\s]+$/.test(c) && c.length > 8 && c.length % 4 === 0) return `${a}: ASCII text (ressemble à du base64)`;
          return `${a}: ASCII text`;
        }).join("\n") };
      }
      case "grep": {
        const { f, rest } = flags(args);
        if (!rest.length) return E("usage : grep [-i -v -n -c -r -l] texte [chemin]");
        const [pat, ...paths] = rest;
        // Recherche littérale uniquement (aucune expression régulière).
        const ci = f.has("i"), needle = (ci ? pat.toLowerCase() : pat).slice(0, 200);
        const hit = (l: string) => (ci ? l.slice(0, 4000).toLowerCase() : l.slice(0, 4000)).includes(needle) !== f.has("v");
        const res: string[] = [];
        const scan = (text: string, label: string | null) => {
          const ls = lines(text); let c = 0;
          ls.forEach((l, i) => { if (hit(l)) { c++; if (!f.has("c") && !f.has("l")) res.push(`${label ? label + ":" : ""}${f.has("n") ? i + 1 + ":" : ""}${l}`); } });
          if (f.has("c")) res.push(`${label ? label + ":" : ""}${c}`);
          if (f.has("l") && c && label) res.push(label);
        };
        if (!paths.length && input !== null && !f.has("r")) { scan(input, null); return { out: res.join("\n") }; }
        const targets = paths.length ? paths : ["."];
        for (const t of targets) {
          const p = resolve(t), n = st.nodes[p];
          if (n?.t === "d") {
            if (!f.has("r")) { res.push(`grep: ${t}: est un dossier`); continue; }
            for (const q of walk(p, root)) if (st.nodes[q].t === "f" && traversable(q, root) && canAccess(q, 4, root)) scan(st.nodes[q].c || "", q);
          } else {
            const r = readFile(t, "grep", root);
            if (r.err) res.push(r.err); else scan(r.text!, targets.length > 1 || f.has("l") ? t : null);
          }
        }
        return { out: res.join("\n") };
      }
      case "find": {
        let start = "."; let name: { pat: string; ci: boolean } | null = null; let type: string | null = null;
        let perm: string | null = null; let owner: string | null = null;
        for (let i = 0; i < args.length; i++) {
          const a = args[i];
          if (a === "-name" || a === "-iname") name = { pat: args[++i] || "*", ci: a === "-iname" };
          else if (a === "-type") type = args[++i] || null;
          else if (a === "-perm") perm = (args[++i] || "").replace(/^-/, "");
          else if (a === "-user") owner = args[++i] || null;
          else if (!a.startsWith("-")) start = a;
        }
        const p = resolve(start);
        if (!st.nodes[p]) return E(`find: '${start}': Aucun fichier ou dossier de ce type`);
        if (!traversable(p, root)) return E(`find: '${start}': Permission non accordée`);
        const res: string[] = [];
        for (const q of walk(p, root)) {
          const n = st.nodes[q];
          if (n.t === "d" && q !== p && (!canAccess(q, 4, root) || !canAccess(q, 1, root))) { res.push(`find: '${q}': Permission non accordée`); continue; }
          if (name && !globMatch(name.pat, baseOf(q), name.ci)) continue;
          if (type === "f" && n.t !== "f") continue;
          if (type === "d" && n.t !== "d") continue;
          if (owner && n.o !== owner) continue;
          if (perm && /^[0-7]{3}$/.test(perm) && (n.m & 0o777) !== parseInt(perm, 8)) continue;
          res.push(q);
        }
        return { out: res.slice(0, 2000).join("\n") };
      }

      case "touch": {
        if (!args.length) return E("touch: opérande de fichier manquant");
        for (const a of args) { const p = resolve(a); if (st.nodes[p]) continue; const e = writeFile(a, "", false, "touch", root); if (e) return E(e); }
        return { out: "" };
      }
      case "mkdir": {
        const { f, rest } = flags(args);
        if (!rest.length) return E("mkdir: opérande manquant");
        for (const a of rest) {
          const p = resolve(a);
          if (st.nodes[p]) { if (f.has("p")) continue; return E(`mkdir: impossible de créer le répertoire « ${a} »: Le fichier existe`); }
          const chain: string[] = [];
          for (let cur = p; !st.nodes[cur]; cur = parentOf(cur)) chain.unshift(cur);
          if (chain.length > 1 && !f.has("p")) return E(`mkdir: impossible de créer le répertoire « ${a} »: Aucun fichier ou dossier de ce type`);
          for (const c of chain) {
            if (st.nodes[parentOf(c)]?.t !== "d") return E(`mkdir: « ${a} »: N'est pas un dossier`);
            if (!canAccess(parentOf(c), 2, root) || !traversable(c, root)) return E(`mkdir: impossible de créer le répertoire « ${a} »: Permission non accordée`);
            if (Object.keys(st.nodes).length >= MAX_NODES) return E("mkdir: trop de fichiers");
            if (usage() + c.length > MAX_BYTES) return E("mkdir: plus d'espace disque");
            st.nodes[c] = { t: "d", m: 0o755, o: root ? "root" : user };
          }
        }
        return { out: "" };
      }
      case "rm": case "rmdir": {
        const { f, rest } = flags(args);
        if (!rest.length) return E(`${cmd}: opérande manquant`);
        for (const a of rest) {
          const p = resolve(a), n = st.nodes[p];
          if (p === "/" || p === home) return E(`${cmd}: refus de supprimer « ${a} »`);
          if (!n) { if (f.has("f")) continue; return E(`${cmd}: impossible de supprimer '${a}': Aucun fichier ou dossier de ce type`); }
          if (!traversable(p, root) || !canDelete(p, root)) return E(`${cmd}: impossible de supprimer '${a}': Permission non accordée`);
          if (n.t === "d") {
            const kids = Object.keys(st.nodes).filter((k) => k.startsWith(p + "/"));
            if (cmd === "rmdir" && kids.length) return E(`rmdir: impossible de supprimer '${a}': Le dossier n'est pas vide`);
            if (cmd === "rm" && !f.has("r") && !f.has("R")) return E(`rm: impossible de supprimer '${a}': est un dossier`);
            // Chaque dossier vidé doit être lisible, traversable et modifiable
            const dirs = [p, ...kids.filter((k) => st.nodes[k].t === "d")];
            const blocked = dirs.find((d) => !canAccess(d, 4, root) || !canAccess(d, 1, root) || !canAccess(d, 2, root) || (kids.some((k) => parentOf(k) === d) && !kids.filter((k) => parentOf(k) === d).every((k) => canDelete(k, root))));
            if (blocked) return E(`rm: impossible de supprimer '${blocked}': Permission non accordée`);
            for (const k of kids) delete st.nodes[k];
          }
          delete st.nodes[p];
        }
        return { out: "" };
      }
      case "cp": case "mv": {
        const { f, rest } = flags(args);
        if (rest.length !== 2) return E(`${cmd}: indiquez une source et une destination`);
        const src = resolve(rest[0]), n = st.nodes[src];
        if (!n) return E(`${cmd}: impossible d'évaluer '${rest[0]}': Aucun fichier ou dossier de ce type`);
        let dst = resolve(rest[1]);
        if (st.nodes[dst]?.t === "d") dst = (dst === "/" ? "" : dst) + "/" + baseOf(src);
        if (dst === src || dst.startsWith(src + "/")) return E(`${cmd}: source et destination identiques ou imbriquées`);
        if (!traversable(src, root) || !canAccess(src, 4, root)) return E(`${cmd}: '${rest[0]}': Permission non accordée`);
        if (cmd === "mv" && !canDelete(src, root)) return E(`mv: '${rest[0]}': Permission non accordée`);
        if (st.nodes[parentOf(dst)]?.t !== "d") return E(`${cmd}: '${rest[1]}': Aucun fichier ou dossier de ce type`);
        if (!traversable(dst, root) || !canAccess(parentOf(dst), 2, root)) return E(`${cmd}: '${rest[1]}': Permission non accordée`);
        if (n.t === "d" && cmd === "cp" && !f.has("r") && !f.has("R")) return E(`cp: -r non spécifié ; omission du répertoire '${rest[0]}'`);
        const moved = Object.keys(st.nodes).filter((k) => k === src || k.startsWith(src + "/"));
        // Chaque élément copié doit être lisible (et chaque dossier traversable)
        const unreadable = moved.find((k) => !canAccess(k, 4, root) || (st.nodes[k].t === "d" && !canAccess(k, 1, root)) || !traversable(k, root));
        if (unreadable) return E(`${cmd}: impossible d'ouvrir '${unreadable}' en lecture: Permission non accordée`);
        if (dst.length + 300 > MAX_PATH) return E(`${cmd}: nom de fichier trop long`);
        if (Object.keys(st.nodes).length + (cmd === "cp" ? moved.length : 0) > MAX_NODES) return E(`${cmd}: trop de fichiers`);
        const copies: [string, Node][] = moved.map((k) => [dst + k.slice(src.length), { ...st.nodes[k], o: cmd === "cp" ? (root ? "root" : user) : st.nodes[k].o }]);
        if (copies.some(([k]) => k.length > MAX_PATH)) return E(`${cmd}: nom de fichier trop long`);
        if (cmd === "cp" && usage() + copies.reduce((s2, [k, nn]) => s2 + k.length + (nn.c || "").length, 0) > MAX_BYTES) return E("cp: plus d'espace disque");
        if (cmd === "mv") for (const k of moved) delete st.nodes[k];
        for (const [k, nn] of copies) st.nodes[k] = nn;
        return { out: "" };
      }
      case "chmod": {
        if (args.length < 2) return E("usage : chmod MODE fichier (ex. chmod 600 secret.txt, chmod u+x script.sh)");
        for (const a of args.slice(1)) {
          const p = resolve(a), n = st.nodes[p];
          if (!n) return E(`chmod: impossible d'accéder à '${a}': Aucun fichier ou dossier de ce type`);
          if (!root && n.o !== user) return E(`chmod: modification des droits de '${a}': Opération non permise`);
          const m = chmod(args[0], n);
          if (m === null) return E(`chmod: mode incorrect : « ${args[0]} »`);
          n.m = m;
        }
        return { out: "" };
      }
      case "chown": {
        if (!root) return E("chown: Opération non permise (il faut être root)");
        if (args.length < 2) return E("usage : chown UTILISATEUR fichier");
        for (const a of args.slice(1)) { const n = st.nodes[resolve(a)]; if (!n) return E(`chown: '${a}': introuvable`); n.o = args[0].split(":")[0].slice(0, 32); }
        return { out: "" };
      }

      case "ps": case "top": {
        const rows = st.procs.map((p) => `${p.user.padEnd(10)} ${String(p.pid).padStart(6)} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)} ${p.cmd}`);
        return { out: [`USER          PID  %CPU  %MEM COMMAND`, ...rows].join("\n") };
      }
      case "pgrep": {
        if (!args[0]) return E("usage : pgrep nom");
        return { out: st.procs.filter((p) => p.cmd.includes(args[0])).map((p) => String(p.pid)).join("\n") };
      }
      case "kill": case "pkill": {
        const targets = args.filter((a) => !a.startsWith("-"));
        if (!targets.length) return E(`usage : ${cmd} ${cmd === "kill" ? "[-9] PID" : "nom"}`);
        const errs: string[] = [];
        for (const t of targets) {
          const list = cmd === "kill" ? st.procs.filter((p) => String(p.pid) === t) : st.procs.filter((p) => p.cmd.includes(t));
          if (!list.length) { errs.push(`${cmd}: (${t}) - Aucun processus de ce type`); continue; }
          for (const p of list) {
            if (p.pid === 1) { errs.push(`${cmd}: (1) - Opération non permise`); continue; }
            if (!root && p.user !== user) { errs.push(`${cmd}: (${p.pid}) - Opération non permise`); continue; }
            st.procs = st.procs.filter((x) => x !== p);
          }
        }
        return errs.length ? E(errs.join("\n")) : { out: "" };
      }
      case "ss": case "netstat": {
        const alive = (scn.listen || []).filter((l) => st.procs.some((p) => p.cmd.includes(l.process)));
        const rows = alive.map((l) => `${(l.proto || "tcp").padEnd(6)} LISTEN  ${(l.addr || "0.0.0.0") + ":" + l.port}`.padEnd(40) + ` users:(("${l.process}"))`);
        return { out: ["Netid  State   Local Address:Port                Process", ...rows].join("\n") };
      }
      case "ip": case "ifconfig": {
        const ifs = scn.interfaces?.length ? scn.interfaces : [{ name: "eth0", ip: "10.0.0.12/24" }];
        return { out: ["1: lo: <LOOPBACK,UP>\n    inet 127.0.0.1/8 scope host lo", ...ifs.map((x, i) => `${i + 2}: ${x.name}: <BROADCAST,UP>\n    inet ${x.ip} scope global ${x.name}`)].join("\n") };
      }
      default: {
        const p = cmd.includes("/") ? resolve(cmd) : null;
        if (p && st.nodes[p]?.t === "f") {
          if (!canAccess(p, 1, root)) return E(`bash: ${cmd}: Permission non accordée`);
          return { out: `(${baseOf(p)} exécuté : rien à afficher sur cette machine d'épreuve)` };
        }
        return E(`${cmd}: commande introuvable (tapez « help »)`);
      }
    }
  }
}

class ShellError extends Error {}

/** Correspondance « * » / « ? » sans expression régulière (temps borné). */
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

export function promptFor(scn: Scenario, cwd: string): string {
  const home = homeOf(scn);
  const shown = cwd === home ? "~" : cwd.startsWith(home + "/") ? "~" + cwd.slice(home.length) : cwd;
  return `${userOf(scn)}@${scn.hostname || "lab"}:${shown}$`;
}

/** Validation d'un scénario saisi par un admin (taille, forme, missions). */
export function validateScenario(x: any): string | null {
  if (!x || typeof x !== "object") return "Scénario JSON attendu";
  if (!x.files || typeof x.files !== "object") return "« files » est obligatoire";
  if (Object.keys(x.files).length > 500) return "500 fichiers maximum";
  if (JSON.stringify(x).length > 300_000) return "Scénario trop volumineux (300 Ko max)";
  for (const [k, v] of Object.entries(x.files)) {
    if (!String(k).startsWith("/")) return `Chemin absolu attendu : ${k}`;
    if (typeof v !== "string" && (typeof v !== "object" || v === null || typeof (v as any).content !== "string")) return `Contenu invalide pour ${k}`;
  }
  const types = ["exists", "absent", "contains", "equals", "mode", "process_absent", "process_present", "ran"];
  for (const o of x.objectives || []) {
    if (!o?.id || !o?.title || !o?.check || !types.includes(o.check.type)) return `Mission invalide : ${JSON.stringify(o).slice(0, 80)}`;
  }
  for (const p of x.processes || []) if (!Number.isInteger(p?.pid) || typeof p?.cmd !== "string") return "Processus invalide (pid entier et cmd attendus)";
  return null;
}
