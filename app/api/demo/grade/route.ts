import { NextRequest, NextResponse } from "next/server";
import { DEMO_QUESTIONS } from "@/lib/demo/questions";
import { DEMO_FLAG } from "@/lib/terminal/demo";
import { grade } from "@/lib/questions/kinds";
import { clientIp, sameOrigin } from "@/lib/security/request";
import { hit } from "@/lib/security/ratelimit";

/** Correction de l'épreuve d'essai (les clés restent sur le serveur). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  if (!hit(`demo-grade:${clientIp(req)}`, 20, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const body = await req.json().catch(() => null);
  const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};
  const results = DEMO_QUESTIONS.map((q) => ({ id: q.id, score: grade(q.type, q.points, answers[q.id], q.key), points: q.points }));
  const flagOk = typeof body?.flag === "string" && body.flag.trim() === DEMO_FLAG;
  return NextResponse.json({ results, flag: flagOk });
}
