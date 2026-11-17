import { toDraftQuestion, toFileQuestion, type DraftQuestion, type FileQuestion } from "@/lib/admin/exam-file";

/** Niveaux de la banque (année visée). « Tous » = question utilisable partout. */
export const LEVELS = ["B1", "B2", "B3", "M1", "M2", "Tous"] as const;

/** Domaines proposés par défaut ; on peut en saisir d'autres. */
export const DEFAULT_DOMAINS = [
  "Réseau", "Système Linux", "Système Windows", "Web", "Sécurité offensive", "Sécurité défensive (SOC)",
  "Cryptographie", "Programmation", "Cloud", "OSINT", "Forensic", "Gouvernance et RGPD", "Logique", "Culture cyber", "Anglais technique",
];

/** Ramène une saisie libre (« Bachelor 1 », « b3 », « Master 2 ») à un niveau de la banque. */
export function normLevel(v?: string | null): string {
  const s = String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const m = s.match(/\b(b|bachelor|licence|l)\s*([1-3])\b/) || s.match(/^(b)([1-3])$/);
  if (m) return `B${m[2]}`;
  const k = s.match(/\b(m|master|mastere|msc)\s*([12])\b/) || s.match(/^(m)([12])$/);
  if (k) return `M${k[2]}`;
  return "Tous";
}

export type BankRow = {
  id?: string; level: string; domain: string | null; type: string; prompt: string; options: any; correct: any;
  points: number; explanation: string | null; image_url: string | null; time_limit_s: number | null;
  terminal: any; external: any; source: string | null; created_at?: string;
};

export function fileToBank(q: FileQuestion, level: string, source: string | null): BankRow {
  return {
    level: q.level ? normLevel(q.level) : level, domain: q.domain || null, type: q.type, prompt: q.prompt,
    options: q.options ?? null, correct: q.correct ?? null, points: Number(q.points ?? 1),
    explanation: q.explanation || null, image_url: q.image_url || null, time_limit_s: q.time_limit_s || null,
    terminal: q.terminal ?? null, external: q.external ?? null, source,
  };
}

export const draftToBank = (d: DraftQuestion, level: string, source: string | null) => fileToBank(toFileQuestion(d), level, source);

export function bankToDraft(r: BankRow): DraftQuestion {
  return toDraftQuestion({
    type: r.type, prompt: r.prompt, options: r.options, correct: r.correct, points: r.points, domain: r.domain,
    explanation: r.explanation, image_url: r.image_url, time_limit_s: r.time_limit_s, terminal: r.terminal, external: r.external,
  });
}
