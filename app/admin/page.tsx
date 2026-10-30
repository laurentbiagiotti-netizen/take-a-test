import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteTestButton from "@/components/DeleteTestButton";

export default async function AdminHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "proctor") redirect("/dashboard");
  const isAdmin = profile?.role === "admin";

  const { data: tests } = await supabase.from("tests").select("*").order("created_at", { ascending: false });

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="h1">Administration · Examens</h1>
        <div className="flex gap-2">
          {isAdmin && <Link href="/admin/new" className="btn">Nouveau test</Link>}
          {isAdmin && <Link href="/admin/api" className="btn-secondary">API et webhooks</Link>}
          {isAdmin && <Link href="/admin/audit" className="btn-secondary">Journal</Link>}
          
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {(tests || []).length === 0 && <p className="text-muted">Aucun examen.</p>}
        {(tests || []).map((t) => (
          <div key={t.id} className="card flex items-center justify-between">
            <div>
              <div className="font-semibold">{t.title} {t.is_published ? <span className="badge-ok ml-2">publié</span> : <span className="badge-muted ml-2">brouillon</span>}</div>
              <div className="text-sm text-muted">{t.description}</div>
            </div>
            <div className="flex gap-2">
              {isAdmin && <Link href={`/admin/tests/${t.id}`} className="btn-secondary">Modifier</Link>}
              {isAdmin && <Link href={`/admin/tests/${t.id}/invites`} className="btn-secondary">Invitations</Link>}
              <Link href={`/admin/tests/${t.id}/attempts`} className="btn-secondary">Tentatives</Link>
              {isAdmin && <DeleteTestButton id={t.id} title={t.title} />}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
