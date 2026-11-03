/** Résultat d'admission : libellés et couleurs (même logique que _attempt_report en base). */
export type Verdict = "pass" | "review" | "fail";

export const VERDICT_LABEL: Record<Verdict, string> = { pass: "Test réussi", review: "À statuer", fail: "Test échoué" };
export const VERDICT_BADGE: Record<Verdict, string> = { pass: "badge-ok", review: "badge-warn", fail: "badge-danger" };

export type Report = {
  score: number | null; max_score: number | null; score20: number | null;
  thresholds?: { pass: number; fail: number };
  needs_manual?: boolean;
  verdict: Verdict | null; verdict_label: string | null;
  verdict_auto: Verdict | null;
  verdict_override: { verdict: Verdict; reason: string; at: string; by: string | null } | null;
  below_floors?: string[];
  domains?: { domain: string; score: number; max: number; ratio: number | null; floor: number | null; below: boolean }[];
};

/** Calcul côté client (démo, aperçu) identique à la base. */
export function verdictFor(score20: number | null, t: { pass: number; fail: number }, opts: { needsManual?: boolean; belowFloors?: boolean } = {}): Verdict | null {
  if (score20 === null || !Number.isFinite(score20)) return null;
  if (opts.needsManual) return "review";
  if (score20 < t.fail) return "fail";
  if (score20 >= t.pass && !opts.belowFloors) return "pass";
  return "review";
}

export const fmt20 = (n: number | null | undefined) =>
  n === null || n === undefined ? "-" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}/20`;
