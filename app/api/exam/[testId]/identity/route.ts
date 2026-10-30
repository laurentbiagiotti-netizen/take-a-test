import { examError, examRoute, json, rpcError } from "@/lib/exam/guard";
import { readImage } from "@/lib/exam/images";
import { randomHex } from "@/lib/security/tokens";

/**
 * Vérification d'identité avant l'épreuve : photo de la pièce d'identité +
 * selfie, stockées dans un bucket privé (lecture surveillants uniquement,
 * purge automatique après la durée de conservation du test).
 */
export const POST = examRoute({ rotate: false }, async (ctx, req) => {
  if (!ctx.attemptId) return examError("attempt_not_found");

  const form = await req.formData().catch(() => null);
  const doc = await readImage(form?.get("document") ?? null, 3 * 1024 * 1024);
  const selfie = await readImage(form?.get("selfie") ?? null, 3 * 1024 * 1024);
  if (!doc || !selfie) return examError("bad_response");

  const base = `${ctx.attemptId}/${Date.now()}-${randomHex(6)}`;
  const paths = { document: `${base}-document.${doc.ext}`, selfie: `${base}-selfie.${selfie.ext}` };
  const bucket = ctx.admin.storage.from("identity");
  const u1 = await bucket.upload(paths.document, doc.bytes, { contentType: doc.type });
  const u2 = await bucket.upload(paths.selfie, selfie.bytes, { contentType: selfie.type });
  if (u1.error || u2.error) {
    await bucket.remove([paths.document, paths.selfie]);
    console.error("[identity]", u1.error || u2.error);
    return examError("server_error");
  }

  const { error } = await ctx.admin.rpc("exam_submit_identity", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_paths: paths, p_ip: ctx.ip,
  });
  if (error) { await bucket.remove([paths.document, paths.selfie]); return rpcError(error); }
  return json({ ok: true });
});
