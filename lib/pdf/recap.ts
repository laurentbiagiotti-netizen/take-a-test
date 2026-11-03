/**
 * Fiche de correction d'un candidat au format PDF (repris de la plateforme de
 * Dylan) : synthèse et résultat, détail par domaine, surveillance, copie
 * corrigée question par question, journal horodaté en annexe.
 * Côté serveur uniquement (PDFKit).
 */
import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
import path from "node:path";

const C = {
  navy: "#0A1047", indigo: "#303880", orange: "#FD7119", orangeL: "#FFA364", cream: "#F6E9E0",
  line: "#E4D5CA", muted: "#4A5085", white: "#FFFFFF", pass: "#153402", fail: "#7A1300", soft: "#FBF5F0",
  passT: "#E3EEDC", failT: "#F7E0DB", orangeT: "#FFEBDC", grey: "#9AA0C8",
};
const STATUS_STYLE: Record<string, [string, string, string]> = {
  full: [C.pass, C.white, "CORRECT"], partial: [C.orange, C.navy, "PARTIEL"],
  zero: [C.fail, C.white, "FAUX"], manual: [C.orangeL, C.navy, "À CORRIGER"], none: [C.grey, C.white, "SANS RÉPONSE"],
};
const VERDICT_STYLE: Record<string, [string, string]> = { pass: [C.pass, C.cream], fail: [C.fail, C.cream], review: [C.orangeL, C.navy] };

export type RecapOption = { text: string; correct: boolean; chosen: boolean };
export type RecapQuestion = {
  n: number; prompt: string; meta: string; points: number | null; max: number;
  status: "full" | "partial" | "zero" | "manual" | "none";
  options?: RecapOption[];
  answer?: string; expected?: string; explanation?: string | null; extra?: string[];
};
export type RecapData = {
  candidate: string; email: string; ref?: string | null; test: string; formation?: string | null; attemptId: string;
  started: string; ended: string; duration: string; endReason: string; extraMinutes: number;
  score20: number | null; points: number | null; max: number | null;
  verdict: "pass" | "review" | "fail" | null; verdictLabel: string; thresholds: string;
  override?: { label: string; reason: string; by?: string | null; auto?: string | null } | null;
  needsManual: boolean; belowFloors: string[];
  domains: { name: string; score: number; max: number; ratio: number; floor: number | null; below: boolean }[];
  surveillance: { label: string; count: number; serious: boolean }[];
  violations: number; suspicion?: string | null; receipt?: string | null; ip?: string | null;
  questions: RecapQuestion[];
  timeline: { time: string; label: string; serious: boolean; detail: string }[];
};

const num = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined || !Number.isFinite(n) ? "-" : Number(n).toLocaleString("fr-FR", { maximumFractionDigits: d });

function fonts(doc: PDFKit.PDFDocument) {
  const dir = path.join(process.cwd(), "node_modules", "@fontsource");
  doc.registerFont("Body", readFileSync(path.join(dir, "dm-sans/files/dm-sans-latin-400-normal.woff")));
  doc.registerFont("Semi", readFileSync(path.join(dir, "dm-sans/files/dm-sans-latin-600-normal.woff")));
  doc.registerFont("Bold", readFileSync(path.join(dir, "dm-sans/files/dm-sans-latin-700-normal.woff")));
  doc.registerFont("Display", readFileSync(path.join(dir, "archivo-black/files/archivo-black-latin-400-normal.woff")));
}

/** Les polices web n'ont pas tous les signes : on remplace ceux qui manqueraient. */
const clean = (s: unknown) => String(s ?? "").replace(/[—]/g, ",").replace(/[→]/g, "->").replace(/[^\u0000-ɏ‘-„•…€\s]/g, "");

export function renderRecap(d: RecapData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4", bufferPages: true, margins: { top: 58, bottom: 56, left: 40, right: 40 },
      info: { Title: `Fiche de correction - ${d.candidate} - ${d.test}`, Author: "Cybersup", Subject: "Test d'admission" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try { draw(doc, d); } catch (e) { reject(e); return; }
    doc.end();
  });
}

function draw(doc: PDFKit.PDFDocument, d: RecapData) {
  fonts(doc);
  const M = 40, W = doc.page.width - 2 * M, bottom = () => doc.page.height - 60;
  const ensure = (h: number) => { if (doc.y + h > bottom()) doc.addPage(); };
  const h2 = (t: string) => {
    ensure(40);
    doc.moveDown(0.6).font("Display").fontSize(12).fillColor(C.navy).text(clean(t).toUpperCase(), M, doc.y);
    doc.moveTo(M, doc.y + 3).lineTo(M + 40, doc.y + 3).lineWidth(2).strokeColor(C.orange).stroke();
    doc.moveDown(0.8);
  };

  // En-tête
  doc.rect(0, 0, doc.page.width, 118).fill(C.navy);
  doc.font("Display").fontSize(16).fillColor(C.white).text("CYBERSUP", M, 26);
  doc.font("Semi").fontSize(9).fillColor(C.orangeL).text("FICHE DE CORRECTION", M, 48, { characterSpacing: 1.5 });
  doc.font("Bold").fontSize(18).fillColor(C.white).text(clean(d.candidate), M, 64, { width: W - 150 });
  doc.font("Body").fontSize(9).fillColor(C.cream)
    .text(clean(`${d.email}${d.ref ? ` · réf. ${d.ref}` : ""} · ${d.test}${d.formation ? ` · ${d.formation}` : ""}`), M, 88, { width: W - 150 });

  // Pavé note et résultat
  const vs = VERDICT_STYLE[d.verdict || "review"];
  doc.rect(M + W - 135, 22, 135, 74).fill(vs[0]);
  doc.font("Display").fontSize(26).fillColor(vs[1]).text(d.score20 === null ? "-" : num(d.score20), M + W - 135, 32, { width: 135, align: "center" });
  doc.font("Semi").fontSize(8).fillColor(vs[1]).text("/ 20", M + W - 135, 62, { width: 135, align: "center" });
  doc.font("Bold").fontSize(10).fillColor(vs[1]).text(clean(d.verdictLabel || "Non terminé").toUpperCase(), M + W - 135, 76, { width: 135, align: "center" });

  doc.y = 136;
  h2("Synthèse");
  const rows: [string, string][] = [
    ["Points", `${num(d.points)} / ${num(d.max)}`],
    ["Début", d.started], ["Fin", d.ended], ["Durée", d.duration],
    ["Fin de l'épreuve", d.endReason],
    ...(d.extraMinutes ? [["Tiers-temps", `+${d.extraMinutes} min`] as [string, string]] : []),
    ["Seuils", d.thresholds],
    ...(d.receipt ? [["Accusé de réception", d.receipt] as [string, string]] : []),
    ...(d.ip ? [["Adresse IP", d.ip] as [string, string]] : []),
  ];
  for (const [k, v] of rows) {
    ensure(16);
    const y = doc.y;
    doc.font("Semi").fontSize(9).fillColor(C.muted).text(clean(k), M, y, { width: 120 });
    doc.font("Body").fontSize(9).fillColor(C.navy).text(clean(v || "-"), M + 125, y, { width: W - 125 });
    doc.moveDown(0.25);
  }
  if (d.override) {
    ensure(40);
    doc.moveDown(0.3).rect(M, doc.y, W, 34).fill(C.orangeT);
    doc.font("Semi").fontSize(9).fillColor(C.navy).text(clean(`Décision forcée par l'équipe : ${d.override.label}${d.override.by ? ` (${d.override.by})` : ""}${d.override.auto ? `, calcul automatique : ${d.override.auto}` : ""}.`), M + 8, doc.y + 6, { width: W - 16 });
    doc.font("Body").fontSize(9).text(clean(`Motif : ${d.override.reason}`), M + 8, doc.y + 1, { width: W - 16 });
    doc.moveDown(0.8);
  }
  if (d.needsManual) doc.font("Semi").fontSize(9).fillColor(C.fail).text("Une réponse rédigée reste à corriger : le résultat est « À statuer » en attendant.", M, doc.y, { width: W });
  if (d.belowFloors.length) doc.font("Semi").fontSize(9).fillColor(C.fail).text(clean(`Plancher non atteint en : ${d.belowFloors.join(", ")}.`), M, doc.y, { width: W });

  // Domaines
  if (d.domains.length) {
    h2("Détail par domaine");
    for (const dm of d.domains) {
      ensure(18);
      const y = doc.y;
      doc.font("Body").fontSize(9).fillColor(C.navy).text(clean(dm.name), M, y, { width: 190 });
      doc.text(`${num(dm.score)} / ${num(dm.max)}`, M + 195, y, { width: 60 });
      doc.rect(M + 260, y + 2, 110, 7).fill(C.line);
      doc.rect(M + 260, y + 2, Math.max(0, Math.min(1, dm.ratio)) * 110, 7).fill(dm.below ? C.fail : C.pass);
      doc.font("Semi").fontSize(9).fillColor(dm.below ? C.fail : C.navy)
        .text(`${Math.round(dm.ratio * 100)} %${dm.floor !== null ? ` (plancher ${Math.round(dm.floor * 100)} %)` : ""}`, M + 378, y, { width: W - 378 });
      doc.y = Math.max(doc.y, y + 12);
      doc.moveDown(0.35);
    }
  }

  // Surveillance
  h2("Surveillance");
  doc.font("Body").fontSize(9).fillColor(C.navy)
    .text(clean(`Infractions comptées : ${d.violations}.${d.suspicion ? ` Suspicion signalée par l'équipe : ${d.suspicion}.` : ""} Les alertes ne décident de rien : elles sont examinées par un surveillant.`), M, doc.y, { width: W });
  doc.moveDown(0.4);
  if (!d.surveillance.length) doc.font("Body").fontSize(9).fillColor(C.muted).text("Aucune alerte.", M);
  for (const s of d.surveillance) {
    ensure(14);
    const y = doc.y;
    doc.font("Body").fontSize(9).fillColor(s.serious ? C.fail : C.navy).text(clean(s.label), M, y, { width: 300 });
    doc.font("Semi").text(String(s.count), M + 305, y, { width: 40 });
    doc.y = Math.max(doc.y, y + 13);
  }

  // Copie corrigée
  doc.addPage();
  h2(`Copie corrigée (${d.questions.length} questions)`);
  for (const q of d.questions) {
    ensure(70);
    const st = STATUS_STYLE[q.status];
    const y = doc.y;
    doc.rect(M, y, 26, 18).fill(C.navy);
    doc.font("Bold").fontSize(9).fillColor(C.white).text(String(q.n), M, y + 5, { width: 26, align: "center" });
    doc.rect(M + 30, y, 78, 18).fill(st[0]);
    doc.font("Bold").fontSize(7.5).fillColor(st[1]).text(st[2], M + 30, y + 6, { width: 78, align: "center" });
    doc.font("Semi").fontSize(9).fillColor(C.navy).text(`${q.points === null ? "?" : num(q.points)} / ${num(q.max)} pt`, M + 114, y + 5, { width: 70 });
    doc.font("Body").fontSize(8).fillColor(C.muted).text(clean(q.meta), M + 190, y + 5, { width: W - 190 });
    doc.y = y + 24;
    doc.font("Semi").fontSize(9.5).fillColor(C.navy).text(clean(q.prompt), M, doc.y, { width: W });
    doc.moveDown(0.3);
    for (const o of q.options || []) {
      ensure(14);
      const mark = o.chosen && o.correct ? "[x] " : o.chosen ? "[x] " : "[ ] ";
      const color = o.correct ? C.pass : o.chosen ? C.fail : C.navy;
      doc.font(o.correct ? "Semi" : "Body").fontSize(9).fillColor(color)
        .text(clean(`${mark}${o.text}${o.correct ? "  (bonne réponse)" : ""}${o.chosen && !o.correct ? "  (choisie, fausse)" : ""}`), M + 10, doc.y, { width: W - 10 });
    }
    if (q.answer !== undefined) {
      doc.font("Body").fontSize(9).fillColor(C.navy).text(clean(`Réponse : ${q.answer || "(aucune)"}`), M + 10, doc.y, { width: W - 10 });
    }
    if (q.expected) doc.font("Body").fontSize(9).fillColor(C.pass).text(clean(`Attendu : ${q.expected}`), M + 10, doc.y, { width: W - 10 });
    for (const x of q.extra || []) doc.font("Body").fontSize(8.5).fillColor(C.muted).text(clean(x), M + 10, doc.y, { width: W - 10 });
    if (q.explanation) doc.font("Body").fontSize(8.5).fillColor(C.indigo).text(clean(`Explication : ${q.explanation}`), M + 10, doc.y, { width: W - 10 });
    doc.moveDown(0.3);
    doc.moveTo(M, doc.y).lineTo(M + W, doc.y).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.moveDown(0.5);
  }

  // Journal
  doc.addPage();
  h2("Annexe : journal horodaté de l'épreuve");
  for (const e of d.timeline) {
    const label = clean(e.label), det = clean(e.detail);
    doc.font("Body").fontSize(8);
    const h = Math.max(11, doc.heightOfString(label, { width: 190 }), det ? doc.heightOfString(det, { width: W - 256 }) : 0);
    ensure(h + 2);
    const y = doc.y;
    doc.font("Body").fontSize(8).fillColor(C.muted).text(e.time, M, y, { width: 60 });
    doc.font(e.serious ? "Semi" : "Body").fontSize(8).fillColor(e.serious ? C.fail : C.navy).text(label, M + 62, y, { width: 190 });
    if (det) doc.font("Body").fontSize(7.5).fillColor(C.muted).text(det, M + 256, y, { width: W - 256 });
    doc.y = y + h + 2;
  }

  // Pied de page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0; // écrire dans la marge sans créer de page
    doc.font("Body").fontSize(7.5).fillColor(C.grey)
      .text(clean(`Cybersup · ${d.candidate} · copie ${d.attemptId.slice(0, 8)}`), M, doc.page.height - 38, { width: W / 2, lineBreak: false });
    doc.text(`Page ${i + 1} / ${range.count}`, M + W / 2, doc.page.height - 38, { width: W / 2, align: "right", lineBreak: false });
  }
}

export function recapFilename(candidate: string, test: string): string {
  return `fiche-${test}-${candidate}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9-]+/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 120) + ".pdf";
}
