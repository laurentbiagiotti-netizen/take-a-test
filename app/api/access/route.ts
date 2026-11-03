import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { clientIp, sameOrigin } from "@/lib/security/request";
import { hit } from "@/lib/security/ratelimit";
import { ensureUser, openSession } from "@/lib/auth/session";

/**
 * Entrée d'un candidat avec le code de sa convocation : pas de compte à créer.
 * Le code identifie l'invitation (épreuve et adresse) ; le serveur ouvre une
 * session pour ce candidat et déverrouille l'épreuve avec ce même code.
 */
const fail = (status: number, message: string) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "Requête refusée.");
  const ip = clientIp(req);
  if (!hit(`access:${ip || "?"}`, 20, 10 * 60_000)) return fail(429, "Trop d'essais. Réessayez dans 10 minutes.");
  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.slice(0, 64) : "";
  if (!code.trim()) return fail(400, "Saisissez votre code.");

  const admin = adminClient();
  const { data, error } = await admin.rpc("access_by_code", { p_code: code, p_ip: ip });
  if (error) {
    if ((error.message || "").startsWith("too_many_attempts")) return fail(429, "Trop d'essais. Réessayez dans 10 minutes.");
    return fail(500, "Erreur serveur, réessayez.");
  }
  if (!data?.ok) return fail(400, "Code inconnu. Vérifiez-le dans votre convocation (les tirets sont facultatifs).");

  // Un compte de l'équipe ne s'ouvre jamais par un code candidat
  const { data: prof } = await admin.from("profiles").select("role").eq("email", data.email).maybeSingle();
  if (prof && prof.role !== "candidate") return fail(403, "Ce code est rattaché à un compte de l'équipe : connectez-vous depuis l'espace équipe.");

  const userId = await ensureUser(data.email, data.full_name);
  if (!userId) return fail(500, "Impossible d'ouvrir votre accès, réessayez.");

  const res = NextResponse.json({ redirect: `/test/${data.test_id}` });
  if (!(await openSession(req, res, data.email))) return fail(500, "Impossible d'ouvrir votre accès, réessayez.");

  // Épreuve déverrouillée avec le même code (journal et limites inchangés)
  const { data: st } = await admin.rpc("exam_prepare", { p_user: userId, p_test: data.test_id });
  if (st?.attempt_id && !st.unlocked) {
    await admin.rpc("exam_unlock", { p_user: userId, p_test: data.test_id, p_code: data.code, p_ip: ip });
  }
  return res;
}
