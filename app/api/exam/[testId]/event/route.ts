import { examError, examRoute, json, readJson, rpcError } from "@/lib/exam/guard";
import { kickWebhooks } from "@/lib/webhooks";

/** Le client signale ; la base décide de la gravité et des sanctions. */
export const POST = examRoute({ rotate: true }, async (ctx, req) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const body = await readJson<{ kind?: string; detail?: unknown }>(req, 4 * 1024);
  if (!body?.kind || !/^[a-z_]{2,40}$/.test(body.kind)) return examError("unknown_event");
  const { data, error } = await ctx.admin.rpc("exam_log_event", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash,
    p_kind: body.kind, p_detail: body.detail ?? null, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  if (data?.status !== "in_progress") kickWebhooks();
  return json(data);
});
