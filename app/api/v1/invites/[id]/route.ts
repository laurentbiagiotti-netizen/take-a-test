import { NextResponse } from "next/server";
import { apiError, UUID, withApi } from "@/lib/api/handler";

export const DELETE = withApi<{ id: string }>("invites:write", async ({ admin }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  await admin.from("invites").delete().eq("id", id);
  return new NextResponse(null, { status: 204 });
});
