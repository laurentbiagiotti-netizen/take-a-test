import { examError, examRoute, json, readJson, rpcError } from "@/lib/exam/guard";

/** Message du candidat au surveillant (question, problème technique). */
export const POST = examRoute({ rotate: true }, async (ctx, req) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const body = await readJson<{ body?: string }>(req, 4 * 1024);
  if (typeof body?.body !== "string") return examError("message_invalid");
  const { data, error } = await ctx.admin.rpc("exam_send_message", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash,
    p_body: body.body, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  return json(data);
});
