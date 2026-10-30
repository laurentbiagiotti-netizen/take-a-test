import { NextRequest } from "next/server";
import { examError, examGuard, json, rpcError } from "@/lib/exam/guard";
import { readImage } from "@/lib/exam/images";
import { randomHex } from "@/lib/security/tokens";

/** Capture webcam : déposée par le SERVEUR dans le bucket privé. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const g = await examGuard(req, testId);
  if ("res" in g) return g.res;
  const { ctx } = g;
  if (!ctx.attemptId || !ctx.tokenHash) return examError("session_invalid");

  const form = await req.formData().catch(() => null);
  const img = await readImage(form?.get("image") ?? null, 300 * 1024);
  if (!img || img.type === "image/png") return examError("bad_response");

  const path = `${ctx.attemptId}/${Date.now()}-${randomHex(6)}.${img.ext}`;
  const up = await ctx.admin.storage.from("snapshots").upload(path, img.bytes, { contentType: img.type });
  if (up.error) { console.error("[snapshot]", up.error); return examError("server_error"); }

  const { data, error } = await ctx.admin.rpc("exam_add_snapshot", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash, p_path: path, p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error || data?.status !== "in_progress") {
    await ctx.admin.storage.from("snapshots").remove([path]);
    return error ? rpcError(error) : json(data);
  }
  return json(data);
}
