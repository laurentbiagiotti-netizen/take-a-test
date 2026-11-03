import { examError, examRoute, json, pauseState, rpcError } from "@/lib/exam/guard";
import { kickWebhooks } from "@/lib/webhooks";

export const POST = examRoute({ rotate: true }, async (ctx) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const { data, error } = await ctx.admin.rpc("exam_heartbeat", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  if (data?.status !== "in_progress") { kickWebhooks(); return json(data); }
  // Messages échangés avec le surveillant (la session vient d'être vérifiée par exam_heartbeat)
  const { data: messages } = await ctx.admin.from("exam_messages").select("id, sender, body, created_at")
    .eq("attempt_id", ctx.attemptId).order("id").limit(80);
  return json({ ...data, ...(await pauseState(ctx)), messages: messages || [] });
});
