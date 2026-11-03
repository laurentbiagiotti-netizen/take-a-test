"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DECODE_OPS, OP_LABEL, runRecipe, type DecodeOp, type RecipeStep } from "@/lib/questions/decode";
import { buildInjection, MAX_ROWS, type SqlOptions, type SqlResult } from "@/lib/questions/sql-task";
import { policyChecks, type PasswordPolicy } from "@/lib/questions/password";
import AppWindow from "@/components/questions/AppWindow";

/* ---------------- SQL (sql.js dans le navigateur, pour l'aperçu seulement) ---------------- */

let sqlInit: Promise<any> | null = null;
function loadSql() {
  sqlInit ||= import("sql.js").then((m: any) => (m.default || m)({ locateFile: () => "/vendor/sql-wasm.wasm" }));
  return sqlInit;
}

function runLocal(SQL: any, setup: string, query: string): SqlResult {
  const db = new SQL.Database();
  try {
    db.run(setup);
    const res = db.exec(query);
    const last = res[res.length - 1];
    return last ? { columns: last.columns, rows: last.values.slice(0, MAX_ROWS) } : { columns: [], rows: [] };
  } catch (e: any) {
    return { columns: [], rows: [], error: String(e?.message || e).slice(0, 300) };
  } finally { db.close(); }
}

/** Noms et colonnes des tables, lus dans la base de l'exercice. */
function useTables(SQL: any, setup: string) {
  return useMemo(() => {
    if (!SQL) return [];
    const r = runLocal(SQL, setup, "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    return r.rows.map(([name]) => {
      const cols = runLocal(SQL, setup, `PRAGMA table_info(${JSON.stringify(String(name))})`).rows.map((c) => `${c[1]} ${c[2] || ""}`.trim());
      const n = runLocal(SQL, setup, `SELECT COUNT(*) FROM ${JSON.stringify(String(name))}`).rows[0]?.[0];
      return { name: String(name), cols, n: Number(n || 0) };
    });
  }, [SQL, setup]);
}

export function SqlQuestion({ q, value, onText }: { q: any; value: any; onText: (r: any) => void }) {
  const o: SqlOptions = q.options || {};
  const [SQL, setSQL] = useState<any>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [ms, setMs] = useState(0);
  const [openT, setOpenT] = useState<Set<string>>(new Set());
  const [tried, setTried] = useState(false);
  const text: string = value?.query || "";
  useEffect(() => { loadSql().then(setSQL).catch(() => setLoadErr(true)); }, []);
  const tables = useTables(SQL, o.setup || "");
  const injection = o.mode === "injection";
  const built = injection ? buildInjection(o.template || "", text) : text;
  const exec = (sql: string) => { if (!SQL || !sql.trim()) return; const t = performance.now(); setResult(runLocal(SQL, o.setup || "", sql)); setMs(Math.max(1, Math.round(performance.now() - t))); };
  const run = () => exec(built);
  const lines = Math.max(6, text.split("\n").length);

  if (injection) {
    const ok = result && !result.error && result.rows.length > 0;
    return (
      <div className="space-y-4">
        <AppWindow title="Intranet" kind="browser" url="https://intranet.ecole.example/connexion" bodyClass="bg-[#f4f6fb] text-[#1f2937]">
          <div className="py-10 px-4 grid place-items-center">
            <form className="w-full max-w-sm bg-white rounded-xl shadow-md border border-[#e5e7eb] p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); setTried(true); run(); }}>
              <div className="text-center"><div className="text-2xl" aria-hidden>🏫</div><div className="font-semibold text-lg">Intranet de l&apos;école</div><div className="text-xs text-[#6b7280]">Connectez-vous pour accéder à votre espace</div></div>
              <label className="block text-sm">{o.field_label || "Identifiant"}
                <input className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 font-mono text-sm text-[#111827] bg-white outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20" maxLength={4000} autoComplete="off" spellCheck={false}
                  value={text} onChange={(e) => { onText({ query: e.target.value }); setTried(false); }} />
              </label>
              <label className="block text-sm">Mot de passe
                <input className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm bg-[#f9fafb] text-[#9ca3af]" type="password" value="motdepasse" readOnly tabIndex={-1} aria-label="Mot de passe (inconnu)" />
              </label>
              <button className="w-full rounded-md bg-[#2563eb] text-white py-2 text-sm font-semibold disabled:opacity-50" disabled={!SQL || !text.trim()}>Se connecter</button>
              {tried && result && (ok
                ? <div className="rounded-md bg-[#dcfce7] text-[#166534] text-sm px-3 py-2">Bienvenue <b>{String(result.rows[0][0])}</b>{result.rows[0][1] !== undefined ? ` (${String(result.rows[0][1])})` : ""}</div>
                : <div className="rounded-md bg-[#fee2e2] text-[#991b1b] text-sm px-3 py-2">{result.error ? "Erreur du serveur : requête invalide" : "Identifiant ou mot de passe incorrect"}</div>)}
            </form>
          </div>
          <div className="border-t border-[#d1d5db] bg-[#1e1e1e] text-[#d4d4d4] text-xs font-mono">
            <div className="flex gap-4 px-3 py-1.5 bg-[#252526] text-[11px] text-white/60"><span className="text-white border-b-2 border-[#4fc1ff] pb-0.5">Code du serveur</span><span>Requête SQL envoyée</span></div>
            <pre className="px-3 py-2 whitespace-pre-wrap"><span className="text-[#6a9955]">{"// login.php (extrait)"}</span>{"\n"}<span className="text-[#9cdcfe]">$sql</span> = <span className="text-[#ce9178]">&quot;{o.template?.replace("{input}", "\" . $_POST['login'] . \"")}&quot;</span>;</pre>
            <pre className="px-3 pb-3 whitespace-pre-wrap text-[#dcdcaa]">{built}</pre>
          </div>
        </AppWindow>
        {loadErr && <p className="text-sm text-danger">Le moteur SQL n&apos;a pas pu se charger : votre réponse est quand même enregistrée et corrigée.</p>}
        <p className="text-xs text-faint">Essayez autant de fois que vous voulez. Seule la dernière saisie compte.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AppWindow title="DB Studio : ecole.db" dark bodyClass="bg-[#1e1f22] text-[#cfd3da] text-xs">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-[#2b2d31] border-b border-black/40">
          <button type="button" onClick={run} disabled={!SQL || !built.trim()} className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-white/10 disabled:opacity-40 text-[#6fdc8c]" title="Exécuter (Ctrl + Entrée)">▶ <span className="text-[#cfd3da]">Exécuter</span></button>
          <span className="w-px h-4 bg-white/10 mx-1" />
          <span className="text-white/40">Base : <span className="text-white/70">ecole.db (SQLite)</span></span>
          <span className="ml-auto text-white/30">Ctrl + Entrée</span>
        </div>
        <div className="grid grid-cols-[13rem_1fr] max-md:grid-cols-1 min-h-[22rem]">
          {o.show_tables !== false ? (
            <nav className="border-r border-black/40 bg-[#232428] py-2 overflow-auto max-h-[30rem]" aria-label="Navigateur de base">
              <div className="px-3 py-1 text-white/50 uppercase tracking-wider text-[10px]">Navigateur</div>
              <div className="px-3 py-1">🗄️ ecole.db</div>
              <div className="pl-6 pr-2 py-1 text-white/60">📁 Tables ({tables.length})</div>
              {tables.map((t) => (
                <div key={t.name}>
                  <button type="button" onClick={() => setOpenT((x) => { const n = new Set(x); if (n.has(t.name)) n.delete(t.name); else n.add(t.name); return n; })} onDoubleClick={() => exec(`SELECT * FROM ${t.name} LIMIT 50;`)}
                    className="w-full text-left pl-8 pr-2 py-1 hover:bg-white/5 flex items-center gap-1.5" title="Double-clic : aperçu des données">
                    <span className="text-white/40 w-3">{openT.has(t.name) ? "▾" : "▸"}</span><span aria-hidden>▦</span><span className="text-[#8ab4f8]">{t.name}</span><span className="ml-auto text-white/30">{t.n}</span>
                  </button>
                  {openT.has(t.name) && t.cols.map((c) => { const [n, ty] = c.split(" "); return <div key={c} className="pl-14 pr-2 py-0.5 text-white/60 flex gap-2"><span aria-hidden className="text-[#f0c674]">◆</span>{n}<span className="ml-auto text-white/30 lowercase">{ty}</span></div>; })}
                </div>
              ))}
              {!SQL && !loadErr && <div className="px-3 py-2 text-white/40">Connexion…</div>}
              <div className="px-3 pt-3 text-[10.5px] text-white/30 leading-snug">Clic : colonnes · double-clic : aperçu des données</div>
            </nav>
          ) : <div className="max-md:hidden border-r border-black/40 bg-[#232428]" />}
          <div className="min-w-0 flex flex-col">
            <div className="flex bg-[#2b2d31] border-b border-black/40"><span className="px-3 py-1.5 bg-[#1e1f22] border-t-2 border-[#4e8cff] text-white">Requête 1.sql</span></div>
            <div className="flex font-mono text-[12.5px] leading-5 bg-[#1e1f22]">
              <div aria-hidden className="select-none text-right px-2 py-2 text-white/25">{Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}</div>
              <textarea className="flex-1 bg-transparent outline-none resize-none py-2 pr-3 text-[#e6e6e6] caret-[#4e8cff]" style={{ height: `${lines * 1.25 + 1}rem` }}
                aria-label="Votre requête SQL" wrap="off" maxLength={4000} spellCheck={false} autoComplete="off" placeholder="SELECT …" value={text}
                onChange={(e) => onText({ query: e.target.value })}
                onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); } }} />
            </div>
            <div className="border-t border-black/40 flex-1 flex flex-col min-h-[10rem]">
              <div className="flex bg-[#2b2d31] text-white/60"><span className="px-3 py-1.5 text-white border-b-2 border-[#4e8cff]">Résultats</span></div>
              <div className="flex-1 overflow-auto max-h-64">
                {!result ? <div className="p-3 text-white/30">Exécutez une requête pour voir le résultat.</div>
                  : result.error ? <div className="p-3 font-mono text-[#ff8a80] whitespace-pre-wrap">Erreur SQL : {result.error}</div>
                  : !result.columns.length ? <div className="p-3 text-white/50">Requête exécutée, aucun résultat à afficher.</div>
                  : (
                    <table className="font-mono text-[12px] border-collapse">
                      <thead className="sticky top-0 bg-[#2b2d31]"><tr><th className="px-2 py-1 text-white/30 font-normal border-r border-b border-black/40">#</th>{result.columns.map((c) => <th key={c} className="text-left px-3 py-1 font-semibold text-[#cfd3da] border-r border-b border-black/40 whitespace-nowrap">{c}</th>)}</tr></thead>
                      <tbody>{result.rows.map((row, i) => <tr key={i} className={i % 2 ? "bg-white/[0.02]" : ""}><td className="px-2 text-right text-white/30 border-r border-black/30">{i + 1}</td>{row.map((v, j) => <td key={j} className="px-3 py-0.5 whitespace-nowrap border-r border-black/30">{v === null ? <i className="text-white/30">NULL</i> : String(v)}</td>)}</tr>)}</tbody>
                    </table>
                  )}
              </div>
            </div>
            <div className="flex gap-4 px-3 py-1 bg-[#2b2d31] border-t border-black/40 text-[11px] text-white/40">
              <span>{result && !result.error ? `${result.rows.length} ligne(s)${result.rows.length >= MAX_ROWS ? ` (limité à ${MAX_ROWS})` : ""}` : "Prêt"}</span>
              {result && <span>{ms} ms</span>}
              <span className="ml-auto">SQLite · UTF-8</span>
            </div>
          </div>
        </div>
      </AppWindow>
      {loadErr && <p className="text-sm text-danger">Le moteur SQL n&apos;a pas pu se charger : votre réponse est quand même enregistrée et corrigée.</p>}
      <p className="text-xs text-faint">Seule la dernière requête écrite compte.</p>
    </div>
  );
}

/* ---------------- Décodage (recette façon CyberChef) ---------------- */

export function DecodeQuestion({ q, value, onText }: { q: any; value: any; onText: (r: any) => void }) {
  const input: string = q.options?.input || "";
  const allowed: DecodeOp[] = q.options?.ops?.length ? q.options.ops : DECODE_OPS.map((o) => o.op);
  const recipe: RecipeStep[] = Array.isArray(value?.recipe) ? value.recipe : [];
  const flag: string = value?.text || "";
  const out = useMemo(() => runRecipe(input, recipe), [input, recipe]);
  const set = (r: RecipeStep[], t = flag) => onText({ recipe: r, text: t });
  const ops = DECODE_OPS.filter((o) => allowed.includes(o.op));
  const [opq, setOpq] = useState("");

  const shownOps = ops.filter((o) => !opq.trim() || o.label.toLowerCase().includes(opq.trim().toLowerCase()));
  const head = "px-3 h-9 flex items-center bg-[#f3f3f3] border-b border-[#ddd] text-[15px] text-[#333]";
  const add = (op: DecodeOp) => { const o = DECODE_OPS.find((x) => x.op === op); if (recipe.length < 20) set([...recipe, { op, ...(o?.arg ? { arg: op === "caesar" ? "3" : "" } : {}) }]); };

  return (
    <div className="space-y-4">
      <AppWindow title="Atelier de décodage" kind="browser" url="https://outils.ecole.example/decodeur/" bodyClass="bg-white text-[#333] text-[13px]">
        <div className="grid grid-cols-[13rem_1fr_1.3fr] max-lg:grid-cols-1 h-[30rem] max-lg:h-auto">
          <div className="border-r border-[#ddd] flex flex-col min-h-0">
            <div className={head}>Opérations</div>
            <input className="mx-2 my-2 rounded border border-[#ccc] px-2 py-1 text-[13px] bg-white text-[#333] outline-none focus:border-[#3c80c7]" placeholder="Rechercher…" value={opq} onChange={(e) => setOpq(e.target.value)} aria-label="Rechercher une opération" />
            <div className="px-3 pb-1 text-[11px] font-semibold text-[#888] uppercase">Encodage et chiffrement</div>
            <ul className="overflow-auto flex-1">
              {shownOps.map((o) => (
                <li key={o.op}><button type="button" title={`${o.hint} (cliquez pour l'ajouter)`} disabled={recipe.length >= 20} onClick={() => add(o.op)}
                  className="w-full text-left px-3 py-1.5 border-b border-[#eee] hover:bg-[#e6f0fa] flex items-center"><span className="flex-1">{o.label}</span><span className="text-[#3c80c7] text-[15px]" aria-hidden>+</span></button></li>
              ))}
            </ul>
          </div>
          <div className="border-r border-[#ddd] flex flex-col min-h-0 bg-[#fafafa]">
            <div className={head}>Recette <span className="ml-auto text-[12px] text-[#888]">{recipe.length ? <button type="button" className="hover:text-[#c00]" onClick={() => set([])}>🗑 Vider</button> : null}</span></div>
            <ol className="flex-1 overflow-auto p-2 space-y-2">
              {recipe.length === 0 && <li className="text-[#999] text-center pt-10 px-4">Cliquez sur une opération pour l&apos;ajouter à la recette. Elles s&apos;appliquent de haut en bas.</li>}
              {recipe.map((st, i) => {
                const meta = DECODE_OPS.find((o) => o.op === st.op);
                const bad = out.failedAt === i;
                return (
                  <li key={i} className={`rounded border px-2.5 py-2 ${bad ? "border-[#e0a0a0] bg-[#f8e3e3]" : "border-[#c9dfc9] bg-[#e7f3e7]"}`}>
                    <div className="flex items-center gap-1">
                      <b className="flex-1 text-[13px]">{OP_LABEL[st.op]}</b>
                      <button type="button" className="text-[#777] hover:text-[#333] px-1" aria-label="Monter" disabled={i === 0} onClick={() => { const r = recipe.slice(); [r[i - 1], r[i]] = [r[i], r[i - 1]]; set(r); }}>▲</button>
                      <button type="button" className="text-[#777] hover:text-[#333] px-1" aria-label="Descendre" disabled={i === recipe.length - 1} onClick={() => { const r = recipe.slice(); [r[i + 1], r[i]] = [r[i], r[i + 1]]; set(r); }}>▼</button>
                      <button type="button" className="text-[#777] hover:text-[#c00] px-1" aria-label="Retirer" onClick={() => set(recipe.filter((_, k) => k !== i))}>✕</button>
                    </div>
                    {meta?.arg && (
                      <label className="mt-1.5 block text-[11px] text-[#666]">{meta.arg}
                        <input className="mt-0.5 w-full rounded border border-[#bbb] bg-white px-2 py-1 font-mono text-[12px] text-[#222]" maxLength={100} value={st.arg || ""}
                          onChange={(e) => set(recipe.map((x, k) => (k === i ? { ...x, arg: e.target.value } : x)))} />
                      </label>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="flex flex-col min-h-0">
            <div className={head}>Entrée <span className="ml-auto text-[11px] text-[#888]">longueur : {input.length}</span></div>
            <pre className="flex-1 overflow-auto p-3 font-mono text-[12.5px] whitespace-pre-wrap break-all bg-white min-h-[6rem]">{input}</pre>
            <div className={`${head} border-t`}>Sortie <span className="ml-auto text-[11px] text-[#888]">{out.error ? "erreur" : `longueur : ${(out.text || "").length}`}</span></div>
            <pre className={`flex-1 overflow-auto p-3 font-mono text-[12.5px] whitespace-pre-wrap break-all min-h-[6rem] ${out.error ? "text-[#c00] bg-[#fff5f5]" : "bg-white text-[#111]"}`}>
              {out.error ? `Étape ${(out.failedAt ?? 0) + 1} : ${out.error}` : out.text || " "}
            </pre>
            {!out.error && !out.printable && <div className="px-3 py-1 text-[11px] text-[#a15c00] bg-[#fff6e5] border-t border-[#f0d9a8]">Octets non lisibles, affichés en hexadécimal : il manque sans doute une étape.</div>}
          </div>
        </div>
      </AppWindow>
      <label className="block text-sm">Flag trouvé
        <input className="input mt-1 font-mono" maxLength={500} placeholder="CYBER{...}" autoComplete="off" spellCheck={false} value={flag}
          onChange={(e) => set(recipe, e.target.value)} />
      </label>
    </div>
  );
}

/* ---------------- Mots de passe : création ---------------- */

export function PasswordCreate({ q, value, onText }: { q: any; value: any; onText: (r: any) => void }) {
  const policy: PasswordPolicy = q.options?.policy || {};
  const [show, setShow] = useState(false);
  const pw: string = value?.text || "";
  const checks = policyChecks(pw, policy);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <label className="block text-sm">Votre mot de passe
        <div className="flex gap-2 mt-1">
          <input ref={ref} className="input font-mono" type={show ? "text" : "password"} maxLength={128} autoComplete="off" spellCheck={false}
            value={pw} onChange={(e) => onText({ text: e.target.value })} />
          <button type="button" className="btn-secondary !px-3" onClick={() => setShow((s) => !s)}>{show ? "Masquer" : "Afficher"}</button>
        </div>
      </label>
      {checks.length > 0 && (
        <ul className="grid sm:grid-cols-2 gap-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-2 ${c.ok ? "text-ok" : "text-muted"}`}>
              <span aria-hidden className={`w-4 h-4 rounded-full grid place-items-center text-[10px] ${c.ok ? "bg-ok text-bg" : "border border-line-strong"}`}>{c.ok ? "✓" : ""}</span>
              {c.label}<span className="sr-only">{c.ok ? " : respecté" : " : pas encore"}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-faint">N&apos;utilisez pas un de vos vrais mots de passe. La robustesse réelle (résistance aux attaques par dictionnaire et par force brute) est évaluée à la correction.</p>
    </div>
  );
}
