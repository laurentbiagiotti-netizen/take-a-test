/**
 * Inscriptions aux épreuves (API v1, /api/v1/registrations).
 * Une inscription = une invitation (table invites) + l'état de la copie du candidat s'il a commencé.
 * Statuts : registered (inscrit, pas encore commencé), started (en cours), submitted (rendue),
 * terminated (interrompue par un surveillant), expired (temps écoulé).
 */
import { accessLink, convocation } from "@/lib/exam/convocation";
import { genCode } from "@/lib/security/tokens";
import { appUrl } from "@/lib/security/env";
import type { adminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof adminClient>;
export const REG_STATUSES = ["registered", "started", "submitted", "terminated", "expired"] as const;
export type RegStatus = (typeof REG_STATUSES)[number];
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVITE_COLS = "id, test_id, email, code, full_name, extra_minutes, external_ref, used_at, created_at";

export type RegInput = { email?: string; full_name?: string | null; extra_minutes?: number; external_ref?: string | null };

/** Contrôle et nettoyage des champs modifiables ; renvoie un message d'erreur ou les champs. */
export function cleanFields(c: any, requireEmail: boolean): { error: string } | { fields: Record<string, unknown> } {
  const f: Record<string, unknown> = {};
  if (c == null || typeof c !== "object") return { error: "objet JSON attendu" };
  if (c.email !== undefined || requireEmail) {
    const email = String(c.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) return { error: "email invalide" };
    f.email = email;
  }
  if (c.full_name !== undefined) f.full_name = c.full_name === null ? null : String(c.full_name).trim().slice(0, 200) || null;
  if (c.external_ref !== undefined) f.external_ref = c.external_ref === null ? null : String(c.external_ref).trim().slice(0, 200) || null;
  if (c.extra_minutes !== undefined) {
    const n = Number(c.extra_minutes);
    if (!Number.isInteger(n) || n < 0 || n > 600) return { error: "extra_minutes : entier de 0 à 600" };
    f.extra_minutes = n;
  }
  return { fields: f };
}

/** Ajoute à chaque invitation l'état de la copie, le lien d'accès et, si demandé, la convocation prête à envoyer. */
export async function enrich(admin: Admin, invites: any[], withConvocation = false) {
  if (!invites.length) return [];
  const testIds = Array.from(new Set(invites.map((i) => i.test_id)));
  const emails = Array.from(new Set(invites.map((i) => i.email)));
  const [{ data: tests }, { data: profiles }] = await Promise.all([
    admin.from("tests").select("id, title, duration_minutes, opens_at, closes_at").in("id", testIds),
    admin.from("profiles").select("id, email").in("email", emails),
  ]);
  const pid = new Map((profiles || []).map((p: any) => [p.email, p.id]));
  const ids = (profiles || []).map((p: any) => p.id);
  const { data: attempts } = ids.length
    ? await admin.from("attempts").select("id, test_id, candidate_id, status, score, max_score, violation_count, started_at, submitted_at, end_reason").in("test_id", testIds).in("candidate_id", ids)
    : { data: [] as any[] };
  const tmap = new Map((tests || []).map((t: any) => [t.id, t]));
  const origin = appUrl();
  return invites.map((i) => {
    const a = (attempts || []).find((x: any) => x.test_id === i.test_id && x.candidate_id === (i.used_by || pid.get(i.email)));
    const status: RegStatus = !a || a.status === "pending" ? "registered" : a.status === "in_progress" ? "started" : (a.status as RegStatus);
    const t: any = tmap.get(i.test_id);
    const out: any = {
      id: i.id, test_id: i.test_id, test_title: t?.title ?? null, email: i.email, full_name: i.full_name, external_ref: i.external_ref,
      extra_minutes: i.extra_minutes, code: i.code, access_url: accessLink(origin, i.code), status,
      attempt: a ? { id: a.id, status: a.status, score: a.score, max_score: a.max_score, violation_count: a.violation_count, started_at: a.started_at, submitted_at: a.submitted_at, end_reason: a.end_reason } : null,
      created_at: i.created_at, used_at: i.used_at,
    };
    if (withConvocation && t) out.convocation = convocation({ email: i.email, fullName: i.full_name, code: i.code, extraMinutes: i.extra_minutes, testTitle: t.title, durationMinutes: t.duration_minutes, opensAt: t.opens_at, closesAt: t.closes_at, origin, testId: t.id });
    return out;
  });
}

export async function getInvite(admin: Admin, id: string) {
  const { data } = await admin.from("invites").select(`${INVITE_COLS}, used_by`).eq("id", id).maybeSingle();
  return data;
}

/** Envoie l'événement aux webhooks abonnés (registration.created, .updated, .deleted). */
export async function notify(admin: Admin, event: "registration.created" | "registration.updated" | "registration.deleted", reg: any) {
  const { code: _code, access_url: _url, convocation: _c, ...safe } = reg || {};
  await admin.rpc("_enqueue_webhook", { p_event: event, p_payload: safe });
}

/** Crée ou met à jour une inscription (clé : épreuve + e-mail). */
export async function upsertOne(admin: Admin, testId: string, input: any): Promise<{ status: number; error?: string; reg?: any; created?: boolean }> {
  const r = cleanFields(input, true);
  if ("error" in r) return { status: 400, error: r.error };
  const f = r.fields as any;
  const { data: existing } = await admin.from("invites").select(`${INVITE_COLS}, used_by`).eq("test_id", testId).eq("email", f.email).maybeSingle();
  if (existing) {
    const { email: _e, ...upd } = f;
    if (Object.keys(upd).length) {
      const { error } = await admin.from("invites").update(upd).eq("id", existing.id);
      if (error) return { status: 400, error: error.message };
    }
    const [reg] = await enrich(admin, [{ ...existing, ...upd }]);
    if (Object.keys(upd).length) await notify(admin, "registration.updated", reg);
    return { status: 200, reg, created: false };
  }
  const { data, error } = await admin.from("invites").insert({ test_id: testId, code: genCode(), extra_minutes: 0, ...f }).select(`${INVITE_COLS}, used_by`).single();
  if (error) return { status: 400, error: error.message };
  const [reg] = await enrich(admin, [data]);
  await notify(admin, "registration.created", reg);
  return { status: 201, reg, created: true };
}
