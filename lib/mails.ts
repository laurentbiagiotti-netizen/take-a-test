import type { SupabaseClient } from "@supabase/supabase-js";
import { convocation, relance } from "@/lib/exam/convocation";
import { appUrl } from "@/lib/security/env";
import { googleConfigured, loadAccount, sendMail, upsertEvent, type MailAccount } from "@/lib/google";
import { span } from "@/lib/admin/calendar";

const BATCH = 20;            // mails par passage (un passage par minute)
const MAX_TRIES = 3;
const RELANCE_AFTER = 2 * 3600 * 1000;   // deux heures après la fin de l'épreuve
const RELANCE_UNTIL = 48 * 3600 * 1000;  // plus de relance au-delà de deux jours

type Log = { test_id: string; email: string; kind: string; status: string; tries: number };

/**
 * Passage de la tâche planifiée : convocations des nouveaux inscrits, relance unique des absents,
 * et agenda. Rien n'est rétroactif : seuls les inscrits et les épreuves postérieurs à la
 * connexion du compte sont concernés.
 */
let running = false;
export async function runMailsAndCalendar(admin: SupabaseClient): Promise<{ convocations: number; relances: number; events: number; failed: number } | null> {
  if (running) return null; // un passage à la fois : jamais deux envois du même mail
  running = true;
  try { return await pass(admin); } finally { running = false; }
}

async function pass(admin: SupabaseClient): Promise<{ convocations: number; relances: number; events: number; failed: number } | null> {
  if (!googleConfigured()) return null;
  const acc = await loadAccount();
  if (!acc) return null;
  const out = { convocations: 0, relances: 0, events: 0, failed: 0 };
  const now = Date.now(), since = +new Date(acc.connected_at);
  const { data: tests } = await admin.from("tests")
    .select("id, title, formation, campus, room, duration_minutes, opens_at, closes_at, is_published, mail_convocation, mail_relance, calendar_event_id, calendar_hash")
    .eq("is_published", true);
  const live = (tests || []).map((t: any) => ({ ...t, end: t.opens_at ? span(t).end : t.closes_at ? +new Date(t.closes_at) : null }));
  const ids = live.map((t: any) => t.id);
  if (!ids.length) return out;
  const [{ data: invites }, { data: logs }] = await Promise.all([
    admin.from("invites").select("test_id, email, code, full_name, extra_minutes, created_at").in("test_id", ids).eq("preview", false),
    admin.from("mail_log").select("test_id, email, kind, status, tries").in("test_id", ids),
  ]);
  const logOf = new Map<string, Log>((logs || []).map((l: any) => [`${l.test_id}|${l.email}|${l.kind}`, l]));
  const todo = (testId: string, email: string, kind: string) => { const l = logOf.get(`${testId}|${email}|${kind}`); return !l || (l.status === "failed" && l.tries < MAX_TRIES); };
  let budget = BATCH;
  let broken = false;
  const deliver = async (t: any, email: string, kind: "convocation" | "relance", m: { subject: string; body: string }) => {
    const prev = logOf.get(`${t.id}|${email}|${kind}`);
    let error: string | null = null;
    try { await sendMail(acc, email, m.subject, m.body); } catch (e: any) { error = String(e?.message || e).slice(0, 500); }
    await admin.from("mail_log").upsert({ test_id: t.id, email, kind, status: error ? "failed" : "sent", error, tries: (prev?.tries || 0) + 1, updated_at: new Date().toISOString() }, { onConflict: "test_id,email,kind" });
    budget--;
    if (error) { out.failed++; if (/invalid_grant|Invalid Credentials|unauthorized|insufficient/i.test(error)) { broken = true; await flag(admin, error); } }
    else if (kind === "convocation") out.convocations++; else out.relances++;
  };

  // 1. Convocations : inscrits depuis la connexion du compte, épreuve publiée et pas encore terminée
  for (const t of live) {
    if (!t.mail_convocation || (t.end && t.end < now)) continue;
    for (const i of (invites || []).filter((x: any) => x.test_id === t.id && +new Date(x.created_at) >= since)) {
      if (budget <= 0 || broken) break;
      if (!todo(t.id, i.email, "convocation")) continue;
      await deliver(t, i.email, "convocation", convocation({ email: i.email, fullName: i.full_name, code: i.code, extraMinutes: i.extra_minutes,
        testTitle: t.title, durationMinutes: t.duration_minutes, opensAt: t.opens_at, closesAt: t.closes_at, origin: appUrl(), testId: t.id }));
    }
  }

  // 2. Relance, une seule fois : deux heures après la fin, pour les inscrits qui n'ont pas commencé l'épreuve
  for (const t of live) {
    if (budget <= 0 || broken) break;
    if (!t.mail_relance || !t.end || t.end < since || now < t.end + RELANCE_AFTER || now > t.end + RELANCE_UNTIL) continue;
    const pending = (invites || []).filter((x: any) => x.test_id === t.id && todo(t.id, x.email, "relance"));
    if (!pending.length) continue;
    const { data: started } = await admin.from("attempts").select("candidate:profiles(email)").eq("test_id", t.id).neq("status", "pending");
    const came = new Set((started || []).map((a: any) => String(a.candidate?.email || "").toLowerCase()));
    for (const i of pending) {
      if (budget <= 0 || broken) break;
      if (came.has(i.email.toLowerCase())) continue;
      await deliver(t, i.email, "relance", relance({ email: i.email, fullName: i.full_name, testTitle: t.title, endedAt: new Date(t.end).toISOString() }));
    }
  }

  // 3. Agenda : un événement par épreuve datée à venir, mis à jour quand la date, la salle ou le titre change
  for (const t of live) {
    if (broken || !t.opens_at || !t.end || t.end < now) continue;
    const hash = [t.title, t.formation, t.campus, t.room, t.opens_at, t.end].join("|");
    if (hash === t.calendar_hash) continue;
    try {
      const id = await upsertEvent(acc, t.calendar_event_id, {
        summary: `Examen : ${t.title}`, location: [t.room, t.campus].filter(Boolean).join(", "),
        description: [t.formation ? `Promo : ${t.formation}` : "", `Durée : ${t.duration_minutes} min`, `${appUrl()}/admin/tests/${t.id}`].filter(Boolean).join("\n"),
        start: new Date(t.opens_at).toISOString(), end: new Date(t.end).toISOString(),
      });
      await admin.from("tests").update({ calendar_event_id: id, calendar_hash: hash }).eq("id", t.id);
      out.events++;
    } catch (e: any) { out.failed++; await flag(admin, `Agenda : ${String(e?.message || e)}`); break; }
  }
  return out;
}

async function flag(admin: SupabaseClient, error: string) {
  await admin.from("mail_account").update({ last_error: error.slice(0, 500), last_error_at: new Date().toISOString() }).eq("id", true);
}

export type { MailAccount };
