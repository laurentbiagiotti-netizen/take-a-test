import { examError, examRoute, json, rpcError } from "@/lib/exam/guard";
import { appUrl } from "@/lib/security/env";
import { randomHex, sha256Hex } from "@/lib/security/tokens";

/**
 * Lien du QR code pour filmer la pièce au téléphone. Le jeton n'est connu que du
 * poste du candidat (seul son haché est en base) et passe dans le fragment de
 * l'URL : il n'apparaît dans aucun journal de serveur.
 */
export const POST = examRoute({ rotate: true }, async (ctx) => {
  if (!ctx.attemptId) return examError("attempt_not_found");
  const token = randomHex(32);
  const { data, error } = await ctx.admin.rpc("exam_scan_link", {
    p_user: ctx.userId, p_attempt: ctx.attemptId, p_token_hash: ctx.tokenHash,
    p_scan_hash: await sha256Hex(token), p_ip: ctx.ip, p_ua: ctx.ua,
  });
  if (error) return rpcError(error);
  if (!data?.paused) return json(data);
  return json({ ...data, url: `${appUrl()}/scan#t=${token}` });
});
