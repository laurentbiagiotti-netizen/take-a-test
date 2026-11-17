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
  "shuffle_questions", "shuffle_options", "max_violations", "timing", "question_time_s",
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
  level?: string | null;
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

/** En-tête comparable : minuscules, sans accents, ponctuation ni espaces. */
const hkey = (s: string) => String(s ?? "").replace(/^﻿/, "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Noms de colonnes acceptés pour chaque champ (format Cybersup, modèle Excel de Dylan, anglais). */
const ALIASES: Record<string, string[]> = {
  type: ["type", "typequestion", "typedequestion", "questiontype", "kind"],
  prompt: ["enonce", "question", "intitule", "libelle", "prompt", "texte", "consigne"],
  points: ["points", "point", "pts", "bareme", "score", "note"],
  domain: ["domaine", "theme", "matiere", "competence", "categorie", "domain", "topic"],
  variant_group: ["groupevariante", "variante", "groupe", "variantgroup"],
  explanation: ["explication", "explications", "correction", "commentaire", "explanation", "feedback"],
  time_limit_s: ["temps", "temps_s", "temps s", "tempssecondes", "dureesecondes", "duree", "timelimit", "timelimits", "chrono"].map(hkey),
  options: ["optionsjson", "options", "choix", "propositions"],
  correct: ["corrigejson", "corrige", "correct", "corrigé", "bonnereponse", "bonnesreponses", "bonnesreponse", "reponsecorrecte", "reponsesattendues", "reponseattendue", "solution", "answer", "answers"].map(hkey),
  terminal: ["terminaljson", "terminal", "scenarioterminal"],
  external: ["externejson", "externe", "external", "exerciceexterne"],
  image_url: ["image", "imageurl", "illustration"],
  level: ["niveau", "level", "promo", "annee", "classe", "formation"],
};
const LETTERS6 = ["a", "b", "c", "d", "e", "f"];
const ANSWER_COLS = LETTERS6.map((l) => [`reponse${l}`, `choix${l}`, `option${l}`, `proposition${l}`, l]);

/** Types tels que les gens les écrivent → types de la plateforme. */
const TYPE_ALIASES: Record<string, string> = {
  qcm: "mcq_single", qcmunique: "mcq_single", qcu: "mcq_single", choixunique: "mcq_single", unique: "mcq_single", single: "mcq_single", mcq: "mcq_single", mcqsingle: "mcq_single",
  qcmmultiple: "mcq_multi", qcmmultiples: "mcq_multi", qcmm: "mcq_multi", choixmultiple: "mcq_multi", multiple: "mcq_multi", multi: "mcq_multi", mcqmulti: "mcq_multi",
  vraifaux: "truefalse", vraioufaux: "truefalse", vf: "truefalse", truefalse: "truefalse",
  reponsecourte: "short_answer", courte: "short_answer", short: "short_answer", shortanswer: "short_answer",
  ouverte: "long_text", questionouverte: "long_text", libre: "long_text", redaction: "long_text", texte: "long_text", longtext: "long_text", open: "long_text",
  ordre: "ordering", remettreenordre: "ordering", association: "matching", relier: "matching", zone: "hotspot", zoneimage: "hotspot",
};
const typeOf = (raw: string) => { const k = hkey(raw); if (TYPES.has(raw.trim())) return raw.trim(); return TYPE_ALIASES[k] || (TYPES.has(k) ? k : ""); };

export type CsvImport = { questions: FileQuestion[]; skipped: { line: number; error: string }[]; ignoredColumns: string[] };

/**
 * Lit un CSV de questions, tolérant : en-têtes avec ou sans accents ni majuscules,
 * synonymes (Question, Thème, Bonne(s) réponse(s)…), modèle Excel de la banque
 * (colonnes Réponse A à F), types écrits librement (QCM_unique, Vrai_Faux…).
 * Une ligne fautive est écartée avec son motif, sans bloquer les autres.
 */
export function readExamCsv(text: string): CsvImport {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim()));
  if (!rows.length) throw new Error("fichier vide");
  const head = rows[0].map(hkey);
  const used = new Set<number>();
  const col = (names: string[]) => { for (const n of names) { const i = head.indexOf(hkey(n)); if (i >= 0) { used.add(i); return i; } } return -1; };
  const idx: Record<string, number> = {};
  for (const [k, names] of Object.entries(ALIASES)) idx[k] = col(names);
  const ans = ANSWER_COLS.map(col);
  if (idx.prompt < 0) throw new Error(`colonne de l'énoncé introuvable (attendu « enonce » ou « Question »). Colonnes lues : ${rows[0].join(", ")}`);
  const ignoredColumns = rows[0].filter((h, i) => !used.has(i) && h.trim()).map((h) => h.trim());

  const get = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? "").replace(/^'(?=[=+\-@])/, "").trim() : "");
  const json = (v: string, what: string) => { if (!v) return null; try { return JSON.parse(v); } catch { throw new Error(`${what} n'est pas du JSON valide`); } };
  const questions: FileQuestion[] = [];
  const skipped: { line: number; error: string }[] = [];

  rows.slice(1).forEach((r, k) => {
    const line = k + 2;
    try {
      const prompt = get(r, idx.prompt);
      if (!prompt) throw new Error("énoncé vide");
      const answers = ans.map((i) => get(r, i));
      const hasLetters = answers.some(Boolean);
      const rawType = get(r, idx.type);
      let type = rawType ? typeOf(rawType) : "";
      if (rawType && !type) throw new Error(`type inconnu « ${rawType} »`);
      const goodRaw = get(r, idx.correct);
      if (!type) type = hasLetters ? (goodRaw.split(/[;,\s]+/).filter(Boolean).length > 1 ? "mcq_multi" : "mcq_single") : "long_text";

      const pts = get(r, idx.points).replace(",", ".");
      const t = get(r, idx.time_limit_s);
      const q: FileQuestion = {
        type, prompt, points: pts ? Number(pts) : 1,
        domain: get(r, idx.domain) || null, variant_group: get(r, idx.variant_group) || null,
        explanation: get(r, idx.explanation) || null, time_limit_s: t ? parseInt(t, 10) || null : null,
        image_url: get(r, idx.image_url) || null,
        level: get(r, idx.level) || null,
        options: null, correct: null,
      };
      if (!(Number(q.points) >= 0)) throw new Error("points invalides");

      const optJson = get(r, idx.options);
      if (type === "truefalse") {
        const v = hkey(goodRaw);
        if (v !== "vrai" && v !== "faux" && v !== "true" && v !== "false") throw new Error("bonne réponse attendue : Vrai ou Faux");
        q.type = "mcq_single"; q.options = [{ id: "vrai", text: "Vrai" }, { id: "faux", text: "Faux" }];
        q.correct = [v === "faux" || v === "false" ? "faux" : "vrai"];
      } else if ((type === "mcq_single" || type === "mcq_multi") && !optJson.startsWith("[")) {
        const opts = LETTERS6.map((id, i) => ({ id, text: answers[i] })).filter((o) => o.text);
        const fromOptCol = !opts.length && optJson ? optJson.split(/\s*[|\n]\s*/).filter(Boolean).map((text, i) => ({ id: LETTERS6[i] || String(i), text })) : opts;
        if (fromOptCol.length < 2) throw new Error("au moins 2 réponses (colonnes Réponse A, B…)");
        q.options = fromOptCol;
        const good = goodRaw.startsWith("[") ? json(goodRaw, "le corrigé") : goodRaw.toLowerCase().split(/[;,\s]+/).filter(Boolean);
        const ids = (good as any[]).map((g) => (typeof g === "number" ? fromOptCol[g]?.id : String(g).toLowerCase()));
        if (!ids.length || ids.some((g) => !fromOptCol.some((o) => o.id === g))) throw new Error(`bonne réponse « ${goodRaw || "vide"} » sans proposition correspondante`);
        if (type === "mcq_single" && ids.length > 1) throw new Error("QCM à réponse unique avec plusieurs bonnes réponses");
        q.correct = ids;
      } else if (type === "short_answer" && goodRaw && !goodRaw.startsWith("[") && !goodRaw.startsWith("{")) {
        q.options = optJson ? json(optJson, "options") : {};
        q.correct = { answers: goodRaw.split(/[;|]/).map((x) => x.trim()).filter(Boolean), case_sensitive: false };
      } else {
        q.options = optJson ? json(optJson, "options") : null;
        q.correct = goodRaw ? json(goodRaw, "le corrigé") : null;
      }
      q.terminal = json(get(r, idx.terminal), "terminal");
      q.external = json(get(r, idx.external), "externe");
      checkQuestions([q]);
      questions.push(q);
    } catch (e: any) {
      skipped.push({ line, error: String(e?.message || e).replace(/^question 1 : /, "") });
    }
  });
  return { questions, skipped, ignoredColumns };
}

/** Compatibilité : lève une erreur si une ligne est fautive. */
export function parseExamCsv(text: string): FileQuestion[] {
  const x = readExamCsv(text);
  if (x.skipped.length) throw new Error(`ligne ${x.skipped[0].line} : ${x.skipped[0].error}`);
  return x.questions;
}
