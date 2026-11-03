import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { tableWorkbook } from "@/lib/excel/xlsx";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS: Record<string, string> = { pending: "Pas commencé", in_progress: "En cours", submitted: "Rendu", terminated: "Interrompu", expired: "Temps écoulé" };

/** Export Excel des résultats d'une épreuve (une ligne par candidat, une colonne par domaine). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireStaff(req);
  if ("res" in s) return s.res;
  if (!UUID.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const admin = adminClient();
  const { data: test } = await admin.from("tests").select("title").eq("id", id).maybeSingle();
  if (!test) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: attempts } = await admin.from("attempts")
    .select("id, status, score, max_score, violation_count, started_at, submitted_at, extra_minutes, suspicion_at, candidate:profiles(email, full_name)")
    .eq("test_id", id).order("submitted_at", { ascending: false, nullsFirst: false });
  const { data: invites } = await admin.from("invites").select("email, external_ref, full_name").eq("test_id", id);
  const inv = new Map((invites || []).map((i: any) => [i.email, i]));
  const reports = new Map<string, any>();
  await Promise.all((attempts || []).map(async (a: any) => {
    const { data } = await admin.rpc("_attempt_report", { p_attempt: a.id });
    if (data) reports.set(a.id, data);
  }));
  const ids = (attempts || []).map((a: any) => a.id);
  const { data: alerts } = ids.length
    ? await admin.from("proctor_events").select("attempt_id").in("attempt_id", ids).in("severity", ["warning", "violation", "critical"])
    : { data: [] as any[] };
  const alertCount = new Map<string, number>();
  for (const e of alerts || []) alertCount.set(e.attempt_id, (alertCount.get(e.attempt_id) || 0) + 1);

  const domains = Array.from(new Set(Array.from(reports.values()).flatMap((r) => (r.domains || []).map((d: any) => d.domain)))).sort() as string[];
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "");
  const rows = (attempts || []).map((a: any) => {
    const r = reports.get(a.id) || {};
    const i: any = inv.get(a.candidate?.email) || {};
    return [
      a.candidate?.full_name || i.full_name || "", a.candidate?.email || "", i.external_ref || "",
      STATUS[a.status] || a.status, fmt(a.started_at), fmt(a.submitted_at),
      r.score20 ?? "", r.verdict_label || "", r.verdict_override?.reason || "",
      a.score ?? "", a.max_score ?? "", (r.below_floors || []).join(", "),
      a.violation_count ?? 0, alertCount.get(a.id) || 0, a.suspicion_at ? "oui" : "", a.extra_minutes || "",
      ...domains.map((n) => {
        const d = (r.domains || []).find((x: any) => x.domain === n);
        return d ? `${d.score}/${d.max}` : "";
      }),
    ];
  });
  const buf = await tableWorkbook("Résultats", [
    { header: "Nom", width: 24 }, { header: "Email", width: 30 }, { header: "Réf. HubSpot / Grimp", width: 18 },
    { header: "Statut", width: 13 }, { header: "Début", width: 18 }, { header: "Fin", width: 18 },
    { header: "Note /20", width: 10 }, { header: "Résultat", width: 14 }, { header: "Motif de la décision forcée", width: 30 },
    { header: "Points", width: 8 }, { header: "Sur", width: 6 }, { header: "Planchers non atteints", width: 22 },
    { header: "Infractions", width: 11 }, { header: "Alertes de surveillance", width: 12 }, { header: "Suspicion", width: 10 }, { header: "Tiers-temps (min)", width: 10 },
    ...domains.map((d) => ({ header: d, width: 14 })),
  ], rows);
  const name = `resultats-${String(test.title).normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || id}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store",
  } });
}
