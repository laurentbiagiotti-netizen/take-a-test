import { NextResponse } from "next/server";
import { apiError, body, UUID, withApi } from "@/lib/api/handler";
import { kickWebhooks } from "@/lib/webhooks";

/**
 * Actions de surveillance : { action: "reset_session" | "extend_time" | "terminate" | "review_identity" | "flag_suspicion" | "clear_suspicion" | "set_verdict", arg?: {...} }
 *   extend_time: { minutes }   terminate: { reason }   review_identity: { ok, note? }
 *   set_verdict: { verdict: "pass" | "review" | "fail" | null, reason } (décision forcée, motif obligatoire ; null l'annule)
 */
const ACTIONS = new Set(["reset_session", "extend_time", "terminate", "review_identity", "flag_suspicion", "clear_suspicion", "set_verdict"]);

export const POST = withApi<{ id: string }>("proctor:write", async ({ admin, req, actorId }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const input = await body<{ action?: string; arg?: unknown }>(req, 8 * 1024);
  if (!input?.action || !ACTIONS.has(input.action)) return apiError(400, "validation_error", "Action inconnue");
  const { data, error } = await admin.rpc("staff_action", {
    p_actor: actorId, p_attempt: id, p_action: input.action, p_arg: input.arg ?? {},
  });
  if (error) return apiError(400, error.message.split(":")[0]);
  if (input.action === "terminate" || input.action === "set_verdict") kickWebhooks();
  return NextResponse.json({ data });
});
