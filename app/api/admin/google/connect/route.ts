import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { GOOGLE_SCOPES, googleConfigured, mailDomain, redirectUri } from "@/lib/google";
import { randomHex } from "@/lib/security/tokens";
import { appUrl } from "@/lib/security/env";

/** Lance la connexion du compte Google de l'école : c'est son titulaire qui donne son accord chez Google. */
export async function GET(req: NextRequest) {
  const s = await requireStaff(req, true);
  if ("res" in s) return s.res;
  if (!googleConfigured()) return NextResponse.redirect(`${appUrl()}/admin/mails?erreur=config`);
  const state = randomHex(24);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!, redirect_uri: redirectUri(), response_type: "code", scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline", prompt: "consent select_account", include_granted_scopes: "false", hd: mailDomain(), state,
  }).toString();
  const res = NextResponse.redirect(url.toString());
  res.cookies.set("cx_google_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/admin/google", maxAge: 600 });
  return res;
}
