import { NextRequest, NextResponse } from "next/server";
import { runShell, promptFor } from "@/lib/terminal/shell";
import { DEMO_SCENARIO } from "@/lib/terminal/demo";
import { clientIp, sameOrigin } from "@/lib/security/request";
import { hit } from "@/lib/security/ratelimit";

/** Terminal de la démo publique (aucun compte, aucune donnée stockée). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  if (!hit(`demo-term:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: "rate_limited", output: "Trop de commandes, patientez une minute." }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.command !== "string" || body.command.length > 500) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const r = runShell(DEMO_SCENARIO, String(body.cwd || ""), body.command);
  return NextResponse.json({ output: r.output, cwd: r.cwd, prompt: promptFor(DEMO_SCENARIO, r.cwd), clear: !!r.clear }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const cwd = DEMO_SCENARIO.home!;
  return NextResponse.json({ cwd, prompt: promptFor(DEMO_SCENARIO, cwd), motd: DEMO_SCENARIO.motd });
}
