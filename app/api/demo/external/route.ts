import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/security/env";
import { clientIp, sameOrigin } from "@/lib/security/request";
import { hit } from "@/lib/security/ratelimit";
import { randomHex } from "@/lib/security/tokens";
import { signLaunch, toolConfig } from "@/lib/external/server";
import { DEMO_TIME_S, demoOpen } from "@/lib/demo/external";

/** Ouvre un exercice d'essai dans un outil (rien n'est enregistré en base). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
  if (!hit(`demo-ext:${clientIp(req) || "?"}`, 12, 10 * 60_000)) return NextResponse.json({ error: "Trop d'essais, réessayez dans quelques minutes." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { tool?: unknown } | null;
  const id = typeof body?.tool === "string" ? body.tool : "";
  const tool = DEMO_TIME_S[id] ? toolConfig(id) : null;
  if (!tool) return NextResponse.json({ unavailable: true, error: "Exercice indisponible pour le moment." }, { status: 503 });

  const sid = crypto.randomUUID(), n = `demo.${randomHex(16)}`, ttl = DEMO_TIME_S[id];
  const now = Math.floor(Date.now() / 1000), exp = now + ttl;
  demoOpen(sid, id, n, ttl);
  const scn = tool.grading === "tool" ? { count: 1, difficulty: "easy" } : undefined;
  const token = await signLaunch({ v: 1, aud: id, sid, n, iat: now, exp, api: appUrl(), ...(scn ? { scn } : {}) }, tool.secret);
  return NextResponse.json({
    url: `${tool.url}${tool.path}#t=${token}`, origin: tool.origin,
    deadline_at: new Date(exp * 1000).toISOString(), sid,
  }, { headers: { "Cache-Control": "no-store" } });
}
