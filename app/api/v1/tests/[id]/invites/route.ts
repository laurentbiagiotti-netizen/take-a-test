import { NextResponse } from "next/server";
import { apiError, body, UUID, withApi } from "@/lib/api/handler";
import { genCode } from "@/lib/security/tokens";
import { appUrl } from "@/lib/security/env";

export const GET = withApi<{ id: string }>("invites:read", async ({ admin }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const { data } = await admin.from("invites").select("id, email, code, full_name, extra_minutes, external_ref, used_at, created_at").eq("test_id", id).order("created_at");
  return NextResponse.json({ data, test_url: `${appUrl()}/test/${id}` });
});

/**
 * Body : { emails: string[] } ou { candidates: [{ email, full_name?, extra_minutes?, external_ref? }] }
 * (export HubSpot ou Grimp). Crée les invitations manquantes, renvoie les codes.
 */
export const POST = withApi<{ id: string }>("invites:write", async ({ admin, req }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const input = await body<{ emails?: string[]; candidates?: any[] }>(req);
  const raw: any[] = Array.isArray(input?.candidates) ? input!.candidates : (input?.emails || []).map((email) => ({ email }));
  const byEmail = new Map<string, any>();
  for (const c of raw.slice(0, 2001)) {
    const email = String(c?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || byEmail.has(email)) continue;
    const extra = Number(c?.extra_minutes ?? 0);
    byEmail.set(email, {
      email,
      full_name: typeof c?.full_name === "string" ? c.full_name.slice(0, 200) : null,
      extra_minutes: Number.isFinite(extra) ? Math.min(600, Math.max(0, Math.round(extra))) : 0,
      external_ref: c?.external_ref != null ? String(c.external_ref).slice(0, 200) : null,
    });
  }
  const emails = Array.from(byEmail.keys());
  if (!emails.length || emails.length > 2000) return apiError(400, "validation_error", "1 à 2000 e-mails valides");
  const { data: test } = await admin.from("tests").select("id").eq("id", id).maybeSingle();
  if (!test) return apiError(404, "not_found");
  const rows = emails.map((email) => ({ ...byEmail.get(email), test_id: id, code: genCode() }));
  const { error } = await admin.from("invites").upsert(rows, { onConflict: "test_id,email", ignoreDuplicates: true });
  if (error) return apiError(400, "validation_error", error.message);
  const { data } = await admin.from("invites").select("id, email, code, full_name, extra_minutes, external_ref, used_at").eq("test_id", id).in("email", emails);
  return NextResponse.json({ data, test_url: `${appUrl()}/test/${id}` }, { status: 201 });
});
