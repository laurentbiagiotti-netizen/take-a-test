import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { adminClient } from "@/lib/supabase/admin";
import { googleConfigured, loadAccount, sendMail } from "@/lib/google";
import { convocation, slotEnd } from "@/lib/exam/convocation";
import { appUrl } from "@/lib/security/env";

/** Renvoie tout de suite la convocation d'un candidat, depuis le compte de l'école relié. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff(req, true);
  if ("res" in s) return s.res;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Inscription introuvable." }, { status: 404 });
  const admin = adminClient();
  const { data: i } = await admin.from("invites").select("id, test_id, email, code, full_name, extra_minutes, slot_at, preview").eq("id", id).maybeSingle();
  if (!i || (i as any).preview) return NextResponse.json({ error: "Inscription introuvable." }, { status: 404 });
  const inv = i as any;
  const { data: t } = await admin.from("tests").select("id, title, duration_minutes, opens_at, closes_at").eq("id", inv.test_id).single();
  const acc = googleConfigured() ? await loadAccount() : null;
  if (!acc || !t) return NextResponse.json({ error: "Aucun compte de l'école n'est relié (menu « Mails et agenda »)." }, { status: 409 });
  const m = convocation({ email: inv.email, fullName: inv.full_name, code: inv.code, extraMinutes: inv.extra_minutes, testTitle: t.title, durationMinutes: t.duration_minutes,
    opensAt: inv.slot_at || t.opens_at, closesAt: inv.slot_at ? slotEnd(inv.slot_at, t.duration_minutes, inv.extra_minutes) : t.closes_at, origin: appUrl(), testId: t.id });
  try { await sendMail(acc, inv.email, m.subject, m.body); }
  catch (e: any) { return NextResponse.json({ error: `Envoi refusé : ${String(e?.message || e).slice(0, 200)}` }, { status: 502 }); }
  await admin.from("mail_log").upsert({ test_id: t.id, email: inv.email, kind: "convocation", status: "sent", error: null, tries: 1, updated_at: new Date().toISOString() }, { onConflict: "test_id,email,kind" });
  if (inv.slot_at) await admin.from("invites").update({ slot_notified: inv.slot_at }).eq("id", inv.id);
  return NextResponse.json({ ok: true });
}
