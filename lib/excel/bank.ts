/**
 * Banque de questions au format Excel de la plateforme de Dylan (même modèle,
 * mêmes colonnes) : Question, Type, Réponse A à F, Bonne(s) réponse(s), Thème,
 * Formation visée, Points, Temps (secondes), Explication.
 *
 * Ce module ne dépend pas d'Excel : il travaille sur des lignes de texte, que
 * lib/excel/xlsx.ts lit et écrit avec exceljs.
 */
export const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
export const COLUMNS = [
  "Question", "Type",
  "Réponse A", "Réponse B", "Réponse C", "Réponse D", "Réponse E", "Réponse F",
  "Bonne(s) réponse(s)", "Thème", "Formation visée", "Points", "Temps (secondes)", "Explication",
] as const;

export const FORMATIONS = [
  "Bachelor 1 Cybersécurité", "Bachelor 2 Cybersécurité", "Bachelor 3 Cybersécurité",
  "Mastère 1 Cybersécurité", "Mastère 2 Cybersécurité", "Mastère 1 IA et Data", "Mastère 2 IA et Data", "Mastère DPO",
];

export type BankType = "mcq_single" | "mcq_multi" | "short_answer";
export type ImportedQuestion = {
  type: BankType;
  prompt: string;
  options: { id: string; text: string }[] | { placeholder?: string } | null;
  correct: string[] | { answers: string[]; case_sensitive: boolean };
  points: number;
  domain: string | null;
  formation: string;
  time_limit_s: number | null;
  explanation: string | null;
  /** Vrai/Faux : QCM à deux réponses. */
  trueFalse?: boolean;
};
export type ImportRow = { line: number; prompt: string; typeLabel: string; domain: string; errors: string[]; question: ImportedQuestion | null };

/** Minuscules, sans accents ni espaces multiples (comparaisons tolérantes). */
export function normalize(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const TYPE_FROM_LABEL: Record<string, "single" | "multiple" | "truefalse" | "short" | "open"> = {
  qcm_unique: "single", qcm_multiple: "multiple", vrai_faux: "truefalse", reponse_courte: "short", ouverte: "open",
  unique: "single", qcm: "single", choix_unique: "single", qcu: "single",
  multiple: "multiple", choix_multiple: "multiple", qcm_multiples: "multiple", qcm_multi: "multiple",
  vrai_ou_faux: "truefalse", vf: "truefalse", truefalse: "truefalse",
  courte: "short", reponse_libre_courte: "short", short: "short", reponse_courte_: "short",
  question_ouverte: "open", libre: "open", open: "open",
};

export const TYPE_LABEL: Record<string, string> = {
  mcq_single: "QCM_unique", mcq_multi: "QCM_multiple", truefalse: "Vrai_Faux", short_answer: "Reponse_courte",
};

/** « Réseau », « réseaux », « RESEAUX » : même thème. */
export function themeKey(s: string): string {
  return normalize(String(s || "").replace(/&/g, " et ")).replace(/[^a-z0-9 ]/g, " ").split(" ").filter(Boolean)
    .map((w) => (w.length > 3 ? w.replace(/[sx]$/, "") : w)).join(" ");
}

/** Garde la première orthographe rencontrée (celles déjà dans l'épreuve d'abord). */
export function canonicalTheme(name: string, known: Map<string, string>): string {
  const t = String(name || "").trim();
  if (!t) return "";
  const k = themeKey(t);
  if (known.has(k)) return known.get(k)!;
  known.set(k, t);
  return t;
}

/**
 * Analyse les lignes d'une feuille (la première est l'en-tête).
 * existing : énoncés déjà dans l'épreuve (doublons signalés).
 * formation : formation de l'épreuve ; les lignes destinées à une autre
 * formation sont écartées (vide = question commune).
 */
export function parseBank(sheet: string[][], opts: { existing?: string[]; formation?: string; themes?: string[] } = {}): ImportRow[] {
  const [head = [], ...lines] = sheet;
  const header = head.map(normalize);
  const col = (...names: string[]) => {
    for (const n of names) { const i = header.indexOf(normalize(n)); if (i >= 0) return i; }
    return -1;
  };
  const idx = {
    q: col("Question", "Énoncé"), type: col("Type"),
    ans: LETTERS.map((l) => col(`Réponse ${l}`, l)),
    good: col("Bonne(s) réponse(s)", "Bonne réponse", "Bonnes réponses", "Réponse"),
    theme: col("Thème", "Domaine", "Theme", "Matière"),
    formation: col("Formation visée", "Formation", "Catégorie"),
    points: col("Points"), time: col("Temps (secondes)", "Temps"), expl: col("Explication"),
  };
  if (idx.q < 0 || idx.type < 0) throw new Error("Colonnes « Question » et « Type » introuvables : utilisez le modèle Excel.");

  const existing = new Set((opts.existing || []).map(normalize));
  const known = new Map<string, string>();
  (opts.themes || []).forEach((t) => canonicalTheme(t, known));
  const seen = new Set<string>();
  const out: ImportRow[] = [];

  lines.forEach((row, i) => {
    const get = (c: number) => (c >= 0 ? String(row[c] ?? "").trim() : "");
    const prompt = get(idx.q);
    const typeLabel = get(idx.type);
    if (!prompt && !typeLabel) return;
    const line = i + 2;
    const errors: string[] = [];
    const kind = TYPE_FROM_LABEL[normalize(typeLabel).replace(/[\s-]+/g, "_")];
    if (!prompt) errors.push("Question vide");
    if (kind === "open") errors.push("Question ouverte refusée : seulement des questions corrigées automatiquement");
    else if (!kind) errors.push(`Type inconnu « ${typeLabel} »`);

    const fRaw = get(idx.formation);
    const formation = fRaw ? FORMATIONS.find((f) => normalize(f) === normalize(fRaw.replace("&", "et"))) || "" : "";
    if (fRaw && !formation) errors.push(`Formation inconnue « ${fRaw} »`);
    if (formation && opts.formation && formation !== opts.formation) return; // destinée à une autre formation

    const pointsRaw = get(idx.points).replace(",", ".");
    const points = pointsRaw === "" ? 1 : Number(pointsRaw);
    if (!(points > 0 && points <= 100)) errors.push("Points invalides");
    const timeRaw = get(idx.time).replace(",", ".");
    const time = timeRaw === "" ? null : Number(timeRaw);
    if (time !== null && !(time >= 5 && time <= 3600)) errors.push("Temps invalide (5 à 3600 secondes)");

    const good = get(idx.good);
    let question: ImportedQuestion | null = null;
    const base = {
      prompt, points: points > 0 ? points : 1, formation,
      domain: canonicalTheme(get(idx.theme), known) || null,
      time_limit_s: time !== null && time >= 5 ? Math.round(time) : null,
      explanation: get(idx.expl) || null,
    };

    if (kind === "single" || kind === "multiple") {
      const texts = idx.ans.map(get);
      const letters = good.toUpperCase().split(/[;,\s]+/).filter(Boolean);
      const filled = LETTERS.filter((_, k) => texts[k] !== "");
      const opts2 = LETTERS.map((l, k) => ({ id: l.toLowerCase(), text: texts[k] })).filter((o) => o.text !== "");
      if (opts2.length < 2) errors.push("Au moins 2 réponses nécessaires");
      if (!letters.length) errors.push("Bonne réponse manquante");
      const unknown = letters.filter((l) => !filled.includes(l as never));
      if (unknown.length) errors.push(`Bonne réponse ${unknown.join(", ")} sans proposition`);
      if (kind === "single" && letters.length > 1) errors.push("QCM_unique avec plusieurs bonnes réponses");
      if (new Set(opts2.map((o) => normalize(o.text))).size !== opts2.length) errors.push("Deux propositions identiques");
      question = { ...base, type: kind === "single" ? "mcq_single" : "mcq_multi", options: opts2, correct: letters.map((l) => l.toLowerCase()) };
    } else if (kind === "truefalse") {
      const a = normalize(good);
      if (a !== "vrai" && a !== "faux") errors.push("Bonne réponse attendue : Vrai ou Faux");
      question = { ...base, type: "mcq_single", trueFalse: true,
        options: [{ id: "vrai", text: "Vrai" }, { id: "faux", text: "Faux" }], correct: [a === "faux" ? "faux" : "vrai"] };
    } else if (kind === "short") {
      const answers = good.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
      if (!answers.length) errors.push("Réponse(s) acceptée(s) manquante(s)");
      question = { ...base, type: "short_answer", options: {}, correct: { answers, case_sensitive: false } };
    }

    const key = normalize(prompt);
    if (key && seen.has(key)) errors.push("Doublon dans le fichier");
    else if (key && existing.has(key)) errors.push("Question déjà présente dans l'épreuve");
    seen.add(key);

    out.push({ line, prompt, typeLabel, domain: base.domain || "", errors, question: errors.length ? null : question });
  });
  return out;
}

/** Ligne Excel d'une question de l'épreuve (export de la banque). */
export function toBankRow(q: { type: string; prompt: string; options: any; correct: any; points: number; domain?: string | null; time_limit_s?: number | null; explanation?: string | null }, formation = ""): (string | number)[] | null {
  const opts = ["", "", "", "", "", ""];
  let type = "", answer = "";
  if (q.type === "mcq_single" || q.type === "mcq_multi") {
    const list: { id: string; text: string }[] = Array.isArray(q.options) ? q.options : [];
    const isTF = list.length === 2 && normalize(list[0].text) === "vrai" && normalize(list[1].text) === "faux";
    if (isTF) {
      type = "Vrai_Faux";
      answer = list.find((o) => (q.correct || []).includes(o.id))?.text || "";
    } else {
      type = q.type === "mcq_single" ? "QCM_unique" : "QCM_multiple";
      list.slice(0, 6).forEach((o, i) => { opts[i] = o.text; });
      answer = list.slice(0, 6).map((o, i) => ((q.correct || []).includes(o.id) ? LETTERS[i] : null)).filter(Boolean).join(";");
    }
  } else if (q.type === "short_answer") {
    type = "Reponse_courte";
    answer = (q.correct?.answers || []).join(";");
  } else return null; // types sans équivalent dans le modèle Excel (terminal, exercices…)
  return [q.prompt, type, ...opts, answer, q.domain || "", formation, Number(q.points) || 1, q.time_limit_s || "", q.explanation || ""];
}
