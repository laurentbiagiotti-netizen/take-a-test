import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { adminClient } from "@/lib/supabase/admin";
import { GOOGLE_SCOPES, TOKEN_AAD, googleConfigured, mailDomain, redirectUri, tokenRequest } from "@/lib/google";
import { seal } from "@/lib/security/secretbox";
import { timingSafeEqual } from "@/lib/security/tokens";
import { appUrl } from "@/lib/security/env";

/** Retour de Google : vérifie l'état, le domaine du compte et les autorisations, puis garde le jeton chiffré. */
export async function GET(req: NextRequest) {
  const back = (q: string) => { const r = NextResponse.redirect(`${appUrl()}/admin/mails?${q}`); r.cookies.delete({ name: "cx_google_state", path: "/api/admin/google" }); return r; };
  const s = await requireStaff(req, true);
  if ("res" in s) return s.res;
  if (!googleConfigured()) return back("erreur=config");
  const p = req.nextUrl.searchParams;
  const state = req.cookies.get("cx_google_state")?.value || "";
  if (p.get("error")) return back("erreur=refus");
  if (!state || !timingSafeEqual(state, p.get("state") || "") || !p.get("code")) return back("erreur=etat");
  try {
    const tok = await tokenRequest({ grant_type: "authorization_code", code: p.get("code")!, redirect_uri: redirectUri() });
    const granted = String(tok.scope || "").split(" ");
    if (!tok.refresh_token || !GOOGLE_SCOPES.slice(2).every((x) => granted.includes(x))) return back("erreur=droits");
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
    const email = String(info.email || "").toLowerCase();
    if (!info.email_verified || !email.endsWith(`@${mailDomain()}`)) return back("erreur=domaine");
    const { error } = await adminClient().from("mail_account").upsert({
      id: true, email, token_sealed: await seal(tok.refresh_token, TOKEN_AAD), calendar_id: "primary",
      connected_by: s.userId, connected_at: new Date().toISOString(), last_error: null, last_error_at: null,
    });
    if (error) return back("erreur=base");
    return back("ok=1");
  } catch { return back("erreur=google"); }
}
