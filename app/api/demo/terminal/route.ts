import { NextRequest, NextResponse } from "next/server";
import { evaluateObjectives, initState, promptFor, runShell } from "@/lib/terminal/shell";
import { DEMO_SCENARIO } from "@/lib/terminal/demo";
import { getDemoState, resetDemoState, setDemoState } from "@/lib/terminal/demo-sessions";
import { clientIp, sameOrigin } from "@/lib/security/request";
import { hit } from "@/lib/security/ratelimit";
import { randomHex } from "@/lib/security/tokens";

const COOKIE = "cx_demo";

/** Terminal de la démo publique : une machine par visiteur, en mémoire. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  if (!hit(`demo-term:${clientIp(req)}`, 90, 60_000)) return NextResponse.json({ error: "rate_limited", output: "Trop de commandes, patientez une minute." }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.command !== "string" || body.command.length > 500) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  let sid = req.cookies.get(COOKIE)?.value;
  if (!sid || !/^[a-f0-9]{32}$/.test(sid)) sid = randomHex(16);
  if (body.reset) resetDemoState(sid);
  const r = runShell(DEMO_SCENARIO, getDemoState(sid), body.reset ? "" : body.command);
  if (!setDemoState(sid, r.state)) resetDemoState(sid);
  const res = NextResponse.json({
    output: r.output, prompt: promptFor(DEMO_SCENARIO, r.state.cwd), clear: !!r.clear,
    objectives: evaluateObjectives(DEMO_SCENARIO, r.state),
  }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(COOKIE, sid, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/api/demo", maxAge: 7200 });
  return res;
}

export async function GET() {
  const st = initState(DEMO_SCENARIO);
  return NextResponse.json({ prompt: promptFor(DEMO_SCENARIO, st.cwd), motd: DEMO_SCENARIO.motd, objectives: evaluateObjectives(DEMO_SCENARIO, st) });
}
