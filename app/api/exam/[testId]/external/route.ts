import { examError, examRoute, json, readJson, rpcError } from "@/lib/exam/guard";
import { appUrl } from "@/lib/security/env";
import { signLaunch, toolConfig } from "@/lib/external/server";
import { isScenario } from "@/lib/external/grade";

/**
 * Ouvre l'exercice externe de la question courante. Renvoie l'adresse à
 * charger dans le cadre de l'épreuve, avec un jeton signé dans le fragment
 * (#t=…, jamais envoyé dans les journaux des serveurs ni dans le Referer).
 * Rappeler cette route rouvre la même session : un rechargement de page ne
 * redonne pas de temps et ne remet pas le score à zéro.
 */
export const POST = examRoute({ rotate: true }, async (ctx, req) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const body = await readJson<{ question_id?: string }>(req, 1024);
  if (!body?.question_id) return examError("bad_response");
  const { data, error } = await ctx.admin.rpc("exam_external_launch", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash,
    p_question: body.question_id, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  if (data?.status !== "in_progress") return json({ status: data?.status });

  const tool = toolConfig(data.tool);
  if (!tool) {
    console.error(`[external] outil « ${data.tool} » non configuré (EXTERNAL_${String(data.tool).toUpperCase()}_SECRET)`);
    return json({ status: "in_progress", unavailable: true, completed: !!data.completed });
  }
  const exp = Math.floor(new Date(data.deadline_at).getTime() / 1000);
  let scn: unknown;
  if (tool.grading === "tool") scn = data.scenario;
  else if (!isScenario(data.scenario)) return json({ status: "in_progress", unavailable: true, completed: !!data.completed });
  const token = await signLaunch({
    v: 1, aud: tool.id, sid: data.session_id, n: data.nonce, iat: Math.floor(Date.now() / 1000), exp,
    api: appUrl(), ...(scn !== undefined ? { scn } : {}),
  }, tool.secret);
  // Pour les outils sans serveur, la page de l'outil demande elle-même le contenu (sans corrigé).
  return json({
    status: "in_progress", url: `${tool.url}${tool.path}#t=${token}`, origin: tool.origin,
    deadline_at: data.deadline_at, completed: !!data.completed,
  });
});
