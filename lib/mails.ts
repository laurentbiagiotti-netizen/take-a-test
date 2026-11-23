import type { SupabaseClient } from "@supabase/supabase-js";
import { convocation, eventDescription, rappel, relance, slotEnd } from "@/lib/exam/convocation";
import { appUrl } from "@/lib/security/env";
import { changedEvents, deleteEvent, googleConfigured, loadAccount, sendMail, upsertEvent, type MailAccount } from "@/lib/google";
import { span } from "@/lib/admin/calendar";

const BATCH = 20;            // mails par passage (un passage par minute)
const MAX_TRIES = 3;
const H = 3600 * 1000;
const RELANCE_AFTER = 2 * H;   // deux heures après la fin de l'épreuve ou du créneau
const RELANCE_UNTIL = 48 * H;  // plus de relance au-delà de deux jours

type Kind = "convocation" | "relance" | "rappel_veille" | "rappel_10min";
type Log = { test_id: string; email: string; kind: string; status: string; tries: number };
type Out = { convocations: number; rappels: number; relances: number; events: number; moved: number; failed: number };

/**
 * Passage de la tâche planifiée : convocations, rappels (la veille et dix minutes avant le créneau),
 * relance unique des absents, et agenda (un événement par épreuve datée, ou un par candidat quand
 * l'inscription porte un créneau). Rien n'est rétroactif : seuls les inscrits et les épreuves
 * postérieurs à la connexion du compte sont concernés.
 */
let running = false;
export async function runMailsAndCalendar(admin: SupabaseClient): Promise<Out | null> {
  if (running) return null; // un passage à la fois : jamais deux envois du même mail
  running = true;
  try { return await pass(admin); } finally { running = false; }
}

const firstName = (full?: string | null, email = "") => (full || "").trim().split(/\s+/)[0] || email.split("@")[0].split(/[._]/)[0].replace(/^./, (c) => c.toUpperCase());
const slotHash = (t: any, i: any, end: string) => [t.title, i.email, i.full_name, i.code, i.slot_at, end].join("|");

async function pass(admin: SupabaseClient): Promise<Out | null> {
  if (!googleConfigured()) return null;
  const acc = await loadAccount();
  if (!acc) return null;
  const out: Out = { convocations: 0, rappels: 0, relances: 0, events: 0, moved: 0, failed: 0 };
  const now = Date.now(), since = +new Date(acc.connected_at);

  // 0. Agenda vers plateforme : un événement de candidat déplacé ou supprimé à la main met à jour son créneau
  let broken = false;
  try { out.moved = await syncFromCalendar(admin, acc); } catch (e: any) { out.failed++; await flag(admin, `Agenda : ${String(e?.message || e)}`); broken = /invalid_grant|Invalid Credentials|unauthorized|insufficient/i.test(String(e?.message)); }

  const { data: tests } = await admin.from("tests")
    .select("id, title, formation, campus, room, duration_minutes, opens_at, closes_at, is_published, slots, mail_convocation, mail_relance, calendar_event_id, calendar_hash")
    .eq("is_published", true);
  const live = (tests || []).map((t: any) => ({ ...t, end: t.opens_at ? span(t).end : t.closes_at ? +new Date(t.closes_at) : null }));
  const ids = live.map((t: any) => t.id);
  if (!ids.length || broken) return out;
  const [{ data: invites }, { data: logs }, { data: accs }] = await Promise.all([
    admin.from("invites").select("id, test_id, email, code, full_name, extra_minutes, created_at, slot_at, calendar_event_id, calendar_hash").in("test_id", ids).eq("preview", false),
    admin.from("mail_log").select("test_id, email, kind, status, tries").in("test_id", ids),
    admin.from("student_accommodations").select("email, extra_minutes"),
  ]);
  const extraOf = new Map<string, number>((accs || []).map((a: any) => [a.email, a.extra_minutes]));
  const all = (invites || []).map((i: any) => {
    const extra = Math.max(i.extra_minutes || 0, extraOf.get(i.email) || 0);
    return { ...i, extra, slotEndAt: i.slot_at ? slotEnd(i.slot_at, live.find((t: any) => t.id === i.test_id)?.duration_minutes || 0, extra) : null };
  });
  const logOf = new Map<string, Log>((logs || []).map((l: any) => [`${l.test_id}|${l.email}|${l.kind}`, l]));
  const todo = (testId: string, email: string, kind: Kind) => { const l = logOf.get(`${testId}|${email}|${kind}`); return !l || (l.status === "failed" && l.tries < MAX_TRIES); };
  let budget = BATCH;
  const deliver = async (t: any, email: string, kind: Kind, m: { subject: string; body: string }) => {
    const prev = logOf.get(`${t.id}|${email}|${kind}`);
    let error: string | null = null;
    try { await sendMail(acc, email, m.subject, m.body); } catch (e: any) { error = String(e?.message || e).slice(0, 500); }
    await admin.from("mail_log").upsert({ test_id: t.id, email, kind, status: error ? "failed" : "sent", error, tries: (prev?.tries || 0) + 1, updated_at: new Date().toISOString() }, { onConflict: "test_id,email,kind" });
    budget--;
    if (error) { out.failed++; if (/invalid_grant|Invalid Credentials|unauthorized|insufficient/i.test(error)) { broken = true; await flag(admin, error); } }
    else if (kind === "convocation") out.convocations++; else if (kind === "relance") out.relances++; else out.rappels++;
  };
  const stop = () => budget <= 0 || broken;

  // 1. Rappel dix minutes avant le créneau (prioritaire : il ne peut pas attendre le passage suivant)
  for (const t of live) for (const i of all.filter((x: any) => x.test_id === t.id && x.slot_at)) {
    if (stop()) break;
    const s = +new Date(i.slot_at);
    if (now >= s - 10 * 60000 && now < s + 5 * 60000 && s >= since && todo(t.id, i.email, "rappel_10min"))
      await deliver(t, i.email, "rappel_10min", rappel("10min", { email: i.email, fullName: i.full_name, code: i.code, testTitle: t.title, slotAt: i.slot_at, durationMinutes: t.duration_minutes, extraMinutes: i.extra, origin: appUrl() }));
  }

  // 2. Convocations : inscrits depuis la connexion du compte, épreuve publiée et pas terminée.
  //    Épreuve à créneaux : la convocation attend que le créneau du candidat soit fixé.
  for (const t of live) {
    if (!t.mail_convocation) continue;
    for (const i of all.filter((x: any) => x.test_id === t.id && +new Date(x.created_at) >= since)) {
      if (stop()) break;
      if (t.slots && !i.slot_at) continue;
      const end = i.slotEndAt ? +new Date(i.slotEndAt) : t.end;
      if ((end && end < now) || !todo(t.id, i.email, "convocation")) continue;
      await deliver(t, i.email, "convocation", convocation({ email: i.email, fullName: i.full_name, code: i.code, extraMinutes: i.extra, testTitle: t.title, durationMinutes: t.duration_minutes,
        opensAt: i.slot_at || t.opens_at, closesAt: i.slotEndAt || t.closes_at, origin: appUrl(), testId: t.id }));
    }
  }

  // 3. Rappel de la veille, avec le lien : entre 24 h et 12 h avant le créneau
  for (const t of live) for (const i of all.filter((x: any) => x.test_id === t.id && x.slot_at)) {
    if (stop()) break;
    const s = +new Date(i.slot_at);
    if (now >= s - 24 * H && now <= s - 12 * H && s >= since && todo(t.id, i.email, "rappel_veille"))
      await deliver(t, i.email, "rappel_veille", rappel("veille", { email: i.email, fullName: i.full_name, code: i.code, testTitle: t.title, slotAt: i.slot_at, durationMinutes: t.duration_minutes, extraMinutes: i.extra, origin: appUrl() }));
  }

  // 4. Relance, une seule fois : deux heures après la fin (du créneau, sinon de l'épreuve), pour ceux qui n'ont pas commencé
  for (const t of live) {
    if (stop()) break;
    if (!t.mail_relance) continue;
    const due = all.filter((x: any) => {
      const end = x.slotEndAt ? +new Date(x.slotEndAt) : t.end;
      return x.test_id === t.id && end && end >= since && now >= end + RELANCE_AFTER && now <= end + RELANCE_UNTIL && todo(t.id, x.email, "relance");
    });
    if (!due.length) continue;
    const { data: started } = await admin.from("attempts").select("candidate:profiles(email)").eq("test_id", t.id).neq("status", "pending");
    const came = new Set((started || []).map((a: any) => String(a.candidate?.email || "").toLowerCase()));
    for (const i of due) {
      if (stop()) break;
      if (came.has(i.email.toLowerCase())) continue;
      await deliver(t, i.email, "relance", relance({ email: i.email, fullName: i.full_name, testTitle: t.title, endedAt: i.slotEndAt || new Date(t.end).toISOString() }));
    }
  }

  // 5. Agenda, un événement par candidat qui a un créneau : le candidat est invité, avec son lien et son code
  let calls = 0;
  for (const t of live) for (const i of all.filter((x: any) => x.test_id === t.id)) {
    if (broken || calls >= 15) break;
    try {
      if (!i.slot_at) {
        if (!i.calendar_event_id) continue;
        calls++; await deleteEvent(acc, i.calendar_event_id);
        await admin.from("invites").update({ calendar_event_id: null, calendar_hash: null }).eq("id", i.id);
        continue;
      }
      const hash = slotHash(t, i, i.slotEndAt);
      // Déplacé à la main dans l'agenda : il est déjà à jour, on ne le réécrit pas (pas de second avis au candidat)
      if (i.calendar_hash === "deplace") { await admin.from("invites").update({ calendar_hash: hash }).eq("id", i.id); continue; }
      if (hash === i.calendar_hash || +new Date(i.slotEndAt) < now) continue;
      calls++;
      const id = await upsertEvent(acc, i.calendar_event_id, {
        summary: `Test technique ${firstName(i.full_name, i.email)} <> Cybersup`, location: "À distance",
        description: eventDescription({ code: i.code, testTitle: t.title, durationMinutes: t.duration_minutes, extraMinutes: i.extra, origin: appUrl() }),
        start: new Date(i.slot_at).toISOString(), end: i.slotEndAt, attendee: i.email, reminders: [10], tags: { cx: "creneau", cxInvite: i.id },
      });
      await admin.from("invites").update({ calendar_event_id: id, calendar_hash: hash }).eq("id", i.id);
      out.events++;
    } catch (e: any) { out.failed++; await flag(admin, `Agenda : ${String(e?.message || e)}`); broken = true; }
  }

  // 6. Agenda, un événement par épreuve datée, sauf si ses candidats ont des créneaux individuels (l'événement global est alors retiré)
  for (const t of live) {
    if (broken || calls >= 15) break;
    const individual = t.slots || all.some((x: any) => x.test_id === t.id && x.slot_at);
    try {
      if (individual) {
        if (!t.calendar_event_id) continue;
        calls++; await deleteEvent(acc, t.calendar_event_id, false);
        await admin.from("tests").update({ calendar_event_id: null, calendar_hash: null }).eq("id", t.id);
        continue;
      }
      if (!t.opens_at || !t.end || t.end < now) continue;
      const hash = [t.title, t.formation, t.campus, t.room, t.opens_at, t.end].join("|");
      if (hash === t.calendar_hash) continue;
      calls++;
      const id = await upsertEvent(acc, t.calendar_event_id, {
        summary: `Examen : ${t.title}`, location: [t.room, t.campus].filter(Boolean).join(", "),
        description: [t.formation ? `Promo : ${t.formation}` : "", `Durée : ${t.duration_minutes} min`, `${appUrl()}/admin/tests/${t.id}`].filter(Boolean).join("\n"),
        start: new Date(t.opens_at).toISOString(), end: new Date(t.end).toISOString(),
      });
      await admin.from("tests").update({ calendar_event_id: id, calendar_hash: hash }).eq("id", t.id);
      out.events++;
    } catch (e: any) { out.failed++; await flag(admin, `Agenda : ${String(e?.message || e)}`); broken = true; }
  }
  return out;
}

/**
 * Relit l'agenda : un événement de candidat déplacé change le créneau de son inscription (et ses rappels
 * repartent pour la nouvelle date) ; un événement supprimé retire le créneau.
 */
async function syncFromCalendar(admin: SupabaseClient, acc: MailAccount): Promise<number> {
  const { data: row } = await admin.from("mail_account").select("calendar_synced_at").maybeSingle();
  const started = new Date().toISOString();
  const from = (row as any)?.calendar_synced_at || acc.connected_at;
  const changed = await changedEvents(acc, new Date(+new Date(from) - 60000).toISOString());
  let moved = 0;
  for (const e of changed) {
    if (!e.invite) continue;
    const { data: inv } = await admin.from("invites").select("id, test_id, email, slot_at, calendar_event_id").eq("id", e.invite).maybeSingle();
    if (!inv || (inv as any).calendar_event_id !== e.id) continue;
    const i = inv as any;
    const same = !e.cancelled && e.start && i.slot_at && +new Date(e.start) === +new Date(i.slot_at);
    if (same) continue;
    if (e.cancelled || !e.start) await admin.from("invites").update({ slot_at: null, calendar_event_id: null, calendar_hash: null }).eq("id", i.id);
    else await admin.from("invites").update({ slot_at: new Date(e.start).toISOString(), calendar_hash: "deplace" }).eq("id", i.id);
    for (const kind of ["rappel_veille", "rappel_10min", "relance"]) await admin.from("mail_log").delete().eq("test_id", i.test_id).eq("email", i.email).eq("kind", kind);
    moved++;
  }
  await admin.from("mail_account").update({ calendar_synced_at: started }).eq("id", true);
  return moved;
}

async function flag(admin: SupabaseClient, error: string) {
  await admin.from("mail_account").update({ last_error: error.slice(0, 500), last_error_at: new Date().toISOString() }).eq("id", true);
}

export type { MailAccount };
