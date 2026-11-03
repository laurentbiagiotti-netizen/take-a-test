/**
 * Type de question « sql » (sql.js, SQLite compilé en WebAssembly).
 *  - mode « query »     : écrire une requête ; son résultat doit être celui de la requête de référence
 *  - mode « injection » : saisir une valeur dans un formulaire vulnérable ; la requête construite
 *                         doit renvoyer la ligne visée (contournement de l'authentification)
 * Le même code tourne dans le navigateur (aperçu) et sur le serveur (note).
 */
export type SqlOptions = {
  mode: "query" | "injection";
  setup: string;               // CREATE TABLE … ; INSERT …
  template?: string;           // injection : requête avec {input}
  field_label?: string;        // injection : libellé du champ
  show_tables?: boolean;       // affiche les tables au candidat (mode query)
};
export type SqlKey = { expected_sql?: string; ordered?: boolean; must_contain?: string };
export type SqlResult = { columns: string[]; rows: (string | number | null)[][]; error?: string };

export const MAX_ROWS = 200;

/** Construit la requête du mode injection (aucun échappement : c'est le but de l'exercice). */
export const buildInjection = (template: string, input: string) => template.split("{input}").join(input);

export function validSqlOptions(o: any, key: any): string | null {
  if (!o || (o.mode !== "query" && o.mode !== "injection")) return "Mode « query » ou « injection » attendu";
  if (typeof o.setup !== "string" || !o.setup.trim() || o.setup.length > 50000) return "Script de création des tables requis";
  if (o.mode === "query" && (typeof key?.expected_sql !== "string" || !key.expected_sql.trim())) return "Requête de référence requise";
  if (o.mode === "injection") {
    if (typeof o.template !== "string" || !o.template.includes("{input}")) return "Requête vulnérable avec {input} requise";
    if (typeof key?.must_contain !== "string" || !key.must_contain) return "Valeur attendue dans le résultat requise";
  }
  return null;
}

/** Résultat normalisé pour comparer deux requêtes (ordre des lignes ignoré sauf si demandé). */
export function sameResult(a: SqlResult, b: SqlResult, ordered = false): boolean {
  if (a.error || b.error) return false;
  if (a.rows.length !== b.rows.length) return false;
  const norm = (r: SqlResult) => r.rows.map((row) => JSON.stringify(row.map((v) => (v === null ? null : typeof v === "number" ? Number(v.toFixed(6)) : String(v)))));
  const x = norm(a), y = norm(b);
  if (!ordered) { x.sort(); y.sort(); }
  return x.every((v, i) => v === y[i]);
}

export const containsValue = (r: SqlResult, v: string) => !r.error && r.rows.some((row) => row.some((c) => String(c) === v));
