import { NextRequest } from "next/server";
import { examGuard, json, readJson, rpcError } from "@/lib/exam/guard";

export async function POST(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const g = await examGuard(req, testId);
  if ("res" in g) return g.res;
  const { ctx } = g;
  const body = await readJson<{ code?: string }>(req, 1024);
  const code = String(body?.code || "").slice(0, 64);
  if (!code) return json({ error: "code_required", message: "Code requis." }, { status: 400 });

  const { data, error } = await ctx.admin.rpc("exam_unlock", {
    p_user: ctx.userId, p_test: testId, p_code: code, p_ip: ctx.ip,
  });
  if (error) return rpcError(error);
  if (!data?.ok) {
    const message = data?.error === "code_already_used" ? "Ce code a déjà été utilisé par un autre compte." : "Code incorrect.";
    return json({ error: data?.error, message }, { status: 403 });
  }
  return json({ ok: true });
}
