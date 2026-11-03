import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { bearerLaunch, cors, fail, preflight, rpcFail } from "@/lib/external/http";
import { gradeChoices, isScenario, type Verdict } from "@/lib/external/grade";
import { DEMO_WIN95, demoRecord, isDemoNonce } from "@/lib/demo/external";

/**
 * Choix du candidat dans un exercice noté par la plateforme. La page envoie
 * l'ensemble de ses choix à chaque fois, avec un compteur seq croissant ;
 * completed=true quand le candidat a terminé. La note est calculée ici,
 * avec le corrigé gardé en base.
 */
export const OPTIONS = preflight;

export async function POST(req: NextRequest) {
  const auth = await bearerLaunch(req, "platform");
  if (!auth) return fail(req, 401, "bad_token");
  const text = await req.text();
  if (text.length > 64 * 1024) return fail(req, 413, "too_large");
  let body: { seq?: unknown; answers?: unknown; completed?: unknown; events?: unknown };
  try { body = JSON.parse(text); } catch { return fail(req, 400, "bad_response"); }
  const seq = Number(body.seq);
  if (!Number.isSafeInteger(seq) || seq < 1 || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
    return fail(req, 400, "bad_response");
  }
  if (isDemoNonce(auth.p.n)) {
    const g = gradeChoices(DEMO_WIN95.scenario, DEMO_WIN95.answer_key, body.answers as Record<string, unknown>);
    if (!demoRecord(auth.p.sid, auth.p.n, g.ratio, body.completed === true)) return fail(req, 403, "session_invalid");
    return cors(req, NextResponse.json({ ok: true, completed: body.completed === true, answered: g.details.answered, total: g.max }));
  }
  const admin = adminClient();
  const { data, error } = await admin.rpc("external_session", { p_session: auth.p.sid, p_nonce: auth.p.n });
  if (error) return rpcFail(req, error);
  if (data.tool !== auth.tool.id || !isScenario(data.scenario) || !data.answer_key) return fail(req, 403, "session_invalid");

  const g = gradeChoices(data.scenario, data.answer_key as Record<string, Verdict>, body.answers as Record<string, unknown>);
  const events = Array.isArray(body.events) ? body.events.slice(0, 300) : undefined;
  const { data: r, error: e2 } = await admin.rpc("external_record", {
    p_session: auth.p.sid, p_nonce: auth.p.n, p_tool: auth.tool.id, p_seq: seq,
    p_ratio: g.ratio, p_raw: g.raw, p_max: g.max,
    p_details: { ...g.details, ...(events ? { events } : {}) }, p_completed: body.completed === true,
  });
  if (e2) return rpcFail(req, e2);
  // Le candidat ne reçoit pas sa note : seulement la confirmation d'enregistrement.
  return cors(req, NextResponse.json({ ok: true, completed: !!r?.completed, answered: g.details.answered, total: g.max }));
}
