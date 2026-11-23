import { adminClient } from "@/lib/supabase/admin";
import { open } from "@/lib/security/secretbox";
import { appUrl } from "@/lib/security/env";

/**
 * Compte Google de l'école relié à la plateforme (serveur uniquement) :
 * envoi de mails par l'API Gmail et événements dans son agenda.
 * Le jeton de rafraîchissement est chiffré en base ; rien n'est exposé au navigateur.
 */
export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/calendar.events"];
export const mailDomain = () => (process.env.MAIL_ACCOUNT_DOMAIN || "cybersup.ai").toLowerCase();
export const googleConfigured = () => !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.API_SECRETS_KEY);
export const redirectUri = () => `${appUrl()}/api/admin/google/callback`;
export const TOKEN_AAD = "mail_account";

export type MailAccount = { email: string; token_sealed: string; calendar_id: string; connected_at: string };

export async function loadAccount(): Promise<MailAccount | null> {
  const { data } = await adminClient().from("mail_account").select("email, token_sealed, calendar_id, connected_at").maybeSingle();
  return (data as MailAccount) || null;
}

export async function tokenRequest(params: Record<string, string>): Promise<any> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!, ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.error || `Google ${r.status}`);
  return j;
}

let cached: { token: string; exp: number; for: string } | null = null;
export async function accessToken(acc: MailAccount): Promise<string> {
  if (cached && cached.for === acc.token_sealed && cached.exp > Date.now() + 60000) return cached.token;
  const j = await tokenRequest({ grant_type: "refresh_token", refresh_token: await open(acc.token_sealed, TOKEN_AAD) });
  cached = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3000) * 1000, for: acc.token_sealed };
  return cached.token;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const VALID_TO = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

/** Envoie un mail texte depuis le compte relié. Lève une erreur si Google refuse. */
export async function sendMail(acc: MailAccount, to: string, subject: string, body: string): Promise<void> {
  if (!VALID_TO.test(to) || to.length > 320) throw new Error("adresse invalide");
  const raw = [
    `To: ${to}`, `Subject: =?UTF-8?B?${b64(subject.replace(/[\r\n]+/g, " ").slice(0, 200))}?=`, "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(body).replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { authorization: `Bearer ${await accessToken(acc)}`, "content-type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(raw, "utf8").toString("base64url") }),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j?.error?.message || `Gmail ${r.status}`); }
}

export type CalEvent = { summary: string; description: string; location: string; start: string; end: string;
  /** Invité (le candidat) : Google lui envoie l'invitation et ses mises à jour. */
  attendee?: string;
  /** Rappels en minutes avant le début (fenêtre surgissante), sinon ceux par défaut de l'agenda. */
  reminders?: number[];
  /** Étiquettes privées, pour retrouver l'inscription quand l'événement est déplacé dans l'agenda. */
  tags?: Record<string, string> };

const calBase = (acc: MailAccount) => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(acc.calendar_id || "primary")}/events`;

/** Crée ou met à jour un événement dans l'agenda du compte. Renvoie son identifiant. */
export async function upsertEvent(acc: MailAccount, eventId: string | null, e: CalEvent): Promise<string> {
  const token = await accessToken(acc);
  const payload: any = { summary: e.summary, description: e.description, location: e.location,
    start: { dateTime: e.start, timeZone: "Europe/Paris" }, end: { dateTime: e.end, timeZone: "Europe/Paris" } };
  if (e.attendee) { payload.attendees = [{ email: e.attendee }]; payload.guestsCanInviteOthers = false; payload.guestsCanSeeOtherGuests = false; }
  if (e.reminders) payload.reminders = { useDefault: false, overrides: e.reminders.map((m) => ({ method: "popup", minutes: m })) };
  if (e.tags) payload.extendedProperties = { private: e.tags };
  const q = e.attendee ? "?sendUpdates=all" : "";
  const call = (url: string, method: string) => fetch(url + q, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
  let r = eventId ? await call(`${calBase(acc)}/${encodeURIComponent(eventId)}`, "PATCH") : await call(calBase(acc), "POST");
  if (eventId && (r.status === 404 || r.status === 410)) r = await call(calBase(acc), "POST");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Agenda ${r.status}`);
  return j.id;
}

/** Supprime un événement (l'invité est prévenu). Un événement déjà supprimé n'est pas une erreur. */
export async function deleteEvent(acc: MailAccount, eventId: string, notify = true): Promise<void> {
  const r = await fetch(`${calBase(acc)}/${encodeURIComponent(eventId)}${notify ? "?sendUpdates=all" : ""}`, { method: "DELETE", headers: { authorization: `Bearer ${await accessToken(acc)}` } });
  if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`Agenda ${r.status}`);
}

export type ChangedEvent = { id: string; cancelled: boolean; start: string | null; title: string;
  /** Inscription liée, quand l'événement a été créé par la plateforme. */
  invite: string;
  /** Invités autres que le compte relié (le candidat). */
  guests: { email: string; name: string }[] };

/**
 * Événements de l'agenda modifiés depuis une date (créés, déplacés ou supprimés), ou, sans date
 * (premier passage), les événements à venir sur 90 jours.
 */
export async function changedEvents(acc: MailAccount, since: string | null): Promise<ChangedEvent[]> {
  const out: ChangedEvent[] = [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ showDeleted: "true", singleEvents: "true", maxResults: "250" });
    if (since) q.set("updatedMin", since);
    else { q.set("timeMin", new Date().toISOString()); q.set("timeMax", new Date(Date.now() + 90 * 86400000).toISOString()); }
    if (pageToken) q.set("pageToken", pageToken);
    const r = await fetch(`${calBase(acc)}?${q}`, { headers: { authorization: `Bearer ${await accessToken(acc)}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || `Agenda ${r.status}`);
    for (const e of j.items || []) out.push({
      id: e.id, cancelled: e.status === "cancelled", start: e.start?.dateTime || null, title: String(e.summary || ""),
      invite: e.extendedProperties?.private?.cxInvite || "",
      guests: (e.attendees || []).filter((a: any) => a.email && !a.self && !a.resource && String(a.email).toLowerCase() !== acc.email.toLowerCase())
        .map((a: any) => ({ email: String(a.email).toLowerCase(), name: String(a.displayName || "") })),
    });
    pageToken = j.nextPageToken || "";
    if (!pageToken) break;
  }
  return out;
}
