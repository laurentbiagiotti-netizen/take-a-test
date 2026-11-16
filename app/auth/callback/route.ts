import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/security/redirect";
import { appUrl } from "@/lib/security/env";

/** Retour de Google (SSO) : échange du code puis contrôle que le compte est bien un compte de l'équipe. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const base = appUrl();
  const next = safeNextPath(url.searchParams.get("next"), "/admin");
  const back = (code: string, detail?: string) => {
    const u = new URL(`/login?error=${code}`, base);
    if (detail) u.searchParams.set("detail", detail.replace(/[^\p{L}\p{N} .,:'()_-]/gu, " ").slice(0, 160));
    return NextResponse.redirect(u);
  };

  if (url.searchParams.get("error")) {
    const d = url.searchParams.get("error_description") || "";
    if (/sso_non_autorise|Database error/i.test(d)) return back("non_autorise");
    console.error("[sso] retour Google en erreur :", url.searchParams.get("error"), d);
    return back("google", `${url.searchParams.get("error")}: ${d}`);
  }
  const code = url.searchParams.get("code");
  if (!code) return back("google", "aucun code reçu");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) { console.error("[sso] échange du code :", error.message); return back("google", error.message); }

  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  if (!user || !prof || !["admin", "proctor"].includes(prof.role)) {
    await supabase.auth.signOut();
    return back("non_autorise");
  }
  return NextResponse.redirect(new URL(next, base));
}
