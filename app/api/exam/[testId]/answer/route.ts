import { NextRequest } from "next/server";
import { examError, examGuard, json, readJson, rpcError } from "@/lib/exam/guard";
import { kickWebhooks } from "@/lib/webhooks";

export async function POST(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const g = await examGuard(req, testId);
  if ("res" in g) return g.res;
  const { ctx } = g;
  if (!ctx.attemptId) return examError("attempt_not_found");
  const body = await readJson<{ question_id?: string; response?: unknown }>(req, 48 * 1024);
  if (!body?.question_id || typeof body.response !== "object" || body.response === null) return examError("bad_response");

  const { data, error } = await ctx.admin.rpc("exam_save_answer", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash,
    p_question: body.question_id, p_response: body.response,
  });
  if (error) return rpcError(error);
  if (data?.status !== "in_progress") kickWebhooks();
  return json(data);
}
