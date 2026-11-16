import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/security/redirect";
import { appUrl } from "@/lib/security/env";

/** Retour de Google (SSO) : échange du code puis contrôle que le compte est bien un compte de l'équipe. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const base = appUrl();
  const next = safeNextPath(url.searchParams.get("next"), "/admin");
  const back = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, base));

  if (url.searchParams.get("error")) {
    const d = url.searchParams.get("error_description") || "";
    return back(/sso_non_autorise|Database error/i.test(d) ? "non_autorise" : "google");
  }
  const code = url.searchParams.get("code");
  if (!code) return back("google");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return back("google");

  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  if (!user || !prof || !["admin", "proctor"].includes(prof.role)) {
    await supabase.auth.signOut();
    return back("non_autorise");
  }
  return NextResponse.redirect(new URL(next, base));
}
