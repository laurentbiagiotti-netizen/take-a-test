/**
 * Lecture et écriture des fichiers Excel (exceljs). Utilisable côté
 * navigateur (éditeur de l'épreuve) et côté serveur (exports).
 */
import type ExcelJSType from "exceljs";
import { COLUMNS, FORMATIONS } from "./bank";

async function excel(): Promise<typeof ExcelJSType> {
  const m: any = await import("exceljs");
  return (m.default || m) as typeof ExcelJSType;
}

const NAVY = "FF0A1047";

function styleHeader(ws: ExcelJSType.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  row.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function cellText(v: ExcelJSType.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as any;
    if (o.richText) return o.richText.map((r: any) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v).trim();
}

/** Feuille « Questions » (ou la première) en lignes de texte. */
export async function readSheet(data: ArrayBuffer): Promise<string[][]> {
  const E = await excel();
  const wb = new E.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets.find((w) => w.name.toLowerCase().startsWith("question")) || wb.worksheets[0];
  if (!ws) throw new Error("Le fichier ne contient aucune feuille.");
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    const out: string[] = [];
    row.eachCell({ includeEmpty: true }, (c, col) => { out[col - 1] = cellText(c.value); });
    rows[n - 1] = Array.from(out, (x) => x ?? "");
  });
  return Array.from(rows, (r) => r ?? []);
}

/** Modèle à remplir, avec exemples et mode d'emploi (celui de la plateforme de Dylan). */
export async function bankWorkbook(rows: (string | number)[][], withExamples: boolean): Promise<ArrayBuffer> {
  const E = await excel();
  const wb = new E.Workbook();
  const ws = wb.addWorksheet("Questions");
  ws.columns = COLUMNS.map((h, i) => ({ header: h, key: `c${i}`, width: i === 0 ? 50 : i === 13 ? 40 : 18 }));
  styleHeader(ws);
  if (withExamples) {
    [
      ["Quel port utilise SSH par défaut ?", "QCM_unique", "21", "22", "80", "443", "", "", "B", "Réseaux", "Bachelor 1 Cybersécurité", 1, 30, "SSH écoute sur le port 22."],
      ["Lesquels sont des protocoles chiffrés ?", "QCM_multiple", "HTTPS", "Telnet", "SSH", "FTP", "", "", "A;C", "Réseaux", "Bachelor 1 Cybersécurité", 2, 45, ""],
      ["La commande ls liste le contenu d'un dossier sous Linux.", "Vrai_Faux", "", "", "", "", "", "", "Vrai", "Systèmes", "", 1, "", ""],
      ["Quelle commande affiche le dossier courant sous Linux ?", "Reponse_courte", "", "", "", "", "", "", "pwd", "Systèmes", "Bachelor 2 Cybersécurité", 1, "", "Plusieurs réponses acceptées : séparer par ;"],
    ].forEach((r) => ws.addRow(r));
  }
  rows.forEach((r) => ws.addRow(r));
  const help = wb.addWorksheet("Mode d'emploi");
  help.columns = [{ width: 24 }, { width: 90 }];
  [
    ["Colonne", "Comment la remplir"],
    ["Question", "Texte de la question (obligatoire)."],
    ["Type", "QCM_unique, QCM_multiple, Vrai_Faux ou Reponse_courte. Toutes les questions sont corrigées automatiquement."],
    ["Réponse A à F", "Propositions pour les QCM (2 à 6). Laisser vide pour Vrai_Faux et Reponse_courte."],
    ["Bonne(s) réponse(s)", "QCM : lettre(s), séparées par ; (ex. A;C). Vrai_Faux : Vrai ou Faux. Reponse_courte : réponses acceptées séparées par ; (majuscules et accents ignorés)."],
    ["Thème", "Domaine de la question (ex. Réseaux, Systèmes). Sert aux scores par domaine, aux planchers et aux statistiques. Les thèmes proches sont regroupés."],
    ["Formation visée", `${FORMATIONS.join(", ")}. Vide = question commune. À l'import, seules les questions de la formation choisie et les questions communes sont gardées.`],
    ["Points", "Barème de la question (1 par défaut)."],
    ["Temps (secondes)", "Facultatif. Temps de réponse propre à la question quand l'épreuve est chronométrée question par question."],
    ["Explication", "Facultatif. Visible par l'équipe et sur la fiche de correction, jamais par le candidat."],
  ].forEach((r) => help.addRow(r));
  help.getRow(1).font = { bold: true };
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Classeur simple : une feuille, en-tête stylé, largeurs données. */
export async function tableWorkbook(sheet: string, columns: { header: string; width?: number }[], rows: unknown[][]): Promise<ArrayBuffer> {
  const E = await excel();
  const wb = new E.Workbook();
  const ws = wb.addWorksheet(sheet);
  ws.columns = columns.map((c, i) => ({ header: c.header, key: `c${i}`, width: c.width ?? 16 }));
  styleHeader(ws);
  // Anti injection de formules : un texte qui commence par = + - @ reste du texte.
  rows.forEach((r) => ws.addRow(r.map((v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v))));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
