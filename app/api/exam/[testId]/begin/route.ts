import { examError, examRoute, json, rpcError } from "@/lib/exam/guard";
import { examCookieName, randomHex, sha256Hex } from "@/lib/security/tokens";

/**
 * Démarre ou reprend l'examen. Le jeton de session est TOUJOURS généré par
 * le serveur (cookie httpOnly, SameSite=Strict, limité aux routes de CET
 * examen) ; le cookie existant ne sert qu'à reconnaître le même navigateur.
 * Émet aussi le premier jeton de requête tournant (en-tête X-Exam-Nonce).
 */
export const POST = examRoute({ rotate: false }, async (ctx) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const token = randomHex(32);
  const nonce = randomHex(32);
  const { data, error } = await ctx.admin.rpc("exam_begin", {
    p_user: ctx.userId, p_attempt: ctx.attemptId,
    p_new_token_hash: await sha256Hex(token), p_prev_token_hash: ctx.tokenHash,
    p_ip: ctx.ip, p_ua: ctx.ua, p_nonce_hash: await sha256Hex(nonce),
  });
  if (error) return rpcError(error);
  const res = json(data);
  if (data?.status === "in_progress") {
    res.headers.set("X-Exam-Nonce", nonce);
    if (data?.token === "new") {
      res.cookies.set(examCookieName(ctx.testId), token, {
        httpOnly: true, secure: true, sameSite: "strict", path: `/api/exam/${ctx.testId}`, maxAge: 60 * 60 * 12,
      });
    }
  }
  return res;
});
