import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role === "admin" || profile?.role === "proctor") redirect("/admin");

  // Lecture via une fonction dédiée : le candidat n'a aucun accès direct aux tables.
  const { data: tests } = await supabase.rpc("my_dashboard");
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="h1">Mes examens</h1>
        <form action="/auth/signout" method="post"><button className="btn-secondary">Déconnexion</button></form>
      </div>
      <div className="mt-6 space-y-3">
        {(tests || []).length === 0 && <p className="text-muted">Aucun examen disponible pour le moment.</p>}
        {(tests || []).map((t: any) => {
          const done = ["submitted", "terminated", "expired"].includes(t.status);
          return (
            <div key={t.test_id} className="card flex items-center justify-between">
              <div>
                <div className="font-semibold">{t.title}</div>
                {t.description && <div className="text-sm text-muted">{t.description}</div>}
                <div className="text-xs text-muted mt-1">
                  Durée : {t.duration_minutes} min
                  {t.opens_at && <> · ouvre le {fmt(t.opens_at)}</>}
                  {t.closes_at && <> · ferme le {fmt(t.closes_at)}</>}
                </div>
              </div>
              <div>
                {done ? <span className="text-sm text-muted">Terminé</span>
                  : <Link href={`/test/${t.test_id}`} className="btn">{t.status === "in_progress" ? "Reprendre" : "Accéder"}</Link>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
