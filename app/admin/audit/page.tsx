import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const TABLES: Record<string, string> = {
  tests: "examen", test_secrets: "secrets d'examen", questions: "question", answer_keys: "bonne réponse",
  question_terminals: "défi terminal", invites: "invitation", profiles: "profil", api_keys: "clé d'API", webhooks: "webhook",
};
const OPS: Record<string, string> = { INSERT: "création", UPDATE: "modification", DELETE: "suppression" };

/** Journal inaltérable des actions d'administration (admins uniquement). */
export default async function Audit() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (profile?.role !== "admin") redirect("/admin");
  const { data: rows } = await supabase.from("admin_audit").select("*").order("id", { ascending: false }).limit(300);
  const ids = Array.from(new Set((rows || []).map((r: any) => r.actor).filter(Boolean)));
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, email").in("id", ids) : { data: [] as any[] };
  const who = new Map((people || []).map((p: any) => [p.id, p.email]));
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <a href="/admin" className="text-sm text-muted">← Retour</a>
      <h1 className="h1 mt-2">Journal d&apos;administration</h1>
      <p className="text-sm text-muted mt-1">300 dernières actions. Les valeurs secrètes (codes, clés, flags, bonnes réponses) ne sont jamais recopiées.</p>
      <table className="mt-6 w-full text-sm">
        <thead className="text-left"><tr><th className="py-2">Date</th><th>Auteur</th><th>Objet</th><th>Action</th><th>Champs modifiés</th></tr></thead>
        <tbody>
          {(rows || []).map((r: any) => (
            <tr key={r.id} className="border-t border-line align-top">
              <td className="py-2 whitespace-nowrap text-muted">{new Date(r.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</td>
              <td>{r.actor ? (who.get(r.actor) || r.actor.slice(0, 8)) : <span className="text-faint">système / SQL</span>}</td>
              <td>{TABLES[r.table_name] || r.table_name}</td>
              <td>{OPS[r.op] || r.op}</td>
              <td className="font-mono text-xs text-muted break-all">{r.changed ? JSON.stringify(r.changed) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
