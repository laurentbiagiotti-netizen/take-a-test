import { NextResponse } from "next/server";
import { apiError, UUID, withApi } from "@/lib/api/handler";

/** Détail d'une tentative : réponses, journal de surveillance, intégrité. */
export const GET = withApi<{ id: string }>("results:read", async ({ admin }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const { data: a } = await admin.from("attempts")
    .select("id, test_id, status, score, max_score, violation_count, identity_status, started_at, deadline_at, submitted_at, end_reason, extra_minutes, client_ip, user_agent, candidate:profiles(email, full_name)")
    .eq("id", id).maybeSingle();
  if (!a) return apiError(404, "not_found");
  const [{ data: answers }, { data: events }, { data: chain }] = await Promise.all([
    admin.from("answers").select("question_id, response, score, feedback, updated_at").eq("attempt_id", id),
    admin.from("proctor_events").select("id, kind, severity, detail, ip, created_at").eq("attempt_id", id).order("id"),
    admin.rpc("verify_event_chain", { p_attempt: id }),
  ]);
  return NextResponse.json({ data: { ...a, answers, events, journal_integrity: Array.isArray(chain) ? chain[0] : chain } });
});
