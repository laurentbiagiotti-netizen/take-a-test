/**
 * Banque de questions en CSV (mêmes colonnes que le fichier Excel).
 * Séparateur « ; » et BOM UTF-8 pour qu'Excel l'ouvre correctement en
 * français ; à l'import, le séparateur est détecté (« ; », « , » ou tabulation)
 * et les retours à la ligne entre guillemets sont gardés.
 */
const RISKY = /^[=+\-@\t\r]/;

/** Une cellule qui commencerait par =, +, - ou @ est préfixée par « ' » (pas de formule dans Excel). */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (RISKY.test(s)) s = "'" + s;
  return /[";\n\r,\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const first = t.split(/\r?\n/, 1)[0] || "";
  const sep = [";", ",", "\t"].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"' && cur === "") q = true;
    else if (c === sep) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x !== "")) rows.push(row);
  // Préfixe anti-formule retiré à la relecture
  return rows.map((r) => r.map((x) => (/^'[=+\-@]/.test(x) ? x.slice(1) : x)));
}
