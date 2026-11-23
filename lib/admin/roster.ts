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
    supabase.from("invites").select("test_id, email").in("test_id", testIds).eq("preview", true),
    Promise.all(testIds.map((id) => supabase.rpc("test_results", { p_test: id }).then((r) => (r.data || {}) as Record<string, any>))),
  ]);
  const rep: Record<string, any> = Object.assign({}, ...reports);
  const prev = new Set((previews || []).map((p: any) => `${p.test_id}|${String(p.email).toLowerCase()}`));
  return (attempts || []).map((a: any) => {
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
    } as RosterRow;
  });
}

/** Chiffres d'une liste de copies (copies d'essai exclues sauf demande). */
export function summarize(rows: RosterRow[]) {
  const done = rows.filter((r) => r.score20 != null);
  const avg = done.length ? done.reduce((s, r) => s + (r.score20 || 0), 0) / done.length : null;
  return {
    total: rows.length,
    done: done.length,
    live: rows.filter((r) => r.status === "in_progress").length,
    avg,
    pass: rows.filter((r) => r.verdict === "pass").length,
    review: rows.filter((r) => r.verdict === "review").length,
    fail: rows.filter((r) => r.verdict === "fail").length,
  };
}
