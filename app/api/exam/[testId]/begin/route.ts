import { NextRequest } from "next/server";
import { examError, examGuard, json, rpcError } from "@/lib/exam/guard";
import { examCookieName, randomHex, sha256Hex } from "@/lib/security/tokens";

/**
 * Démarre ou reprend l'examen. Émet un jeton de session unique (cookie
 * httpOnly, SameSite=Strict, limité aux routes de CET examen). Un second
 * appareil est refusé tant que le surveillant n'a pas réinitialisé la session.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const g = await examGuard(req, testId);
  if ("res" in g) return g.res;
  const { ctx } = g;
  if (!ctx.attemptId) return examError("attempt_not_found");

  // Le jeton est TOUJOURS généré par le serveur (pas de fixation de session) ;
  // le cookie existant ne sert qu'à reconnaître le même navigateur.
  const token = randomHex(32);
  const { data, error } = await ctx.admin.rpc("exam_begin", {
    p_user: ctx.userId, p_attempt: ctx.attemptId,
    p_new_token_hash: await sha256Hex(token), p_prev_token_hash: ctx.tokenHash,
    p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);

  const res = json(data);
  if (data?.status === "in_progress" && data?.token === "new") {
    res.cookies.set(examCookieName(testId), token, {
      httpOnly: true, secure: true, sameSite: "strict",
      path: `/api/exam/${testId}`, maxAge: 60 * 60 * 12,
    });
  }
  return res;
}
