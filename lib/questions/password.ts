/**
 * Type de question « password » : robustesse des mots de passe, notée avec
 * zxcvbn-ts (estimation du nombre d'essais nécessaires) côté serveur.
 *  - mode « rank »   : classer des mots de passe du plus faible au plus fort
 *  - mode « create » : proposer un mot de passe qui respecte une politique et atteint un score minimal
 */
export type PasswordPolicy = { min_length?: number; upper?: boolean; lower?: boolean; digit?: boolean; symbol?: boolean; min_score?: number; forbid?: string[] };
export type PasswordOptions = { mode: "rank"; items: { id: string; text: string }[] } | { mode: "create"; policy: PasswordPolicy };

export const POLICY_RULES: { key: keyof PasswordPolicy; label: (p: PasswordPolicy) => string; ok: (pw: string, p: PasswordPolicy) => boolean }[] = [
  { key: "min_length", label: (p) => `Au moins ${p.min_length} caractères`, ok: (pw, p) => [...pw].length >= (p.min_length || 0) },
  { key: "upper", label: () => "Une majuscule", ok: (pw) => /[A-ZÀ-Þ]/.test(pw) },
  { key: "lower", label: () => "Une minuscule", ok: (pw) => /[a-zß-ÿ]/.test(pw) },
  { key: "digit", label: () => "Un chiffre", ok: (pw) => /\d/.test(pw) },
  { key: "symbol", label: () => "Un caractère spécial", ok: (pw) => /[^A-Za-z0-9À-ÿ\s]/.test(pw) },
  { key: "forbid", label: (p) => `Sans : ${(p.forbid || []).join(", ")}`, ok: (pw, p) => !(p.forbid || []).some((w) => w && pw.toLowerCase().includes(w.toLowerCase())) },
];

/** Règles visibles par le candidat (le score zxcvbn minimal reste côté serveur). */
export function policyChecks(pw: string, p: PasswordPolicy) {
  return POLICY_RULES.filter((r) => r.key === "forbid" ? (p.forbid || []).length > 0 : !!p[r.key]).map((r) => ({ label: r.label(p), ok: r.ok(pw, p) }));
}

export function validPasswordOptions(o: any): string | null {
  if (o?.mode === "rank") {
    if (!Array.isArray(o.items) || o.items.length < 3 || o.items.length > 8) return "3 à 8 mots de passe à classer";
    if (o.items.some((i: any) => typeof i?.id !== "string" || typeof i?.text !== "string" || !i.text || i.text.length > 64)) return "Mot de passe vide ou trop long";
    if (new Set(o.items.map((i: any) => i.text)).size !== o.items.length) return "Mots de passe en double";
    return null;
  }
  if (o?.mode === "create") {
    const p = o.policy || {};
    if (p.min_length !== undefined && (!Number.isInteger(p.min_length) || p.min_length < 1 || p.min_length > 64)) return "Longueur minimale entre 1 et 64";
    if (p.min_score !== undefined && (!Number.isInteger(p.min_score) || p.min_score < 0 || p.min_score > 4)) return "Score minimal entre 0 et 4";
    return null;
  }
  return "Mode « rank » ou « create » attendu";
}
