import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/security/env";
import { requireStaff } from "@/lib/auth/staff";

/**
 * Bulk-send Supabase invite emails to every pending invite for this test.
 * Body: { only?: string[] }  // optional list of email addresses to send to
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in env. Customize the email contents
 * via Supabase Dashboard → Authentication → Email Templates → Invite User.
 * The template gets access to {{ .Data.test_title }}, {{ .Data.invite_code }},
 * {{ .Data.test_url }}.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server" }, { status: 500 });
  }
  const s = await requireStaff(req, true);
  if ("res" in s) return s.res;

  const { only } = (await req.json().catch(() => ({}))) as { only?: string[] };

  const admin = adminClient();
  const { data: test } = await admin.from("tests").select("title").eq("id", id).single();
  if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

  let q = admin.from("invites").select("*").eq("test_id", id);
  if (only && only.length) q = q.in("email", only.map((e) => e.toLowerCase()));
  const { data: invites } = await q;
  if (!invites?.length) return NextResponse.json({ sent: 0 });

  // Origine fixe (APP_URL) : jamais l'en-tête Host, sinon un lien d'invitation
  // pourrait pointer vers un domaine choisi par l'attaquant.
  const testUrl = `${appUrl()}/test/${id}`;

  const results: { email: string; ok: boolean; error?: string }[] = [];
  for (const inv of invites) {
    const { error } = await admin.auth.admin.inviteUserByEmail(inv.email, {
      redirectTo: testUrl,
      data: {
        test_title: test.title,
        test_url: testUrl,
        invite_code: inv.code,
        full_name: inv.email.split("@")[0],
      },
    });
    if (error && !/already.*registered|exists/i.test(error.message)) {
      results.push({ email: inv.email, ok: false, error: error.message });
    } else {
      results.push({ email: inv.email, ok: true });
    }
  }

  return NextResponse.json({
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
  });
}
