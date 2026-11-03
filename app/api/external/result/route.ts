import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { toolConfig, verifyResultSignature } from "@/lib/external/server";

/**
 * Résultat envoyé par le SERVEUR d'un outil qui note lui-même (Crime
 * GeoGuess), jamais par un navigateur. Authentifié par HMAC :
 *   X-Cx-Tool, X-Cx-Timestamp (±5 min), X-Cx-Signature
 * Corps : { session_id, nonce, seq, score_ratio (0 à 1), raw_score, raw_max,
 *           details, completed }
 * Le nonce lie l'envoi à la session ; seq strictement croissant empêche de
 * rejouer un ancien envoi.
 */
const CODES: Record<string, number> = { session_invalid: 403, closed: 409, time_over: 409, replay: 409, bad_response: 400 };

function err(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const tool = toolConfig(req.headers.get("x-cx-tool") || "");
  if (!tool || tool.grading !== "tool") return err(401, "unknown_tool");
  const raw = await req.text();
  if (raw.length > 256 * 1024) return err(413, "too_large");
  const ok = await verifyResultSignature(tool, req.headers.get("x-cx-timestamp") || "", (req.headers.get("x-cx-signature") || "").toLowerCase(), raw);
  if (!ok) return err(401, "signature_invalid");
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return err(400, "bad_response"); }
  const seq = Number(b.seq), ratio = Number(b.score_ratio);
  if (typeof b.session_id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.session_id) || typeof b.nonce !== "string" || !Number.isSafeInteger(seq) || seq < 1 || !Number.isFinite(ratio)) {
    return err(400, "bad_response");
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const { data, error } = await adminClient().rpc("external_record", {
    p_session: b.session_id, p_nonce: b.nonce, p_tool: tool.id, p_seq: seq, p_ratio: ratio,
    p_raw: num(b.raw_score), p_max: num(b.raw_max),
    p_details: b.details && typeof b.details === "object" ? b.details : null, p_completed: b.completed === true,
  });
  if (error) {
    const code = (error.message || "").split(":")[0].trim();
    if (!CODES[code]) console.error("[external] result", error);
    return err(CODES[code] || 500, CODES[code] ? code : "server_error");
  }
  return NextResponse.json({ ok: true, completed: !!data?.completed }, { headers: { "Cache-Control": "no-store" } });
}
