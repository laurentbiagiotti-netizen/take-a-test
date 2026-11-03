import { NextRequest, NextResponse } from "next/server";
import { toolConfig, toolOrigins, peekAudience, verifyLaunch, type LaunchPayload, type ToolConfig } from "./server";

/** En-têtes CORS : seules les pages d'examen des outils déclarés peuvent appeler. */
export function cors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get("origin");
  if (origin && toolOrigins().includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.headers.set("Access-Control-Max-Age", "600");
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function preflight(req: NextRequest) {
  return cors(req, new NextResponse(null, { status: 204 }));
}

export function fail(req: NextRequest, status: number, error: string) {
  return cors(req, NextResponse.json({ error }, { status }));
}

const STATUS: Record<string, number> = { session_invalid: 403, closed: 409, time_over: 409, replay: 409, bad_response: 400 };

export function rpcFail(req: NextRequest, err: { message?: string }) {
  const code = (err.message || "").split(":")[0].trim();
  if (!STATUS[code]) console.error("[external] rpc", err);
  return fail(req, STATUS[code] || 500, STATUS[code] ? code : "server_error");
}

/** Jeton de lancement lu dans « Authorization: Bearer … » et vérifié. */
export async function bearerLaunch(req: NextRequest, grading?: "tool" | "platform"): Promise<{ p: LaunchPayload; tool: ToolConfig } | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
  if (!m) return null;
  const aud = peekAudience(m[1]);
  const tool = aud ? toolConfig(aud) : null;
  if (!tool || (grading && tool.grading !== grading)) return null;
  const p = await verifyLaunch(m[1], tool);
  return p ? { p, tool } : null;
}
