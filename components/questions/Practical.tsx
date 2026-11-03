"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DECODE_OPS, OP_LABEL, runRecipe, type DecodeOp, type RecipeStep } from "@/lib/questions/decode";
import { buildInjection, MAX_ROWS, type SqlOptions, type SqlResult } from "@/lib/questions/sql-task";
import { policyChecks, type PasswordPolicy } from "@/lib/questions/password";

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

function ResultTable({ r }: { r: SqlResult }) {
  if (r.error) return <p className="text-sm text-danger font-mono whitespace-pre-wrap">Erreur : {r.error}</p>;
  if (!r.columns.length) return <p className="text-sm text-muted">Requête exécutée, aucun résultat à afficher.</p>;
  return (
    <div className="overflow-auto max-h-72 rounded-lg border border-line">
      <table className="w-full text-xs font-mono">
        <thead className="bg-surface-2 sticky top-0"><tr>{r.columns.map((c) => <th key={c} className="text-left px-3 py-2 text-muted font-semibold">{c}</th>)}</tr></thead>
        <tbody>{r.rows.map((row, i) => <tr key={i} className="border-t border-line">{row.map((v, j) => <td key={j} className="px-3 py-1.5 whitespace-nowrap">{v === null ? <i className="text-faint">NULL</i> : String(v)}</td>)}</tr>)}</tbody>
      </table>
      <div className="px-3 py-1.5 text-[11px] text-faint border-t border-line">{r.rows.length} ligne(s){r.rows.length >= MAX_ROWS ? ` (limité à ${MAX_ROWS})` : ""}</div>
    </div>
  );
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
  const text: string = value?.query || "";
  useEffect(() => { loadSql().then(setSQL).catch(() => setLoadErr(true)); }, []);
  const tables = useTables(SQL, o.setup || "");
  const injection = o.mode === "injection";
  const built = injection ? buildInjection(o.template || "", text) : text;

  const run = () => { if (SQL && built.trim()) setResult(runLocal(SQL, o.setup || "", built)); };

  return (
    <div className="space-y-4">
      {!injection && o.show_tables !== false && (
        <div className="grid sm:grid-cols-2 gap-2">
          {tables.map((t) => (
            <div key={t.name} className="rounded-lg border border-line bg-surface-2/60 p-3">
              <div className="font-mono text-sm"><b className="text-accent">{t.name}</b> <span className="text-faint text-xs">({t.n} lignes)</span></div>
              <div className="text-xs text-muted font-mono mt-1 leading-relaxed">{t.cols.join(", ")}</div>
            </div>
          ))}
          {!SQL && !loadErr && <p className="text-sm text-muted">Chargement de la base…</p>}
        </div>
      )}
      {loadErr && <p className="text-sm text-danger">Le moteur SQL n&apos;a pas pu se charger : votre réponse est quand même enregistrée et corrigée.</p>}

      {injection ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-bg p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Code du serveur (extrait)</div>
            <pre className="text-xs font-mono whitespace-pre-wrap text-fg/90">{o.template?.replace("{input}", "' + saisie + '")}</pre>
          </div>
          <label className="block text-sm">{o.field_label || "Identifiant"}
            <input className="input mt-1 font-mono" maxLength={4000} autoComplete="off" spellCheck={false} value={text}
              onChange={(e) => onText({ query: e.target.value })} />
          </label>
          <div className="text-xs text-muted">Requête envoyée à la base :</div>
          <pre className="text-xs font-mono whitespace-pre-wrap rounded-lg bg-surface-2 border border-line p-3">{built}</pre>
        </div>
      ) : (
        <label className="block text-sm">Votre requête SQL
          <textarea className="input mt-1 font-mono min-h-[120px] !rounded-xl" maxLength={4000} spellCheck={false} autoComplete="off"
            placeholder="SELECT …" value={text} onChange={(e) => onText({ query: e.target.value })}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); } }} />
        </label>
      )}
      <div className="flex items-center gap-3">
        <button type="button" className="btn-secondary" onClick={run} disabled={!SQL || !built.trim()}>▶ Exécuter</button>
        <span className="text-xs text-faint">{injection ? "Essayez autant de fois que vous voulez." : "Ctrl + Entrée pour exécuter. Seule la dernière requête saisie compte."}</span>
      </div>
      {result && <ResultTable r={result} />}
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

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Message intercepté</div>
        <pre className="text-sm font-mono whitespace-pre-wrap break-all rounded-lg bg-bg border border-line p-3 max-h-40 overflow-auto">{input}</pre>
      </div>
      <div className="grid md:grid-cols-[14rem_1fr] gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Opérations</div>
          <div className="flex flex-wrap md:flex-col gap-1.5">
            {ops.map((o) => (
              <button key={o.op} type="button" title={o.hint} disabled={recipe.length >= 20}
                className="text-left text-sm rounded-md border border-line bg-surface-2/60 px-3 py-1.5 hover:border-accent hover:text-accent"
                onClick={() => set([...recipe, { op: o.op, ...(o.arg ? { arg: o.op === "caesar" ? "3" : "" } : {}) }])}>+ {o.label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Votre recette (appliquée de haut en bas)</div>
          {recipe.length === 0 && <p className="text-sm text-faint border border-dashed border-line rounded-lg p-4">Ajoutez des opérations à gauche pour décoder le message.</p>}
          <ol className="space-y-1.5">
            {recipe.map((s, i) => {
              const meta = DECODE_OPS.find((o) => o.op === s.op);
              return (
                <li key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${out.failedAt === i ? "border-danger/60 bg-danger/5" : "border-line bg-surface-2/60"}`}>
                  <span className="text-faint font-mono text-xs w-5">{i + 1}.</span>
                  <b className="flex-1">{OP_LABEL[s.op]}</b>
                  {meta?.arg && <input className="input !w-32 !py-1 font-mono text-xs" aria-label={meta.arg} placeholder={meta.arg} maxLength={100} value={s.arg || ""}
                    onChange={(e) => set(recipe.map((x, k) => (k === i ? { ...x, arg: e.target.value } : x)))} />}
                  <button type="button" className="text-muted hover:text-fg px-1" aria-label="Monter" disabled={i === 0} onClick={() => { const r = recipe.slice(); [r[i - 1], r[i]] = [r[i], r[i - 1]]; set(r); }}>↑</button>
                  <button type="button" className="text-muted hover:text-fg px-1" aria-label="Descendre" disabled={i === recipe.length - 1} onClick={() => { const r = recipe.slice(); [r[i + 1], r[i]] = [r[i], r[i + 1]]; set(r); }}>↓</button>
                  <button type="button" className="text-muted hover:text-danger px-1" aria-label="Retirer" onClick={() => set(recipe.filter((_, k) => k !== i))}>×</button>
                </li>
              );
            })}
          </ol>
          <div className="text-[11px] uppercase tracking-wider text-muted mt-4 mb-1">Résultat</div>
          <pre className={`text-sm font-mono whitespace-pre-wrap break-all rounded-lg border p-3 min-h-[3rem] max-h-40 overflow-auto ${out.error ? "border-danger/50 text-danger" : "border-accent/40 bg-accent/5"}`}>
            {out.error ? `Étape ${(out.failedAt ?? 0) + 1} : ${out.error}` : out.text || " "}
          </pre>
          {!out.error && !out.printable && <p className="text-xs text-muted mt-1">Octets non lisibles, affichés en hexadécimal : il manque sans doute une étape.</p>}
        </div>
      </div>
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
