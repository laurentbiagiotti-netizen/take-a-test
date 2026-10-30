import { NextResponse } from "next/server";
import { apiError, body, pickTestFields, withApi } from "@/lib/api/handler";

export const GET = withApi("tests:read", async ({ admin }) => {
  const { data, error } = await admin.from("tests").select("*").order("created_at", { ascending: false });
  if (error) return apiError(500, "server_error");
  return NextResponse.json({ data });
});

export const POST = withApi("tests:write", async ({ admin, req, actorId }) => {
  const input = await body(req);
  const fields = pickTestFields(input);
  if (!fields.title) return apiError(400, "validation_error", "title est requis");
  if (!actorId) return apiError(400, "validation_error", "La clé doit appartenir à un administrateur");
  const { data, error } = await admin.from("tests").insert({ ...fields, owner_id: actorId }).select("*").single();
  if (error) return apiError(400, "validation_error", error.message);
  if (input?.access_code !== undefined || input?.seb) {
    await admin.from("test_secrets").upsert({
      test_id: data.id,
      access_code: input.access_code ? String(input.access_code).toUpperCase() : null,
      seb_browser_exam_keys: input.seb?.browser_exam_keys || [],
      seb_config_keys: input.seb?.config_keys || [],
    });
  }
  return NextResponse.json({ data }, { status: 201 });
});
