import { NextResponse } from "next/server";
import { apiError, UUID, withApi } from "@/lib/api/handler";

/** Résultats d'un test. ?format=csv pour un export tableur. */
export const GET = withApi<{ id: string }>("results:read", async ({ admin, req }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const { data, error } = await admin.from("attempts")
    .select("id, status, score, max_score, violation_count, identity_status, started_at, submitted_at, end_reason, extra_minutes, candidate:profiles(email, full_name)")
    .eq("test_id", id).order("submitted_at", { ascending: false, nullsFirst: false });
  if (error) return apiError(500, "server_error");
  const rows = (data || []).map((a: any) => ({
    attempt_id: a.id, email: a.candidate?.email, full_name: a.candidate?.full_name, status: a.status,
    score: a.score, max_score: a.max_score, violation_count: a.violation_count, identity_status: a.identity_status,
    started_at: a.started_at, submitted_at: a.submitted_at, end_reason: a.end_reason, extra_minutes: a.extra_minutes,
  }));
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const cols = Object.keys(rows[0] || { attempt_id: "" });
    const esc = (v: unknown) => {
      let s = v == null ? "" : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // anti injection de formules tableur
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(";"), ...rows.map((r: any) => cols.map((c) => esc(r[c])).join(";"))].join("\n");
    return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="resultats-${id}.csv"` } });
  }
  return NextResponse.json({ data: rows });
});
