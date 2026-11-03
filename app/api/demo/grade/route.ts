import { NextRequest, NextResponse } from "next/server";
import { DEMO_QUESTIONS, DEMO_TOOL_QUESTIONS } from "@/lib/demo/questions";
import { demoGet } from "@/lib/demo/external";
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
  // Exercices dans les outils : note gardée en mémoire par la session d'essai
  for (const q of DEMO_TOOL_QUESTIONS) {
    const sid = answers[q.id]?.sid;
    if (!sid) continue;
    const s = demoGet(sid);
    results.splice(1, 0, { id: q.id, score: s && s.tool === q.external.tool ? Math.round(q.points * s.ratio * 100) / 100 : 0, points: q.points });
  }
  const flagOk = typeof body?.flag === "string" && body.flag.trim() === DEMO_FLAG;
  return NextResponse.json({ results, flag: flagOk });
}
