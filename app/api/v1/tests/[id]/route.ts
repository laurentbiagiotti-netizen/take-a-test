import { NextResponse } from "next/server";
import { apiError, body, pickTestFields, UUID, withApi } from "@/lib/api/handler";

export const GET = withApi<{ id: string }>("tests:read", async ({ admin }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const { data } = await admin.from("tests").select("*").eq("id", id).maybeSingle();
  if (!data) return apiError(404, "not_found");
  const { count } = await admin.from("questions").select("id", { count: "exact", head: true }).eq("test_id", id);
  return NextResponse.json({ data: { ...data, question_count: count ?? 0 } });
});

export const PATCH = withApi<{ id: string }>("tests:write", async ({ admin, req }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const input = await body(req);
  const fields = pickTestFields(input);
  if (Object.keys(fields).length) {
    const { error } = await admin.from("tests").update(fields).eq("id", id);
    if (error) return apiError(400, "validation_error", error.message);
  }
  if (input && ("access_code" in input || "seb" in input)) {
    const { data: cur } = await admin.from("test_secrets").select("*").eq("test_id", id).maybeSingle();
    await admin.from("test_secrets").upsert({
      test_id: id,
      access_code: "access_code" in input ? (input.access_code ? String(input.access_code).toUpperCase() : null) : cur?.access_code ?? null,
      seb_browser_exam_keys: input.seb?.browser_exam_keys ?? cur?.seb_browser_exam_keys ?? [],
      seb_config_keys: input.seb?.config_keys ?? cur?.seb_config_keys ?? [],
      seb_quit_password_hash: cur?.seb_quit_password_hash ?? null,
    });
  }
  const { data } = await admin.from("tests").select("*").eq("id", id).maybeSingle();
  if (!data) return apiError(404, "not_found");
  return NextResponse.json({ data });
});

export const DELETE = withApi<{ id: string }>("tests:write", async ({ admin }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const { error } = await admin.from("tests").delete().eq("id", id);
  if (error) return apiError(400, "error", error.message);
  return new NextResponse(null, { status: 204 });
});
