import { examError, examRoute, json, readJson, rpcError } from "@/lib/exam/guard";

/** Navigation linéaire : valide la question courante et passe à la suivante. */
export const POST = examRoute({ rotate: true }, async (ctx, req) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const body = await readJson<{ from?: number }>(req, 256);
  if (!Number.isInteger(body?.from)) return examError("bad_response");
  const { data, error } = await ctx.admin.rpc("exam_next", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash, p_from: body!.from, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  return json(data);
});
