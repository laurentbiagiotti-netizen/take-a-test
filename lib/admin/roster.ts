import type { SupabaseClient } from "@supabase/supabase-js";

export type Verdict = "pass" | "review" | "fail" | null;

export type RosterRow = {
  attempt_id: string;
  test_id: string;
  first: string;
  last: string;
  email: string;
  named: boolean;          // le candidat a déclaré son prénom et son nom
  status: string;          // pending, in_progress, submitted, expired, terminated
  started_at: string | null;
  submitted_at: string | null;
  score: number | null;
  max: number | null;
  score20: number | null;
  verdict: Verdict;
  needs_manual: boolean;
  forced: boolean;
  preview: boolean;        // copie d'essai de l'équipe
  violations: number;
  suspicion: boolean;
  duration_s: number | null;  // temps passé (début → rendu)
  absent?: boolean;           // inscrit, jamais venu
};

const cap = (s: string) => s.replace(/(^|[\s'-])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());

/** Prénom et nom : déclarés par le candidat, sinon tirés du nom saisi, sinon de l'adresse prenom.nom@. */
export function splitName(p: { first_name?: string | null; last_name?: string | null; full_name?: string | null; email?: string | null }) {
  const email = String(p.email || "");
  if (p.first_name || p.last_name) return { first: p.first_name || "", last: (p.last_name || "").toLocaleUpperCase("fr-FR"), named: true };
  const full = String(p.full_name || "").trim();
  if (full && !full.includes("@") && full.toLowerCase() !== email.toLowerCase()) {
    const parts = full.split(/\s+/);
    if (parts.length === 1) return { first: "", last: parts[0].toLocaleUpperCase("fr-FR"), named: true };
    // « Prénom NOM » : les mots tout en majuscules forment le nom
    const upper = parts.filter((w) => w.length > 1 && w === w.toLocaleUpperCase("fr-FR"));
    if (upper.length && upper.length < parts.length) {
      return { first: parts.filter((w) => !upper.includes(w)).join(" "), last: upper.join(" "), named: true };
    }
    return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1].toLocaleUpperCase("fr-FR"), named: true };
  }
  const local = email.split("@")[0] || "";
  const bits = local.split(/[._]/).filter(Boolean).map((b) => b.replace(/\d+/g, "")).filter(Boolean);
  if (bits.length >= 2) return { first: cap(bits[0]), last: bits.slice(1).join(" ").toLocaleUpperCase("fr-FR"), named: false };
  return { first: "", last: local, named: false };
}

/** Candidats (copies) d'une ou plusieurs épreuves, avec note sur 20 et décision calculées par la base. */
export async function loadRoster(supabase: SupabaseClient, testIds: string[]): Promise<RosterRow[]> {
  if (!testIds.length) return [];
  const [{ data: attempts }, { data: previews }, reports] = await Promise.all([
    supabase.from("attempts")
      .select("id, test_id, status, started_at, submitted_at, score, max_score, violation_count, suspicion_at, verdict_override, candidate:profiles(*)")
      .in("test_id", testIds).neq("status", "pending"),
    supabase.from("invites").select("test_id, email, full_name, preview").in("test_id", testIds),
    Promise.all(testIds.map((id) => supabase.rpc("test_results", { p_test: id }).then((r) => (r.data || {}) as Record<string, any>))),
  ]);
  const rep: Record<string, any> = Object.assign({}, ...reports);
  const prev = new Set((previews || []).filter((p: any) => p.preview).map((p: any) => `${p.test_id}|${String(p.email).toLowerCase()}`));
  const seen = new Set((attempts || []).map((a: any) => `${a.test_id}|${String(a.candidate?.email || "").toLowerCase()}`));
  const absents: RosterRow[] = (previews || []).filter((i: any) => !i.preview && !seen.has(`${i.test_id}|${String(i.email).toLowerCase()}`))
    .map((i: any) => {
      const n = splitName({ full_name: i.full_name, email: i.email });
      return { attempt_id: `absent-${i.test_id}-${i.email}`, test_id: i.test_id, first: n.first, last: n.last, named: n.named, email: i.email,
        status: "absent", started_at: null, submitted_at: null, score: null, max: null, score20: null, verdict: null, needs_manual: false,
        forced: false, preview: false, violations: 0, suspicion: false, duration_s: null, absent: true };
    });
  return [...(attempts || []).map((a: any) => {
    const c = a.candidate || {};
    const r = rep[a.id] || {};
    const n = splitName(c);
    const done = ["submitted", "expired", "terminated"].includes(a.status);
    return {
      attempt_id: a.id, test_id: a.test_id, first: n.first, last: n.last, named: n.named, email: c.email || "",
      status: a.status, started_at: a.started_at, submitted_at: a.submitted_at,
      score: r.score ?? a.score ?? null, max: r.max_score ?? a.max_score ?? null,
      score20: done && r.score20 != null ? Number(r.score20) : null,
      verdict: done ? (r.verdict ?? null) : null, needs_manual: !!r.needs_manual, forced: !!a.verdict_override,
      preview: prev.has(`${a.test_id}|${String(c.email || "").toLowerCase()}`),
      violations: a.violation_count || 0, suspicion: !!a.suspicion_at,
      duration_s: a.started_at && a.submitted_at ? Math.max(0, Math.round((+new Date(a.submitted_at) - +new Date(a.started_at)) / 1000)) : null,
    } as RosterRow;
  }), ...absents];
}

/** Chiffres d'une liste de copies (copies d'essai exclues sauf demande). */
export function summarize(all: RosterRow[]) {
  const rows = all.filter((r) => !r.absent);
  const done = rows.filter((r) => r.score20 != null);
  const notes = done.map((r) => r.score20 as number).sort((a, b) => a - b);
  const median = notes.length ? (notes.length % 2 ? notes[(notes.length - 1) / 2] : (notes[notes.length / 2 - 1] + notes[notes.length / 2]) / 2) : null;
  const avg = done.length ? done.reduce((s, r) => s + (r.score20 || 0), 0) / done.length : null;
  return {
    total: rows.length,
    done: done.length,
    live: rows.filter((r) => r.status === "in_progress").length,
    avg,
    pass: rows.filter((r) => r.verdict === "pass").length,
    review: rows.filter((r) => r.verdict === "review").length,
    fail: rows.filter((r) => r.verdict === "fail").length,
    median, best: notes.length ? notes[notes.length - 1] : null, worst: notes.length ? notes[0] : null,
    above10: notes.filter((n) => n >= 10).length,
    absent: all.filter((r) => r.absent).length,
    /** Répartition des notes en 7 tranches de 0 à 20 */
    bins: Array.from({ length: 7 }, (_, k) => notes.filter((n) => Math.min(6, Math.floor((n / 20) * 7)) === k).length),
  };
}
