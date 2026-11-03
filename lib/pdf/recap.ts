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
      size: "A4", bufferPages: true, margins: { top: 46, bottom: 50, left: 40, right: 40 },
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
  const PW = doc.page.width, PH = doc.page.height;
  const M = 40, W = PW - 2 * M, TOP = 46, BOTTOM = PH - 58;
  const ensure = (h: number) => { if (doc.y + h > BOTTOM) { doc.addPage(); doc.y = TOP; } };
  const hOf = (t: string, font: string, size: number, width: number) => doc.font(font).fontSize(size).heightOfString(t, { width });
  const put = (t: string, x: number, y: number, o: { font?: string; size?: number; color?: string; width?: number; align?: "left" | "center" | "right"; spacing?: number } = {}) => {
    doc.font(o.font || "Body").fontSize(o.size || 9).fillColor(o.color || C.navy)
      .text(clean(t), x, y, { width: o.width, align: o.align, characterSpacing: o.spacing, lineGap: 1.5 });
  };
  const h2 = (t: string, sub?: string) => {
    ensure(46);
    const y = Math.round(doc.y + 10);
    put(t.toUpperCase(), M, y, { font: "Display", size: 11, spacing: 0.6 });
    doc.rect(M, y + 17, 28, 2.5).fill(C.orange);
    if (sub) put(sub, M + 200, y + 2, { size: 8, color: C.muted, width: W - 200, align: "right" });
    doc.y = y + 30;
  };
  const vs = VERDICT_STYLE[d.verdict || "review"];

  // ---------- Page 1 : en-tête ----------
  doc.rect(0, 0, PW, 132).fill(C.navy);
  doc.rect(0, 132, PW, 4).fill(C.orange);
  put("CYBERSUP", M, 28, { font: "Display", size: 13, color: C.white, spacing: 1 });
  put("FICHE DE CORRECTION · TEST D'ADMISSION", M, 46, { font: "Semi", size: 7.5, color: C.orangeL, spacing: 1.4 });
  const boxW = 150, infoW = W - boxW - 24;
  put(d.candidate, M, 66, { font: "Bold", size: 20, color: C.white, width: infoW });
  const sub = [d.email, d.ref ? `réf. ${d.ref}` : ""].filter(Boolean).join("  ·  ");
  put(sub, M, 94, { size: 8.5, color: C.cream, width: infoW });
  put([d.test, d.formation && !d.test.includes(d.formation) ? d.formation : ""].filter(Boolean).join("  ·  "), M, 108, { font: "Semi", size: 8.5, color: C.white, width: infoW });

  // Pavé note
  const bx = M + W - boxW, by = 24;
  doc.roundedRect(bx, by, boxW, 92, 6).fill(vs[0]);
  put(d.score20 === null ? "-" : num(d.score20), bx, by + 12, { font: "Display", size: 30, color: vs[1], width: boxW - 30, align: "right" });
  put("/20", bx + boxW - 28, by + 30, { font: "Semi", size: 9, color: vs[1] });
  doc.rect(bx + 14, by + 56, boxW - 28, 0.8).fill(vs[1]);
  put((d.verdictLabel || "Non terminé").toUpperCase(), bx, by + 66, { font: "Bold", size: 9.5, color: vs[1], width: boxW, align: "center", spacing: 1 });

  // ---------- Indicateurs ----------
  const kpis: [string, string, string?][] = [
    ["Points", `${num(d.points)} / ${num(d.max)}`],
    ["Durée", d.duration, d.extraMinutes ? `dont tiers-temps +${d.extraMinutes} min` : undefined],
    ["Infractions", String(d.violations), d.suspicion ? "suspicion signalée" : undefined],
    ["Questions", String(d.questions.length), `${d.questions.filter((q) => q.status === "full").length} justes`],
  ];
  const kW = (W - 3 * 10) / 4, ky = 152;
  kpis.forEach(([k, v, n], i) => {
    const x = M + i * (kW + 10);
    doc.roundedRect(x, ky, kW, 54, 5).fill(C.soft);
    doc.rect(x, ky + 10, 2.5, 34).fill(i === 2 && d.violations ? C.fail : C.orange);
    put(k.toUpperCase(), x + 12, ky + 9, { font: "Semi", size: 7, color: C.muted, spacing: 1 });
    put(v, x + 12, ky + 21, { font: "Bold", size: 13, color: i === 2 && d.violations ? C.fail : C.navy, width: kW - 18 });
    if (n) put(n, x + 12, ky + 39, { size: 7, color: C.muted, width: kW - 18 });
  });
  doc.y = ky + 62;

  // Alertes de résultat
  const notes: [string, string][] = [];
  if (d.override) notes.push([C.orangeT, `Décision forcée par l'équipe : ${d.override.label}${d.override.by ? ` (${d.override.by})` : ""}${d.override.auto ? `. Calcul automatique : ${d.override.auto}` : ""}. Motif : ${d.override.reason}`]);
  if (d.needsManual) notes.push([C.orangeT, "Une réponse rédigée reste à corriger : le résultat est « À statuer » en attendant."]);
  if (d.belowFloors.length) notes.push([C.failT, `Plancher non atteint en : ${d.belowFloors.join(", ")}.`]);
  for (const [bg, t] of notes) {
    const h = hOf(clean(t), "Semi", 8.5, W - 24) + 12;
    ensure(h + 6);
    const y = doc.y + 4;
    doc.roundedRect(M, y, W, h, 4).fill(bg);
    doc.rect(M, y, 3, h).fill(bg === C.failT ? C.fail : C.orange);
    put(t, M + 14, y + 6, { font: "Semi", size: 8.5, color: bg === C.failT ? C.fail : C.navy, width: W - 24 });
    doc.y = y + h;
  }

  // ---------- Déroulé (deux colonnes) ----------
  h2("Déroulé de l'épreuve");
  const facts: [string, string][] = [
    ["Début", d.started], ["Fin", d.ended], ["Fin de l'épreuve", d.endReason],
    ["Accusé de réception", d.receipt || "-"], ["Adresse IP", d.ip || "-"], ["Référence copie", d.attemptId.slice(0, 8)],
  ];
  const colW = (W - 20) / 2;
  for (let i = 0; i < facts.length; i += 2) {
    const y = doc.y;
    [facts[i], facts[i + 1]].forEach((f, j) => {
      if (!f) return;
      const x = M + j * (colW + 20);
      put(f[0], x, y, { size: 8, color: C.muted, width: 100 });
      put(f[1], x + 104, y, { font: "Semi", size: 8.5, width: colW - 104 });
    });
    doc.rect(M, y + 15, W, 0.5).fill(C.line);
    doc.y = y + 21;
  }
  put(`Règle de décision : ${d.thresholds}.`, M, doc.y + 2, { size: 7.5, color: C.muted, width: W });
  doc.y += 6;

  // ---------- Domaines ----------
  if (d.domains.length) {
    h2("Résultats par domaine", "barre : taux de réussite · trait orange : plancher");
    const nameW = 170, scoreW = 58, pctW = 44, barX = M + nameW + scoreW + 8, barW = W - nameW - scoreW - pctW - 16;
    for (const dm of d.domains) {
      const nh = hOf(clean(dm.name), "Semi", 8.5, nameW - 6);
      const h = Math.max(20, nh + 9);
      ensure(h);
      const y = doc.y;
      put(dm.name, M, y + 4, { font: "Semi", size: 8.5, color: dm.below ? C.fail : C.navy, width: nameW - 6 });
      put(`${num(dm.score)} / ${num(dm.max)}`, M + nameW, y + 4, { size: 8.5, color: C.muted, width: scoreW });
      const r = Math.max(0, Math.min(1, dm.ratio));
      doc.roundedRect(barX, y + 6, barW, 8, 4).fill(C.line);
      if (r > 0) doc.roundedRect(barX, y + 6, Math.max(8, r * barW), 8, 4).fill(dm.below ? C.fail : C.pass);
      if (dm.floor !== null) doc.rect(barX + dm.floor * barW - 1, y + 2, 2, 16).fill(C.orange);
      put(`${Math.round(r * 100)} %`, M + W - pctW, y + 4, { font: "Bold", size: 9, color: dm.below ? C.fail : C.navy, width: pctW, align: "right" });
      doc.y = y + h;
    }
  }

  // ---------- Surveillance ----------
  h2("Surveillance", "les alertes ne décident de rien : un surveillant les examine");
  if (d.suspicion) put(`Suspicion signalée par l'équipe : ${d.suspicion}`, M, doc.y, { font: "Semi", size: 8.5, color: C.fail, width: W });
  if (d.suspicion) doc.y += 4;
  if (!d.surveillance.length) put("Aucune alerte pendant l'épreuve.", M, doc.y, { size: 8.5, color: C.muted });
  else {
    let x = M, y = doc.y;
    for (const s of d.surveillance) {
      const t = `${clean(s.label)}  ${s.count}`;
      const tw = doc.font("Semi").fontSize(8).widthOfString(t) + 20;
      if (x + tw > M + W) { x = M; y += 24; }
      doc.roundedRect(x, y, tw, 18, 9).fill(s.serious ? C.failT : C.soft);
      put(clean(s.label), x + 10, y + 5, { font: "Body", size: 8, color: s.serious ? C.fail : C.navy });
      put(String(s.count), x + tw - 10 - doc.font("Bold").fontSize(8).widthOfString(String(s.count)), y + 5, { font: "Bold", size: 8, color: s.serious ? C.fail : C.navy });
      x += tw + 8;
    }
    doc.y = y + 26;
  }

  // ---------- Copie corrigée ----------
  doc.addPage(); doc.y = TOP;
  const nFull = d.questions.filter((q) => q.status === "full").length;
  h2("Copie corrigée", `${d.questions.length} questions · ${nFull} justes · ${num(d.points)} / ${num(d.max)} points`);
  const CW = W - 16;
  for (const q of d.questions) {
    const st = STATUS_STYLE[q.status];
    // Hauteur de la carte, calculée avant de la dessiner
    const lines: { t: string; font: string; size: number; color: string; box?: "ok" | "bad" | "empty" | "okEmpty" }[] = [];
    for (const o of q.options || []) {
      const tag = o.correct && o.chosen ? "   ·  bonne réponse, choisie" : o.correct ? "   ·  bonne réponse" : o.chosen ? "   ·  choisie, fausse" : "";
      lines.push({ t: o.text + tag, font: o.correct || o.chosen ? "Semi" : "Body", size: 8.5,
        color: o.correct ? C.pass : o.chosen ? C.fail : C.navy, box: o.chosen ? (o.correct ? "ok" : "bad") : o.correct ? "okEmpty" : "empty" });
    }
    if (q.answer !== undefined) lines.push({ t: `Réponse : ${q.answer || "(aucune)"}`, font: "Body", size: 8.5, color: C.navy });
    if (q.expected) lines.push({ t: `Attendu : ${q.expected}`, font: "Semi", size: 8.5, color: C.pass });
    for (const x of q.extra || []) lines.push({ t: x, font: "Body", size: 8, color: C.muted });
    const lh = lines.map((l) => hOf(clean(l.t), l.font, l.size, CW - 30) + 3);
    const ph = hOf(clean(q.prompt), "Semi", 9.5, CW - 8);
    const eh = q.explanation ? hOf(clean(`Explication : ${q.explanation}`), "Body", 8, CW - 28) + 12 : 0;
    const total = 30 + ph + 6 + lh.reduce((a, b) => a + b, 0) + (eh ? eh + 6 : 0) + 10;
    ensure(Math.min(total, BOTTOM - TOP - 40) + 8);
    const y0 = doc.y;
    // Corps de carte (ligne d'état à gauche)
    doc.rect(M, y0, 3, total).fill(st[0]);
    doc.rect(M + 3, y0, W - 3, total).fill(C.white);
    doc.rect(M + 3, y0, W - 3, 24).fill(C.soft);
    put(`Q${q.n}`, M + 12, y0 + 7, { font: "Display", size: 9.5 });
    const pillW = doc.font("Bold").fontSize(7).widthOfString(st[2]) + 16;
    doc.roundedRect(M + 42, y0 + 6, pillW, 13, 6.5).fill(st[0]);
    put(st[2], M + 42, y0 + 9.5, { font: "Bold", size: 7, color: st[1], width: pillW, align: "center" });
    put(q.meta, M + 50 + pillW, y0 + 8, { size: 7.5, color: C.muted, width: W - 150 - pillW });
    put(`${q.points === null ? "?" : num(q.points)} / ${num(q.max)} pt`, M + W - 90, y0 + 7, { font: "Bold", size: 9, width: 82, align: "right" });
    let y = y0 + 30;
    put(q.prompt, M + 12, y, { font: "Semi", size: 9.5, width: CW - 8 });
    y += ph + 6;
    lines.forEach((l, i) => {
      if (l.box) {
        const bc = l.box === "bad" ? C.fail : l.box === "empty" ? C.grey : C.pass;
        doc.roundedRect(M + 14, y + 1.5, 8, 8, 1.5).lineWidth(0.8).strokeColor(bc).stroke();
        if (l.box === "ok" || l.box === "bad") doc.roundedRect(M + 16, y + 3.5, 4, 4, 0.8).fill(bc);
      }
      put(l.t, M + (l.box ? 28 : 14), y, { font: l.font, size: l.size, color: l.color, width: CW - 30 });
      y += lh[i];
    });
    if (eh) {
      y += 4;
      doc.roundedRect(M + 12, y, W - 24, eh, 3).fill(C.cream);
      put(`Explication : ${q.explanation}`, M + 20, y + 6, { size: 8, color: C.indigo, width: CW - 28 });
      y += eh;
    }
    doc.rect(M, y0 + total, W, 0.6).fill(C.line);
    doc.y = Math.max(y + 10, y0 + total) + 8;
  }

  // ---------- Journal ----------
  doc.addPage(); doc.y = TOP;
  h2("Annexe : journal horodaté", `${d.timeline.length} événements · en rouge : infractions`);
  const cols = [M + 8, M + 70, M + 260], detW = W - 268;
  const header = () => {
    const y = doc.y;
    doc.rect(M, y, W, 18).fill(C.navy);
    ["HEURE", "ÉVÉNEMENT", "DÉTAIL"].forEach((t, i) => put(t, cols[i], y + 5.5, { font: "Semi", size: 7, color: C.white, spacing: 1 }));
    doc.y = y + 18;
  };
  header();
  d.timeline.forEach((e, i) => {
    const label = clean(e.label), det = clean(e.detail);
    const h = Math.max(15, hOf(label, e.serious ? "Semi" : "Body", 8, 180) + 6, det ? hOf(det, "Body", 7.5, detW) + 6 : 0);
    if (doc.y + h > BOTTOM) { doc.addPage(); doc.y = TOP; header(); }
    const y = doc.y;
    if (e.serious) doc.rect(M, y, W, h).fill(C.failT);
    else if (i % 2) doc.rect(M, y, W, h).fill(C.soft);
    put(e.time, cols[0], y + 3.5, { size: 8, color: C.muted, width: 58 });
    put(label, cols[1], y + 3.5, { font: e.serious ? "Semi" : "Body", size: 8, color: e.serious ? C.fail : C.navy, width: 180 });
    if (det) put(det, cols[2], y + 4, { size: 7.5, color: C.muted, width: detW });
    doc.y = y + h;
  });

  // ---------- Pied de page ----------
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0; // écrire dans la marge sans créer de page
    doc.rect(M, PH - 44, W, 0.6).fill(C.line);
    doc.font("Semi").fontSize(7).fillColor(C.navy).text("CYBERSUP", M, PH - 36, { lineBreak: false, characterSpacing: 1 });
    doc.font("Body").fontSize(7).fillColor(C.grey)
      .text(clean(`   Fiche de correction · ${d.candidate} · copie ${d.attemptId.slice(0, 8)} · document confidentiel`), M + 44, PH - 36, { width: W / 1.4, lineBreak: false });
    doc.text(`${i + 1} / ${range.count}`, M + W - 60, PH - 36, { width: 60, align: "right", lineBreak: false });
    if (i > 0) { // rappel en haut des pages suivantes
      doc.font("Semi").fontSize(7).fillColor(C.muted).text(clean(`${d.candidate} · ${d.test}`), M, 22, { width: W - 120, lineBreak: false });
      doc.font("Bold").fontSize(7).fillColor(vs[0] === C.orangeL ? C.navy : vs[0])
        .text(clean(`${d.score20 === null ? "-" : num(d.score20)} / 20 · ${d.verdictLabel}`), M + W - 160, 22, { width: 160, align: "right", lineBreak: false });
    }
  }
}

export function recapFilename(candidate: string, test: string): string {
  return `fiche-${test}-${candidate}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9-]+/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 120) + ".pdf";
}
