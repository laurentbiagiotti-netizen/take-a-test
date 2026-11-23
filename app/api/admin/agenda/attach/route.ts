import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { adminClient } from "@/lib/supabase/admin";
import { genCode } from "@/lib/security/tokens";

/**
 * Rattache à une épreuve un rendez-vous d'agenda resté sans épreuve (titre sans classe) :
 * son invité est inscrit avec ce créneau, puis convoqué par la tâche planifiée.
 */
export async function POST(req: NextRequest) {
  const s = await requireStaff(req, true);
  if ("res" in s) return s.res;
  const body = await req.json().catch(() => ({}));
  const eventId = String(body.event_id || ""), testId = String(body.test_id || "");
  if (!eventId || !/^[0-9a-f-]{36}$/i.test(testId)) return NextResponse.json({ error: "Demande incomplète." }, { status: 400 });
  const admin = adminClient();
  const [{ data: ev }, { data: t }] = await Promise.all([
    admin.from("agenda_inbox").select("event_id, title, start_at, email").eq("event_id", eventId).maybeSingle(),
    admin.from("tests").select("id, title").eq("id", testId).maybeSingle(),
  ]);
  const e = ev as any;
  if (!e || !t) return NextResponse.json({ error: "Rendez-vous ou épreuve introuvable." }, { status: 404 });
  if (!e.email || !e.start_at) return NextResponse.json({ error: "Ce rendez-vous n'a pas d'invité ou pas d'heure : ajoutez le candidat en invité dans l'agenda." }, { status: 409 });
  // « Test technique Lauryn <> Cybersup » ou « Test technique B3 Cyber - Lauryn » : le prénom
  const title = String(e.title || "");
  const first = (title.includes("<>") ? title.replace(/test technique/i, "").split("<>")[0] : title.split(/\s[-–]\s/).pop() || "").trim().slice(0, 100) || null;
  const patch = { slot_at: e.start_at, calendar_event_id: e.event_id, calendar_hash: "externe" };
  const { data: existing } = await admin.from("invites").select("id").eq("test_id", testId).eq("email", e.email).maybeSingle();
  const { error } = existing
    ? await admin.from("invites").update(patch).eq("id", (existing as any).id)
    : await admin.from("invites").insert({ test_id: testId, email: e.email, code: genCode(), full_name: first, ...patch });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("agenda_inbox").delete().eq("event_id", eventId);
  return NextResponse.json({ ok: true, email: e.email, test: (t as any).title });
}
