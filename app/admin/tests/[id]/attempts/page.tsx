import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AttemptsTable, type AttemptRow } from "@/components/admin/AttemptsTable";

export const dynamic = "force-dynamic";

export default async function Attempts({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "proctor") redirect("/dashboard");

  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, status, score, max_score, violation_count, identity_status, last_seen_at, submitted_at, started_at, candidate:profiles(email, full_name)")
    .eq("test_id", id).order("created_at", { ascending: false });

  const ids = (attempts || []).map((a: any) => a.id);
  const { data: camEv } = ids.length
    ? await supabase.from("proctor_events").select("attempt_id").in("attempt_id", ids).in("kind", ["no_face", "multiple_faces", "camera_covered", "camera_frozen", "other_person", "camera_refused", "camera_off"])
    : { data: [] as any[] };
  const camCount = new Map<string, number>();
  for (const e of camEv || []) camCount.set(e.attempt_id, (camCount.get(e.attempt_id) || 0) + 1);
  const now = Date.now();
  const rows: AttemptRow[] = (attempts || []).map((a: any) => ({
    id: a.id,
    name: a.candidate?.full_name || a.candidate?.email || "",
    email: a.candidate?.email || "",
    status: a.status,
    score: a.score,
    max_score: a.max_score,
    violations: a.violation_count || 0,
    camera: camCount.get(a.id) || 0,
    identity: a.identity_status,
    silent: !!(a.status === "in_progress" && a.last_seen_at && now - new Date(a.last_seen_at).getTime() > 45_000),
    submitted_at: a.submitted_at,
  }));
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <a href="/admin" className="text-sm text-muted">← Retour</a>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
        <h1 className="h1">Tentatives</h1>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={`/admin/tests/${id}/live`}>Suivi en direct</a>
          <a className="btn-secondary" href={`/admin/tests/${id}/stats`}>Statistiques des questions</a>
          <a className="btn-secondary" href={`/admin/tests/${id}/attempts`}>Actualiser</a>
        </div>
      </div>
      <AttemptsTable rows={rows} />
    </main>
  );
}
