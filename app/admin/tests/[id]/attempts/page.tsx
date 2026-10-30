import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pending: "pas commencé", in_progress: "en cours", submitted: "rendu", terminated: "interrompu", expired: "temps écoulé" };

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
    ? await supabase.from("proctor_events").select("attempt_id").in("attempt_id", ids).in("kind", ["no_face", "multiple_faces", "camera_covered", "camera_frozen", "other_person", "snapshots_missing", "camera_refused", "camera_off"])
    : { data: [] as any[] };
  const camCount = new Map<string, number>();
  for (const e of camEv || []) camCount.set(e.attempt_id, (camCount.get(e.attempt_id) || 0) + 1);
  const now = Date.now();
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <a href="/admin" className="text-sm text-muted">← Retour</a>
      <div className="flex items-center justify-between mt-2">
        <h1 className="h1">Tentatives</h1>
        <div className="flex gap-2">
          <a className="btn" href={`/admin/tests/${id}/live`}>Suivi en direct</a>
          <a className="btn-secondary" href={`/admin/tests/${id}/stats`}>Statistiques des questions</a>
          <a className="btn-secondary" href={`/admin/tests/${id}/attempts`}>Actualiser</a>
        </div>
      </div>
      <table className="mt-6 w-full text-sm">
        <thead className="text-left text-muted">
          <tr><th className="py-2">Candidat</th><th>Statut</th><th>Note</th><th>Infractions</th><th>Caméra</th><th>Identité</th><th>Connexion</th><th>Rendu</th><th></th></tr>
        </thead>
        <tbody>
          {(attempts || []).map((a: any) => {
            const silent = a.status === "in_progress" && a.last_seen_at && now - new Date(a.last_seen_at).getTime() > 45_000;
            return (
              <tr key={a.id} className="border-t">
                <td className="py-2">{a.candidate?.full_name || a.candidate?.email}</td>
                <td>{STATUS[a.status] || a.status}</td>
                <td>{a.score ?? "-"}{a.max_score != null ? ` / ${a.max_score}` : ""}</td>
                <td className={a.violation_count ? "text-danger font-semibold" : ""}>{a.violation_count}</td>
                <td>{camCount.get(a.id) ? <span className="badge-warn">{camCount.get(a.id)} anomalie(s)</span> : <span className="text-faint">-</span>}</td>
                <td className={a.identity_status === "submitted" ? "text-warn font-semibold" : a.identity_status === "rejected" ? "text-danger" : ""}>
                  {a.identity_status === "submitted" ? "à vérifier" : a.identity_status}
                </td>
                <td className={silent ? "text-danger" : "text-muted"}>
                  {a.status === "in_progress" ? (silent ? "perdue" : "en ligne") : "-"}
                </td>
                <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "-"}</td>
                <td className="whitespace-nowrap"><a className="underline mr-3" href={`/admin/attempts/${a.id}`}>Voir</a>{a.submitted_at && <a className="underline" href={`/admin/attempts/${a.id}/fiche`}>Fiche jury</a>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
