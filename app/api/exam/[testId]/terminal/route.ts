import { examError, examRoute, json, readJson, rpcError } from "@/lib/exam/guard";
import { runShell, promptFor, type Scenario } from "@/lib/terminal/shell";

/**
 * Exécute une commande dans le terminal simulé d'une question « terminal ».
 * Le scénario est lu en base par le serveur et n'est jamais renvoyé : le
 * navigateur ne reçoit que la sortie. Chaque commande est journalisée.
 */
export const POST = examRoute({ rotate: true }, async (ctx, req) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const body = await readJson<{ question_id?: string; cwd?: string; command?: string }>(req, 4096);
  if (!body?.question_id || typeof body.command !== "string") return examError("bad_response");
  const { data, error } = await ctx.admin.rpc("exam_terminal_scenario", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash,
    p_question: body.question_id, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  if (data?.status !== "in_progress") return json({ status: data?.status });
  const scn = data.scenario as Scenario;
  const r = runShell(scn, String(body.cwd || ""), body.command);
  await ctx.admin.rpc("exam_terminal_log", { p_attempt: ctx.attemptId, p_question: body.question_id, p_cwd: r.cwd, p_cmd: body.command });
  return json({ status: "in_progress", output: r.output, cwd: r.cwd, prompt: promptFor(scn, r.cwd), clear: !!r.clear });
});
