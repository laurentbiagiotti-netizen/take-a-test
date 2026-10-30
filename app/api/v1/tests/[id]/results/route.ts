import { NextResponse } from "next/server";
import { apiError, UUID, withApi } from "@/lib/api/handler";

/** Résultats d'un test. ?format=csv pour un export tableur. */
export const GET = withApi<{ id: string }>("results:read", async ({ admin, req }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const { data, error } = await admin.from("attempts")
    .select("id, status, score, max_score, violation_count, identity_status, started_at, submitted_at, end_reason, extra_minutes, candidate:profiles(email, full_name)")
    .eq("test_id", id).order("submitted_at", { ascending: false, nullsFirst: false });
  if (error) return apiError(500, "server_error");
  // Identifiant d'origine (HubSpot, Grimp) pour remettre le résultat sur la bonne fiche
  const { data: invites } = await admin.from("invites").select("email, external_ref").eq("test_id", id);
  const refs = new Map((invites || []).map((i: any) => [i.email, i.external_ref]));
  // Score par domaine, planchers et décision indicative, pour les copies terminées
  const reports = new Map<string, any>();
  await Promise.all((data || []).filter((a: any) => a.submitted_at).map(async (a: any) => {
    const { data: r } = await admin.rpc("_attempt_report", { p_attempt: a.id });
    if (r) reports.set(a.id, r);
  }));
  const rows = (data || []).map((a: any) => {
    const r = reports.get(a.id);
    return {
      attempt_id: a.id, email: a.candidate?.email, full_name: a.candidate?.full_name,
      external_ref: refs.get(a.candidate?.email) ?? null, status: a.status,
      score: a.score, max_score: a.max_score, pass_mark: r?.pass_mark ?? null, passed: r?.passed ?? null,
      below_floors: (r?.below_floors || []).join(", "),
      violation_count: a.violation_count, identity_status: a.identity_status,
      started_at: a.started_at, submitted_at: a.submitted_at, end_reason: a.end_reason, extra_minutes: a.extra_minutes,
      domains: r?.domains ?? [],
    };
  });
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const domainNames = Array.from(new Set(rows.flatMap((r: any) => r.domains.map((d: any) => d.domain)))).sort() as string[];
    const flat = rows.map(({ domains, ...r }: any) => ({
      ...r, ...Object.fromEntries(domainNames.map((n) => {
        const d = domains.find((x: any) => x.domain === n);
        return [`domaine ${n}`, d ? `${d.score}/${d.max}` : ""];
      })),
    }));
    const cols = Object.keys(flat[0] || { attempt_id: "" });
    const esc = (v: unknown) => {
      let s = v == null ? "" : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // anti injection de formules tableur
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(";"), ...flat.map((r: any) => cols.map((c) => esc(r[c])).join(";"))].join("\n");
    return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="resultats-${id}.csv"` } });
  }
  return NextResponse.json({ data: rows });
});
