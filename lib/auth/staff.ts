import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/security/request";

/**
 * Vérifie que l'appelant est surveillant ou admin, authentifié en double
 * facteur (TOTP, niveau aal2), et anti-CSRF pour les requêtes non-GET.
 */
export async function requireStaff(req: NextRequest, adminOnly = false):
  Promise<{ userId: string; role: "admin" | "proctor" } | { res: NextResponse }> {
  if (req.method !== "GET" && !sameOrigin(req)) return { res: NextResponse.json({ error: "bad_origin" }, { status: 403 }) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { res: NextResponse.json({ error: "not_signed_in" }, { status: 401 }) };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return { res: NextResponse.json({ error: "mfa_required", message: "Double authentification requise" }, { status: 401 }) };
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const ok = adminOnly ? p?.role === "admin" : p?.role === "admin" || p?.role === "proctor";
  if (!ok) return { res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { userId: user.id, role: p!.role };
}

/** Variante pour les pages serveur : renvoie le rôle ou l'URL de redirection. */
export async function staffPageGuard(): Promise<{ role: "admin" | "proctor"; userId: string } | { redirect: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login?next=/admin" };
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin" && p?.role !== "proctor") return { redirect: "/dashboard" };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return { redirect: "/mfa" };
  return { role: p.role, userId: user.id };
}
