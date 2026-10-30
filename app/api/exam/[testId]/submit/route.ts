import { examError, examRoute, json, rpcError } from "@/lib/exam/guard";
import { examCookieName } from "@/lib/security/tokens";
import { kickWebhooks } from "@/lib/webhooks";

export const POST = examRoute({ rotate: true }, async (ctx) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const { data, error } = await ctx.admin.rpc("exam_submit", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  kickWebhooks();
  const res = json(data);
  res.cookies.set(examCookieName(ctx.testId), "", { path: `/api/exam/${ctx.testId}`, maxAge: 0 });
  return res;
});
