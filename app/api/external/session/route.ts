import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { bearerLaunch, cors, fail, preflight, rpcFail } from "@/lib/external/http";
import { isScenario, publicScenario } from "@/lib/external/grade";
import { DEMO_WIN95, demoGet, isDemoNonce } from "@/lib/demo/external";

/**
 * Contenu d'un exercice noté par la plateforme (Cybersup OS) : la page de
 * l'outil l'appelle avec son jeton de lancement. Le corrigé n'en sort jamais,
 * et les champs qui pourraient le trahir sont retirés du contenu.
 */
export const OPTIONS = preflight;

export async function GET(req: NextRequest) {
  const auth = await bearerLaunch(req, "platform");
  if (!auth) return fail(req, 401, "bad_token");
  // Épreuve d'essai : contenu fixe, rien en base
  if (isDemoNonce(auth.p.n)) {
    const s = demoGet(auth.p.sid, auth.p.n);
    if (!s || s.tool !== auth.tool.id) return fail(req, 403, "session_invalid");
    return cors(req, NextResponse.json({
      scenario: publicScenario(DEMO_WIN95.scenario), deadline_at: new Date(auth.p.exp * 1000).toISOString(),
      open: Date.now() / 1000 < auth.p.exp, completed: s.completed, last_seq: 0,
    }));
  }
  const { data, error } = await adminClient().rpc("external_session", { p_session: auth.p.sid, p_nonce: auth.p.n });
  if (error) return rpcFail(req, error);
  if (data.tool !== auth.tool.id || !isScenario(data.scenario)) return fail(req, 403, "session_invalid");
  return cors(req, NextResponse.json({
    scenario: publicScenario(data.scenario), deadline_at: data.deadline_at,
    open: !!data.open, completed: !!data.completed, last_seq: data.last_seq,
  }));
}
