import { NextResponse } from "next/server";
import { apiError, body, UUID, withApi } from "@/lib/api/handler";
import { genCode } from "@/lib/security/tokens";
import { appUrl } from "@/lib/security/env";

export const GET = withApi<{ id: string }>("invites:read", async ({ admin }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const { data } = await admin.from("invites").select("id, email, code, used_at, created_at").eq("test_id", id).order("created_at");
  return NextResponse.json({ data, test_url: `${appUrl()}/test/${id}` });
});

/** Body : { emails: string[] }  -> crée les invitations manquantes, renvoie les codes. */
export const POST = withApi<{ id: string }>("invites:write", async ({ admin, req }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const input = await body<{ emails?: string[] }>(req);
  const emails = Array.from(new Set((input?.emails || []).map((e) => String(e).trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254)));
  if (!emails.length || emails.length > 2000) return apiError(400, "validation_error", "1 à 2000 e-mails valides");
  const { data: test } = await admin.from("tests").select("id").eq("id", id).maybeSingle();
  if (!test) return apiError(404, "not_found");
  const rows = emails.map((email) => ({ test_id: id, email, code: genCode() }));
  const { error } = await admin.from("invites").upsert(rows, { onConflict: "test_id,email", ignoreDuplicates: true });
  if (error) return apiError(400, "validation_error", error.message);
  const { data } = await admin.from("invites").select("id, email, code, used_at").eq("test_id", id).in("email", emails);
  return NextResponse.json({ data, test_url: `${appUrl()}/test/${id}` }, { status: 201 });
});
