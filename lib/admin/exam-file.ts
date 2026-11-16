/**
 * Fichier d'épreuve Cybersup : export et import complets d'un examen
 * (réglages et toutes les questions, tous types, avec corrigés, scénarios de
 * terminal et d'exercices externes). Deux formats :
 *   - JSON (.cybersup-exam.json) : fidèle, pour sauvegarder, dupliquer ou
 *     passer une épreuve d'une plateforme à une autre ;
 *   - CSV : une ligne par question, lisible dans Excel ; les colonnes
 *     complexes (options, corrigé, terminal, externe) restent en JSON.
 * Les secrets (code d'accès, clés SEB) ne sont jamais exportés.
 */
import { parseCsv, toCsv } from "@/lib/excel/csv";

export const EXAM_FORMAT = "cybersup-exam";
export const EXAM_VERSION = 1;

/** Réglages repris d'une épreuve à l'autre (ni identifiants, ni dates, ni publication). */
export const TEST_FIELDS = [
  "title", "description", "duration_minutes", "require_seb", "invite_only", "require_id_check", "require_webcam",
  "id_verify_before_start", "seb_accept_config_key", "linear_navigation", "draw_count", "activity_minutes",
  "shuffle_questions", "shuffle_options", "max_violations", "room_scan_after", "timing", "question_time_s",
  "partial_points", "fast_answer_s", "allow_resume", "grace_seconds", "retention_days", "pass_mark",
  "domain_floors", "interview_guide", "formation", "verdict_pass", "verdict_fail",
] as const;

export type ExternalDraft = { tool: string; label: string; time_limit_min: string; scenario: string; answer_key: string };
/** Question telle que l'éditeur la manipule (scénarios en texte JSON). */
export type DraftQuestion = {
  type: string; prompt: string; options: any; correct: any; points: number;
  image_url?: string | null; domain?: string | null; variant_group?: string | null;
  explanation?: string | null; time_limit_s?: number | null;
  terminal?: { scenario: string; flag: string } | null;
  external?: ExternalDraft | null;
};

/** Question telle qu'elle est écrite dans le fichier (scénarios en objets). */
export type FileQuestion = {
  type: string; prompt: string; options?: any; correct?: any; points?: number;
  image_url?: string | null; domain?: string | null; variant_group?: string | null;
  explanation?: string | null; time_limit_s?: number | null;
  terminal?: { scenario: any; flag?: string | null } | null;
  external?: { tool: string; label?: string | null; time_limit_s?: number | null; scenario?: any; answer_key?: any } | null;
};

export type ExamFile = { format: string; version: number; exported_at: string; test: Record<string, any>; questions: FileQuestion[] };

const TYPES = new Set([
  "mcq_single", "mcq_multi", "long_text", "terminal", "ordering", "matching", "hotspot", "short_answer", "external",
  "sql", "decode", "password", "blocks", "headers", "subnet", "netpuzzle", "sokoban", "robot", "adsim", "tickets",
  "feed", "evtx", "bash", "sim",
]);

const jsonOr = (s: string | undefined | null, fallback: any) => {
  if (!s || !String(s).trim()) return fallback;
  return JSON.parse(s);
};

export function toFileQuestion(q: DraftQuestion): FileQuestion {
  const out: FileQuestion = {
    type: q.type, prompt: q.prompt, options: q.options ?? null, correct: q.correct ?? null, points: Number(q.points) || 0,
    domain: q.domain || null, variant_group: q.variant_group || null, explanation: q.explanation || null,
    time_limit_s: q.time_limit_s || null, image_url: q.image_url || null,
  };
  if (q.type === "terminal" && q.terminal) out.terminal = { scenario: jsonOr(q.terminal.scenario, {}), flag: q.terminal.flag?.trim() || null };
  if (q.type === "external" && q.external) {
    const m = parseInt(q.external.time_limit_min, 10);
    out.external = {
      tool: q.external.tool, label: q.external.label?.trim() || null,
      time_limit_s: Number.isFinite(m) && m > 0 ? m * 60 : null,
      scenario: jsonOr(q.external.scenario, {}), answer_key: jsonOr(q.external.answer_key, null),
    };
  }
  return out;
}

export function toDraftQuestion(f: FileQuestion): DraftQuestion {
  return {
    type: f.type, prompt: f.prompt, options: f.options ?? null, correct: f.correct ?? null, points: Number(f.points ?? 1),
    image_url: f.image_url ?? null, domain: f.domain ?? null, variant_group: f.variant_group ?? null,
    explanation: f.explanation ?? null, time_limit_s: f.time_limit_s ?? null,
    terminal: f.type === "terminal" ? { scenario: JSON.stringify(f.terminal?.scenario ?? { files: {} }, null, 2), flag: f.terminal?.flag || "" } : null,
    external: f.type === "external" && f.external ? {
      tool: f.external.tool, label: f.external.label || "",
      time_limit_min: f.external.time_limit_s ? String(Math.round(f.external.time_limit_s / 60)) : "",
      scenario: JSON.stringify(f.external.scenario ?? {}, null, 2),
      answer_key: f.external.answer_key != null ? JSON.stringify(f.external.answer_key, null, 2) : "",
    } : null,
  };
}

export function pickTest(test: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of TEST_FIELDS) if (test[k] !== undefined) out[k] = test[k];
  return out;
}

export function buildExamFile(test: Record<string, any>, questions: DraftQuestion[]): ExamFile {
  return { format: EXAM_FORMAT, version: EXAM_VERSION, exported_at: new Date().toISOString(), test: pickTest(test), questions: questions.map(toFileQuestion) };
}

function checkQuestions(qs: any[]): FileQuestion[] {
  if (!Array.isArray(qs)) throw new Error("la liste « questions » est absente");
  if (qs.length > 2000) throw new Error("plus de 2000 questions");
  return qs.map((q, i) => {
    const n = i + 1;
    if (!q || typeof q !== "object") throw new Error(`question ${n} illisible`);
    if (!TYPES.has(q.type)) throw new Error(`question ${n} : type inconnu « ${q.type} »`);
    if (typeof q.prompt !== "string" || !q.prompt.trim()) throw new Error(`question ${n} : énoncé vide`);
    if (q.points != null && !(Number(q.points) >= 0)) throw new Error(`question ${n} : points invalides`);
    if (q.type === "terminal" && !q.terminal?.scenario?.files) throw new Error(`question ${n} : scénario de terminal sans « files »`);
    if (q.type === "external" && !q.external?.tool) throw new Error(`question ${n} : exercice externe sans outil`);
    return q as FileQuestion;
  });
}

export function parseExamJson(text: string): ExamFile {
  let data: any;
  try { data = JSON.parse(text.replace(/^﻿/, "")); } catch { throw new Error("fichier JSON illisible"); }
  // Accepte aussi une simple liste de questions
  if (Array.isArray(data)) data = { format: EXAM_FORMAT, version: EXAM_VERSION, test: {}, questions: data };
  if (data.format && data.format !== EXAM_FORMAT) throw new Error("ce n'est pas un fichier d'épreuve Cybersup");
  if ((data.version || 1) > EXAM_VERSION) throw new Error("fichier créé par une version plus récente de la plateforme");
  return { format: EXAM_FORMAT, version: EXAM_VERSION, exported_at: data.exported_at || "", test: pickTest(data.test || {}), questions: checkQuestions(data.questions) };
}

export const CSV_COLUMNS = ["type", "enonce", "points", "domaine", "groupe_variante", "explication", "temps_s", "options_json", "corrige_json", "terminal_json", "externe_json"];

export function examToCsv(questions: DraftQuestion[]): string {
  const j = (v: any) => (v == null ? "" : JSON.stringify(v));
  const rows = questions.map(toFileQuestion).map((q) => [
    q.type, q.prompt, q.points ?? 1, q.domain || "", q.variant_group || "", q.explanation || "", q.time_limit_s || "",
    j(q.options), j(q.correct), j(q.terminal), j(q.external),
  ]);
  return toCsv([CSV_COLUMNS, ...rows]);
}

export function parseExamCsv(text: string): FileQuestion[] {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim()));
  if (!rows.length) throw new Error("fichier vide");
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  if (col("type") < 0 || col("enonce") < 0) throw new Error(`colonnes attendues : ${CSV_COLUMNS.join(", ")}`);
  const get = (r: string[], name: string) => { const i = col(name); const v = i >= 0 ? (r[i] ?? "") : ""; return v.replace(/^'(?=[=+\-@])/, ""); };
  const js = (r: string[], name: string, n: number) => {
    const v = get(r, name).trim(); if (!v) return null;
    try { return JSON.parse(v); } catch { throw new Error(`ligne ${n} : colonne ${name} n'est pas du JSON valide`); }
  };
  const qs = rows.slice(1).map((r, i) => {
    const n = i + 2;
    const t = get(r, "temps_s").trim();
    return {
      type: get(r, "type").trim(), prompt: get(r, "enonce"), points: get(r, "points").trim() ? Number(get(r, "points").replace(",", ".")) : 1,
      domain: get(r, "domaine").trim() || null, variant_group: get(r, "groupe_variante").trim() || null,
      explanation: get(r, "explication").trim() || null, time_limit_s: t ? parseInt(t, 10) : null,
      options: js(r, "options_json", n), correct: js(r, "corrige_json", n),
      terminal: js(r, "terminal_json", n), external: js(r, "externe_json", n),
    };
  });
  return checkQuestions(qs);
}
