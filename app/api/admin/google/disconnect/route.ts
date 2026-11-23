import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { adminClient } from "@/lib/supabase/admin";
import { TOKEN_AAD, loadAccount } from "@/lib/google";
import { open } from "@/lib/security/secretbox";

/** Débranche le compte : révoque l'autorisation chez Google et efface le jeton. Plus aucun mail ne part. */
export async function POST(req: NextRequest) {
  const s = await requireStaff(req, true);
  if ("res" in s) return s.res;
  const acc = await loadAccount();
  if (acc) {
    try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(await open(acc.token_sealed, TOKEN_AAD))}`, { method: "POST" }); } catch {}
    await adminClient().from("mail_account").delete().eq("id", true);
  }
  return NextResponse.json({ ok: true });
}
