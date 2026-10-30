import { NextRequest } from "next/server";
import { examError, examGuard, json, rpcError } from "@/lib/exam/guard";
import { examCookieName } from "@/lib/security/tokens";
import { kickWebhooks } from "@/lib/webhooks";

export async function POST(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const g = await examGuard(req, testId);
  if ("res" in g) return g.res;
  const { ctx } = g;
  if (!ctx.attemptId) return examError("attempt_not_found");
  const { data, error } = await ctx.admin.rpc("exam_submit", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  kickWebhooks();
  const res = json(data);
  res.cookies.set(examCookieName(testId), "", { path: `/api/exam/${testId}`, maxAge: 0 });
  return res;
}
