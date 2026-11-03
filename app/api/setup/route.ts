import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { clientIp, sameOrigin } from "@/lib/security/request";
import { hit } from "@/lib/security/ratelimit";
import { timingSafeEqual } from "@/lib/security/tokens";
import { ensureUser } from "@/lib/auth/session";

/**
 * Création du premier compte administrateur, protégée par STAFF_SETUP_TOKEN
 * (configuration du serveur). Fermée dès qu'un administrateur existe.
 */
const fail = (status: number, message: string) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "Requête refusée.");
  if (!hit(`setup:${clientIp(req) || "?"}`, 5, 10 * 60_000)) return fail(429, "Trop d'essais. Réessayez dans 10 minutes.");
  const secret = process.env.STAFF_SETUP_TOKEN || "";
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (k: string, max: number) => (typeof b?.[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const token = str("token", 200), email = str("email", 200).toLowerCase(), fullName = str("full_name", 200);
  const password = typeof b?.password === "string" ? (b.password as string).slice(0, 200) : "";
  if (secret.length < 32 || !timingSafeEqual(token, secret)) return fail(403, "Code d'installation incorrect.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, "Adresse e-mail invalide.");
  if (password.length < 12) return fail(400, "Mot de passe : 12 caractères minimum.");

  const admin = adminClient();
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if ((count || 0) > 0) return fail(409, "Un administrateur existe déjà.");

  const userId = await ensureUser(email, fullName || null, password);
  if (!userId) return fail(500, "Création du compte impossible.");
  const { data: ok } = await admin.rpc("staff_bootstrap", { p_user: userId });
  if (!ok) return fail(409, "Un administrateur existe déjà.");
  return NextResponse.json({ ok: true });
}
