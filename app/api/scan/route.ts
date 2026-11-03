import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { clientIp, sameOrigin } from "@/lib/security/request";
import { randomHex, sha256Hex } from "@/lib/security/tokens";

const MAX_BYTES = 40 * 1024 * 1024;
const TOKEN = /^[0-9a-f]{64}$/;
const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, message: string, status = 400) => NextResponse.json({ error, message }, { status, headers: noStore });

/** Type réel de la vidéo d'après ses premiers octets (on ne croit pas l'en-tête du navigateur). */
function sniff(b: Uint8Array): { type: string; ext: string } | null {
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { type: "video/webm", ext: "webm" };
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return brand === "qt  " ? { type: "video/quicktime", ext: "mov" } : { type: "video/mp4", ext: "mp4" };
  }
  return null;
}

/**
 * Scan de la pièce depuis le téléphone, sans compte : le jeton du QR code suffit.
 *  - JSON { token } : vérifie le lien
 *  - multipart token, video, seconds : dépose la vidéo puis l'épreuve reprend
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("bad_origin", "Requête refusée.", 403);
  const admin = adminClient();
  const isForm = (req.headers.get("content-type") || "").startsWith("multipart/form-data");
  if (!isForm) {
    const body = await req.json().catch(() => null);
    if (!TOKEN.test(body?.token || "")) return fail("scan_invalid", "Lien invalide.", 410);
    const { data, error } = await admin.rpc("scan_lookup", { p_scan_hash: await sha256Hex(body.token) });
    if (error) return fail("scan_invalid", "Ce lien n'est plus valable. Rescannez le QR code affiché sur l'ordinateur.", 410);
    return NextResponse.json({ ok: true, title: data?.title || "" }, { headers: noStore });
  }

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BYTES + 64 * 1024) return fail("too_large", "Vidéo trop lourde (40 Mo au plus) : filmez plus court.", 413);
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") || "");
  const file = form?.get("video");
  const seconds = Math.max(0, Math.min(600, Math.round(Number(form?.get("seconds") || 0))));
  if (!TOKEN.test(token)) return fail("scan_invalid", "Lien invalide.", 410);
  if (!(file instanceof Blob) || file.size < 20 * 1024 || file.size > MAX_BYTES) return fail("bad_video", "Vidéo absente, trop courte ou trop lourde.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return fail("bad_video", "Format vidéo non reconnu.");

  const hash = await sha256Hex(token);
  const { data: found, error: e1 } = await admin.rpc("scan_lookup", { p_scan_hash: hash });
  if (e1 || !found?.attempt_id) return fail("scan_invalid", "Ce lien n'est plus valable. Rescannez le QR code affiché sur l'ordinateur.", 410);

  const path = `${found.attempt_id}/${Date.now()}-${randomHex(6)}.${kind.ext}`;
  const up = await admin.storage.from("room-scans").upload(path, bytes, { contentType: kind.type });
  if (up.error) { console.error("[scan]", up.error); return fail("server_error", "Envoi impossible, réessayez.", 500); }
  const { error: e2 } = await admin.rpc("scan_complete", { p_scan_hash: hash, p_path: path, p_seconds: seconds, p_ip: clientIp(req) });
  if (e2) {
    await admin.storage.from("room-scans").remove([path]);
    return fail("scan_invalid", "Ce lien n'est plus valable. Rescannez le QR code affiché sur l'ordinateur.", 410);
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
