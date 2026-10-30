import { examError, examRoute, json, readJson, rpcError } from "@/lib/exam/guard";
import { evaluateObjectives, promptFor, runShell, type Scenario, type ShellState } from "@/lib/terminal/shell";

/**
 * Exécute une commande sur la machine simulée d'une question « terminal ».
 * Le scénario et l'état (fichiers, processus…) sont lus et réécrits en base
 * par le serveur ; le navigateur ne reçoit que la sortie, le prompt et la
 * liste des missions cochées. Chaque commande est journalisée.
 */
export const POST = examRoute({ rotate: true }, async (ctx, req) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const body = await readJson<{ question_id?: string; command?: string }>(req, 4096);
  if (!body?.question_id || typeof body.command !== "string" || body.command.length > 500) return examError("bad_response");
  const { data, error } = await ctx.admin.rpc("exam_terminal_scenario", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash,
    p_question: body.question_id, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  if (data?.status !== "in_progress") return json({ status: data?.status });

  const scn = data.scenario as Scenario;
  const r = runShell(scn, (data.state as ShellState) || null, body.command);
  const objectives = evaluateObjectives(scn, r.state);
  const { error: e2 } = await ctx.admin.rpc("exam_terminal_save", {
    p_attempt: ctx.attemptId, p_question: body.question_id, p_state: r.state,
    p_done: objectives.filter((o) => o.done).map((o) => o.id), p_total: objectives.length,
  });
  if (e2) return rpcError(e2);
  await ctx.admin.rpc("exam_terminal_log", { p_attempt: ctx.attemptId, p_question: body.question_id, p_cwd: r.state.cwd, p_cmd: body.command });
  return json({ status: "in_progress", output: r.output, prompt: promptFor(scn, r.state.cwd), clear: !!r.clear, objectives });
});
