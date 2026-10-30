import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { clientIp, publicUrl, sameOrigin, userAgent } from "@/lib/security/request";
import { mergeKeys, sebRequired, verifySeb } from "@/lib/security/seb";
import { examCookieName, randomHex, sha256Hex } from "@/lib/security/tokens";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ExamCtx = {
  userId: string;
  email: string;
  testId: string;
  attemptId: string | null;
  tokenHash: string | null;
  ip: string | null;
  ua: string;
  admin: ReturnType<typeof adminClient>;
  /** Jeton de requête suivant, à renvoyer au client (en-tête X-Exam-Nonce). */
  nextNonce: string | null;
};

/** Messages renvoyés au candidat (jamais le détail technique). */
const MESSAGES: Record<string, [number, string]> = {
  not_signed_in: [401, "Connexion requise."],
  bad_origin: [403, "Requête refusée."],
  seb_required: [403, "Cet examen doit être passé dans Safe Exam Browser."],
  test_not_found: [404, "Examen introuvable."],
  not_invited: [403, "Vous n'êtes pas sur la liste des candidats de cet examen."],
  attempt_not_found: [404, "Aucune session d'examen trouvée."],
  too_many_attempts: [429, "Trop d'essais. Réessayez dans 10 minutes."],
  locked: [403, "Saisissez d'abord votre code d'accès."],
  identity_required: [403, "Vérification d'identité requise avant de commencer."],
  identity_not_expected: [409, "Vérification d'identité déjà transmise."],
  device_changed: [409, "Changement d'appareil détecté."],
  session_locked: [409, "Cet examen est déjà ouvert sur un autre appareil. Contactez le surveillant."],
  session_invalid: [409, "Session d'examen invalide ou ouverte ailleurs. Contactez le surveillant."],
  session_killed: [409, "Utilisation simultanée de votre session détectée : elle a été coupée. Contactez le surveillant."],
  test_closed: [403, "La période de passage de cet examen est terminée."],
  test_not_open: [403, "Cet examen n'est pas encore ouvert."],
  no_questions: [409, "Cet examen ne contient aucune question."],
  time_over: [409, "Le temps est écoulé."],
  bad_question: [400, "Question invalide."],
  bad_response: [400, "Réponse invalide."],
  unknown_event: [400, "Événement inconnu."],
  bad_path: [400, "Requête invalide."],
  bad_token: [400, "Requête invalide."],
  forbidden: [403, "Accès refusé."],
};

export function examError(code: string): NextResponse {
  const [status, message] = MESSAGES[code] || [500, "Erreur serveur."];
  return NextResponse.json({ error: code, message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Transforme une erreur Postgres levée par nos fonctions en réponse HTTP. */
export function rpcError(err: { message?: string } | null): NextResponse {
  const code = (err?.message || "").split(":")[0].trim();
  if (!MESSAGES[code]) console.error("[exam] rpc error", err);
  return examError(MESSAGES[code] ? code : "server_error");
}

/**
 * Contrôles communs à toutes les routes d'examen :
 *  1. Origine (anti-CSRF) pour les requêtes non-GET
 *  2. Utilisateur authentifié
 *  3. Safe Exam Browser si exigé (vérifié sur CETTE requête, avec les clés du test)
 *  4. Récupération de la tentative et du jeton de session (cookie httpOnly)
 */
export async function examGuard(
  req: NextRequest, testId: string, rotate = false,
): Promise<{ ctx: ExamCtx } | { res: NextResponse }> {
  if (!UUID.test(testId)) return { res: examError("test_not_found") };
  if (req.method !== "GET" && !sameOrigin(req)) return { res: examError("bad_origin") };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { res: examError("not_signed_in") };

  const admin = adminClient();
  const { data: test } = await admin.from("tests").select("id, require_seb, is_published, seb_accept_config_key").eq("id", testId).maybeSingle();
  if (!test || !test.is_published) return { res: examError("test_not_found") };

  if (sebRequired(test.require_seb)) {
    const { data: sec } = await admin.from("test_secrets")
      .select("seb_browser_exam_keys, seb_config_keys").eq("test_id", testId).maybeSingle();
    const keys = mergeKeys({ bek: sec?.seb_browser_exam_keys, ck: sec?.seb_config_keys }, test.seb_accept_config_key);
    const r = await verifySeb(publicUrl(req), req.headers, keys);
    if (!r.ok) {
      if (r.reason === "no_keys_configured") console.error(`[exam] SEB exigé sans clé configurée pour le test ${testId}`);
      return { res: examError("seb_required") };
    }
  }

  const { data: attempt } = await admin.from("attempts").select("id")
    .eq("test_id", testId).eq("candidate_id", user.id).maybeSingle();
  const token = req.cookies.get(examCookieName(testId))?.value || null;
  const tokenHash = token && /^[a-f0-9]{64}$/.test(token) ? await sha256Hex(token) : null;
  const ip = clientIp(req);

  // 5. Jeton de requête tournant (anti-partage de session et anti-rejeu)
  let nextNonce: string | null = null;
  if (rotate) {
    if (!attempt?.id || !tokenHash) return { res: examError("session_invalid") };
    const sent = req.headers.get("x-exam-nonce") || "";
    const candidate = randomHex(32);
    const { data: r, error } = await admin.rpc("exam_rotate_nonce", {
      p_user: user.id, p_attempt: attempt.id, p_token_hash: tokenHash,
      p_nonce_hash: /^[a-f0-9]{64}$/.test(sent) ? await sha256Hex(sent) : null,
      p_next_hash: await sha256Hex(candidate), p_ip: ip,
    });
    if (error) return { res: rpcError(error) };
    if (r === "ok") nextNonce = candidate;
    else if (r !== "closed") return { res: examError(r === "session_killed" ? "session_killed" : "session_invalid") };
  }

  return {
    ctx: {
      userId: user.id, email: user.email || "", testId,
      attemptId: attempt?.id || null, tokenHash, ip, ua: userAgent(req), admin, nextNonce,
    },
  };
}

/** Enveloppe de route d'examen : contrôles communs + renvoi du jeton suivant. */
export function examRoute(
  opts: { rotate: boolean },
  fn: (ctx: ExamCtx, req: NextRequest) => Promise<NextResponse>,
) {
  return async (req: NextRequest, { params }: { params: Promise<{ testId: string }> }) => {
    const { testId } = await params;
    const g = await examGuard(req, testId, opts.rotate);
    if ("res" in g) return g.res;
    let res: NextResponse;
    try { res = await fn(g.ctx, req); }
    catch (e) { console.error("[exam]", e); res = examError("server_error"); }
    if (g.ctx.nextNonce) res.headers.set("X-Exam-Nonce", g.ctx.nextNonce);
    return res;
  };
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers || {}) } });
}

export async function readJson<T = any>(req: NextRequest, maxBytes = 64 * 1024): Promise<T | null> {
  const len = parseInt(req.headers.get("content-length") || "0", 10);
  if (len > maxBytes) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}
