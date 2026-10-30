import { examError, examRoute, json, rpcError } from "@/lib/exam/guard";
import { kickWebhooks } from "@/lib/webhooks";

export const POST = examRoute({ rotate: true }, async (ctx) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const { data, error } = await ctx.admin.rpc("exam_heartbeat", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  if (data?.status !== "in_progress") kickWebhooks();
  return json(data);
});
