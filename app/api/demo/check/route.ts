import { NextRequest, NextResponse } from "next/server";
import { DEMO_FLAGS } from "@/lib/terminal/demo";
import { clientIp, sameOrigin } from "@/lib/security/request";
import { hit } from "@/lib/security/ratelimit";
import { timingSafeEqual } from "@/lib/security/tokens";

/** Vérifie un flag de la démo (les flags ne sont jamais envoyés au navigateur). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  if (!hit(`demo-check:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ ok: false, message: "Trop d'essais, patientez une minute." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const expected = DEMO_FLAGS[String(body?.challenge || "")];
  const got = String(body?.flag || "").trim().slice(0, 200);
  return NextResponse.json({ ok: !!expected && timingSafeEqual(got, expected) });
}
