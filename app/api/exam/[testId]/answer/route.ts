import { examError, examRoute, json, readJson, rpcError } from "@/lib/exam/guard";
import { autoScore } from "@/lib/questions/grade-server";
import { kickWebhooks } from "@/lib/webhooks";

export const POST = examRoute({ rotate: true }, async (ctx, req) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const body = await readJson<{ question_id?: string; response?: unknown }>(req, 48 * 1024);
  if (!body?.question_id || typeof body.response !== "object" || body.response === null) return examError("bad_response");
  const { data, error } = await ctx.admin.rpc("exam_save_answer", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash,
    p_question: body.question_id, p_response: body.response, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  if (data?.status !== "in_progress") kickWebhooks();
  // Types notés par le serveur : la note est calculée ici, sur la réponse enregistrée, jamais par le navigateur
  if (data?.auto) {
    const [{ data: q }, { data: k }] = await Promise.all([
      ctx.admin.from("questions").select("type, options, points").eq("id", body.question_id).single(),
      ctx.admin.from("answer_keys").select("correct").eq("question_id", body.question_id).maybeSingle(),
    ]);
    if (q) {
      const score = await autoScore(q.type, q.options, k?.correct, data.response, Number(q.points));
      if (score !== null) await ctx.admin.rpc("exam_set_auto_score", { p_attempt: ctx.attemptId, p_question: body.question_id, p_response: data.response, p_score: score });
    }
    const { response: _r, auto: _a, ...rest } = data;
    return json(rest);
  }
  return json(data);
});
