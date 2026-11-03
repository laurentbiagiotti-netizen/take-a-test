import { Worker } from "node:worker_threads";
import { buildInjection, containsValue, sameResult, type SqlKey, type SqlOptions, type SqlResult, MAX_ROWS } from "./sql-task";
import { gradeFirewall, validProgram, type FwPacket } from "./firewall";
import { policyChecks, type PasswordOptions } from "./password";
import { gradeSubnet } from "./subnet";
import { gradeNet } from "./netpuzzle";
import { gradeSokoban } from "./sokoban";
import { gradeRobot } from "./robot";
import { gradeAd } from "./adsim";
import { gradeTickets } from "./tickets";
import { gradeFeed } from "./feed";
import { gradeEvtx } from "./evtx";
import { gradeSim } from "./sim";
import { BASH_HOME, BASH_LIMITS, MAX_FILE, abs, datasets, scoreBash, type BashKey, type BashOptions, type BashRun } from "./bash-task";

/**
 * Notes calculées par le serveur pour les types qui ne se corrigent pas en SQL :
 * requêtes SQL (sql.js), mots de passe (zxcvbn-ts) et pare-feu en blocs.
 * La requête du candidat tourne dans un thread à part, tué au bout de 2 s
 * (une requête récursive infinie ne bloque pas le serveur).
 */

const WORKER = `
const { workerData, parentPort } = require("node:worker_threads");
const { createRequire } = require("node:module");
const req = createRequire(process.cwd() + "/package.json");
req("sql.js")().then((SQL) => {
  const out = [];
  for (const q of workerData.queries) {
    const db = new SQL.Database();
    try {
      db.run(workerData.setup);
      const res = db.exec(q);
      const last = res[res.length - 1];
      out.push(last ? { columns: last.columns, rows: last.values.slice(0, workerData.max) } : { columns: [], rows: [] });
    } catch (e) { out.push({ columns: [], rows: [], error: String(e && e.message || e).slice(0, 300) }); }
    finally { db.close(); }
  }
  parentPort.postMessage(out);
}).catch((e) => parentPort.postMessage({ fatal: String(e) }));
`;

export function runSql(setup: string, queries: string[], timeoutMs = 2000): Promise<SqlResult[]> {
  return new Promise((resolve) => {
    const w = new Worker(WORKER, { eval: true, workerData: { setup, queries, max: MAX_ROWS }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    const fail = (error: string) => resolve(queries.map(() => ({ columns: [], rows: [], error })));
    const t = setTimeout(() => { w.terminate(); fail("Requête trop longue (plus de 2 secondes)"); }, timeoutMs);
    w.once("message", (m: any) => { clearTimeout(t); w.terminate(); if (m?.fatal) { console.error("[sql]", m.fatal); fail("Moteur SQL indisponible"); } else resolve(m); });
    w.once("error", (e) => { clearTimeout(t); console.error("[sql]", e); fail("Moteur SQL indisponible"); });
  });
}

// Scripts Bash (just-bash) : même principe, dans un thread tué au bout de 6 s au total.
const BASH_WORKER = `
const { workerData, parentPort } = require("node:worker_threads");
const { createRequire } = require("node:module");
const req = createRequire(process.cwd() + "/package.json");
const { Bash } = req("just-bash");
const { home, limits, max, runs } = workerData;
const ROOTS = [home + "/", "/tmp/", "/srv/", "/var/", "/etc/", "/opt/"];
(async () => {
  const res = [];
  for (const { files, script } of runs) {
    const sh = new Bash({ files, cwd: home, env: { HOME: home, USER: "candidat", LANG: "fr_FR.UTF-8" }, executionLimits: limits });
    let r;
    try { r = await sh.exec(script); }
    catch (e) { res.push({ stdout: "", stderr: String(e && e.message || e).slice(0, 500), exitCode: 1, files: {}, dirs: [], error: "Le script n'a pas pu s'exécuter" }); continue; }
    const out = { stdout: String(r.stdout || "").slice(0, max), stderr: String(r.stderr || "").slice(0, 4000), exitCode: r.exitCode ?? 0, files: {}, dirs: [] };
    for (const p of sh.fs.getAllPaths().sort()) {
      if (!ROOTS.some((x) => p.startsWith(x))) continue;
      try {
        const st = await sh.fs.stat(p);
        if (st.isDirectory) out.dirs.push(p);
        else if (st.isFile && Object.keys(out.files).length < 300) out.files[p] = String(await sh.fs.readFile(p)).slice(0, max);
      } catch {}
    }
    res.push(out);
  }
  parentPort.postMessage(res);
})().catch((e) => parentPort.postMessage({ fatal: String(e) }));
`;

export function runBash(runs: { files: Record<string, string>; script: string }[], timeoutMs = 6000): Promise<BashRun[]> {
  const prepared = runs.map((r) => ({ script: r.script, files: Object.fromEntries(Object.entries(r.files).map(([p, v]) => [abs(p), v])) }));
  return new Promise((resolve) => {
    const w = new Worker(BASH_WORKER, { eval: true, workerData: { home: BASH_HOME, limits: BASH_LIMITS, max: MAX_FILE, runs: prepared }, resourceLimits: { maxOldGenerationSizeMb: 192 } });
    const fail = (error: string) => resolve(runs.map(() => ({ stdout: "", stderr: "", exitCode: 1, files: {}, dirs: [], error })));
    const t = setTimeout(() => { w.terminate(); fail("Script trop long"); }, timeoutMs);
    w.once("message", (m: any) => { clearTimeout(t); w.terminate(); if (m?.fatal) { console.error("[bash]", m.fatal); fail("Bash indisponible"); } else resolve(m); });
    w.once("error", (e) => { clearTimeout(t); console.error("[bash]", e); fail("Bash indisponible"); });
  });
}

export async function gradeBash(o: BashOptions, key: BashKey, resp: any, points: number): Promise<number> {
  const script = typeof resp?.script === "string" ? resp.script : "";
  if (!script.trim() || !key?.checks?.length) return 0;
  const sets = datasets(o, key);
  const runs = await runBash([...sets.map((files) => ({ files, script })), ...sets.map((files) => ({ files, script: key.solution }))]);
  return scoreBash(key, runs.slice(0, sets.length), runs.slice(sets.length), points);
}

async function gradeSql(o: SqlOptions, key: SqlKey, resp: any, points: number): Promise<number> {
  const input = typeof resp?.query === "string" ? resp.query : "";
  if (!input.trim()) return 0;
  if (o.mode === "injection") {
    const [r] = await runSql(o.setup, [buildInjection(o.template || "", input)]);
    return containsValue(r, String(key.must_contain)) ? points : 0;
  }
  const [mine, ref] = await runSql(o.setup, [input, key.expected_sql || ""]);
  return sameResult(mine, ref, !!key.ordered) ? points : 0;
}

let zx: Promise<(pw: string) => { score: number; guessesLog10: number }> | null = null;
function zxcvbn() {
  zx ||= (async () => {
    const [{ zxcvbn: run, zxcvbnOptions }, common, fr] = await Promise.all([
      import("@zxcvbn-ts/core"), import("@zxcvbn-ts/language-common"), import("@zxcvbn-ts/language-fr"),
    ]);
    zxcvbnOptions.setOptions({
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...fr.dictionary },
    });
    return (pw: string) => { const r = run(pw); return { score: r.score, guessesLog10: r.guessesLog10 }; };
  })();
  return zx;
}

/** Classement attendu (du plus faible au plus fort) d'après zxcvbn. */
export async function passwordOrder(items: { id: string; text: string }[]): Promise<string[]> {
  const z = await zxcvbn();
  return items.map((i) => ({ id: i.id, g: z(i.text).guessesLog10 })).sort((a, b) => a.g - b.g).map((x) => x.id);
}

async function gradePassword(o: PasswordOptions, resp: any, points: number): Promise<number> {
  if (o.mode === "rank") {
    const order: string[] = Array.isArray(resp?.order) ? resp.order : [];
    const expected = await passwordOrder(o.items);
    if (order.length !== expected.length) return 0;
    const ok = expected.filter((id, k) => order[k] === id).length;
    return Math.round((points * ok / expected.length) * 100) / 100;
  }
  const pw = typeof resp?.text === "string" ? resp.text : "";
  if (!pw || policyChecks(pw, o.policy).some((c) => !c.ok)) return 0;
  const z = await zxcvbn();
  return z(pw).score >= (o.policy.min_score ?? 3) ? points : 0;
}

/** Note d'une réponse pour les types notés par le serveur ; null pour les autres types. */
export async function autoScore(type: string, options: any, key: any, resp: any, points: number, seed = ""): Promise<number | null> {
  try {
    if (type === "subnet") return gradeSubnet(options, seed, resp, points);
    if (type === "netpuzzle") return gradeNet(options || {}, seed, resp, points);
    if (type === "sokoban") return gradeSokoban(options, resp, points);
    if (type === "robot") return gradeRobot(options, resp, points);
    if (type === "adsim") return gradeAd(key, resp, points);
    if (type === "tickets") return gradeTickets(options, key, resp, points);
    if (type === "feed") return gradeFeed(options, key, resp, points);
    if (type === "evtx") return gradeEvtx(options, key, resp, points);
    if (type === "sim") return gradeSim(options, key, resp, points);
    if (type === "bash") return await gradeBash(options, key, resp, points);
    if (type === "sql") return await gradeSql(options, key || {}, resp, points);
    if (type === "password") return await gradePassword(options, resp, points);
    if (type === "blocks") {
      const prog = validProgram(resp?.program) ? resp.program : null;
      return gradeFirewall(prog, (key?.packets || []) as FwPacket[], points).score;
    }
  } catch (e) { console.error("[autoScore]", type, e); return 0; }
  return null;
}

export const AUTO_TYPES = new Set(["sql", "password", "blocks", "subnet", "netpuzzle", "sokoban", "robot", "adsim", "tickets", "feed", "evtx", "bash", "sim"]);
