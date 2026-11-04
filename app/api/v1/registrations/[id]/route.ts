import { NextResponse } from "next/server";
import { apiError, body, UUID, withApi } from "@/lib/api/handler";
import { cleanFields, enrich, getInvite, notify } from "@/lib/api/registrations";
import { genCode } from "@/lib/security/tokens";

/** GET /api/v1/registrations/{id}[?include=convocation] */
export const GET = withApi<{ id: string }>("invites:read", async ({ admin, req }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const inv = await getInvite(admin, id);
  if (!inv) return apiError(404, "not_found");
  const [reg] = await enrich(admin, [inv], new URL(req.url).searchParams.get("include") === "convocation");
  return NextResponse.json({ data: reg });
});

/**
 * PATCH /api/v1/registrations/{id}
 * Corps (tout est facultatif) : full_name, extra_minutes, external_ref, email, test_id (changer d'épreuve), regenerate_code: true.
 * L'e-mail, l'épreuve et le code ne changent plus une fois l'épreuve commencée (409).
 */
export const PATCH = withApi<{ id: string }>("invites:write", async ({ admin, req }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const inv = await getInvite(admin, id);
  if (!inv) return apiError(404, "not_found");
  const input = await body<any>(req);
  const r = cleanFields(input, false);
  if ("error" in r) return apiError(400, "validation_error", r.error);
  const upd: Record<string, unknown> = { ...r.fields };
  const [before] = await enrich(admin, [inv]);
  const locked = before.status !== "registered" || !!inv.used_at;
  if (input?.test_id !== undefined && input.test_id !== inv.test_id) {
    if (!UUID.test(String(input.test_id))) return apiError(400, "validation_error", "test_id invalide");
    const { data: t } = await admin.from("tests").select("id").eq("id", input.test_id).maybeSingle();
    if (!t) return apiError(404, "not_found", "Épreuve de destination introuvable");
    upd.test_id = input.test_id;
  }
  if (input?.regenerate_code === true) upd.code = genCode();
  if (upd.email === inv.email) delete upd.email;
  if (locked && (upd.email || upd.test_id || upd.code)) return apiError(409, "conflict", "Le candidat a déjà commencé : l'e-mail, l'épreuve et le code ne peuvent plus changer");
  if (!Object.keys(upd).length) return NextResponse.json({ data: before });
  const { data, error } = await admin.from("invites").update(upd).eq("id", id).select("id, test_id, email, code, full_name, extra_minutes, external_ref, used_at, used_by, created_at").single();
  if (error) return apiError(error.code === "23505" ? 409 : 400, error.code === "23505" ? "conflict" : "validation_error", error.code === "23505" ? "Ce candidat est déjà inscrit à cette épreuve" : error.message);
  const [reg] = await enrich(admin, [data]);
  await notify(admin, "registration.updated", reg);
  return NextResponse.json({ data: reg });
});

/** DELETE /api/v1/registrations/{id} : désinscrit le candidat (refusé s'il a déjà commencé, 409). */
export const DELETE = withApi<{ id: string }>("invites:write", async ({ admin }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const inv = await getInvite(admin, id);
  if (!inv) return apiError(404, "not_found");
  const [reg] = await enrich(admin, [inv]);
  if (reg.status !== "registered") return apiError(409, "conflict", "Le candidat a déjà commencé l'épreuve : sa copie est conservée, l'inscription ne peut pas être supprimée");
  await admin.from("invites").delete().eq("id", id);
  await notify(admin, "registration.deleted", reg);
  return new NextResponse(null, { status: 204 });
});
