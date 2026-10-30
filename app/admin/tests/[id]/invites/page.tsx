"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { genCode } from "@/lib/security/tokens";

type Invite = {
  id: string; test_id: string; email: string; code: string;
  used_at: string | null; created_at: string;
};

export default function InvitesPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [test, setTest] = useState<any>(null);
  const [origin, setOrigin] = useState("");

  const load = async () => {
    const { data } = await supabase.from("invites").select("*").eq("test_id", id).order("created_at", { ascending: false });
    setInvites((data as any) || []);
  };

  useEffect(() => {
    setOrigin(window.location.origin);
    (async () => {
      const { data: t } = await supabase.from("tests").select("*").eq("id", id).single();
      setTest(t);
      load();
    })();
  }, [id]);

  const addBatch = async () => {
    const list = Array.from(new Set(
      emails.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => /.+@.+\..+/.test(s))
    ));
    if (!list.length) return alert("Aucune adresse e-mail valide");
    setBusy(true);
    const rows = list.map((email) => ({ test_id: id, email, code: genCode() }));
    const { error } = await supabase.from("invites").insert(rows);
    setBusy(false);
    if (error) return alert(error.message);
    setEmails("");
    load();
  };

  const remove = async (inviteId: string) => {
    await supabase.from("invites").delete().eq("id", inviteId);
    load();
  };

  const copyAll = () => {
    const text = invites.map((i) => `${i.email}\t${i.code}\t${origin}/test/${id}`).join("\n");
    navigator.clipboard.writeText(text);
    alert("Copié (e-mail, code, lien séparés par des tabulations)");
  };

  const exportCsv = () => {
    const csv = "email,code,link\n" + invites.map((i) => `${i.email},${i.code},${origin}/test/${id}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `invites-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const mailtoLink = (i: Invite) => {
    const link = `${origin}/test/${id}`;
    const subject = encodeURIComponent(`Votre convocation : ${test?.title || ""}`);
    const body = encodeURIComponent(
`Bonjour,

Vous êtes convoqué(e) à l'épreuve « ${test?.title || ""} ».

1. Connectez-vous ou créez votre compte : ${origin}/signup (avec cette adresse : ${i.email})
2. Ouvrez l'épreuve : ${link}
3. Saisissez votre code d'accès personnel : ${i.code}

À savoir :
- L'épreuve se déroule en plein écran, caméra allumée.
- Copier-coller et changement de fenêtre sont bloqués et journalisés.
- Vous pouvez faire un essai à l'avance sur ${origin}/demo.

Bonne épreuve,
Cybersup, l'école qui protège votre avenir`);
    return `mailto:${i.email}?subject=${subject}&body=${body}`;
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <a href={`/admin/tests/${id}`} className="text-sm text-muted">← Retour à l&apos;examen</a>
      <h1 className="h1 mt-2">Invitations · {test?.title}</h1>

      <div className="card mt-6">
        <div className="text-sm font-medium">Ajouter des candidats par e-mail</div>
        <p className="text-xs text-muted mt-1">Une adresse par ligne (ou séparées par des virgules). Chaque candidat reçoit un code personnel.</p>
        <textarea className="input mt-2 min-h-[120px] font-mono text-sm" placeholder="alice@example.com&#10;bob@example.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
        <div className="mt-2 flex gap-2">
          <button className="btn" onClick={addBatch} disabled={busy}>{busy ? "Ajout…" : "Générer les invitations"}</button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="h2">{invites.length} invitation{invites.length === 1 ? "" : "s"}</h2>
        {invites.length > 0 && (
          <div className="flex gap-2">
            <button className="btn" disabled={sending} onClick={async () => {
              if (!confirm(`Envoyer l’invitation par e-mail à ${invites.length} candidat(s) ?`)) return;
              setSending(true);
              const r = await fetch(`/api/admin/tests/${id}/invites/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
              const j = await r.json();
              setSending(false);
              if (!r.ok) return alert(j.error || "Échec de l’envoi");
              alert(`Envoyés : ${j.sent}. Échecs : ${j.failed?.length || 0}.${j.failed?.length ? "\n" + j.failed.map((f: any) => `${f.email}: ${f.error}`).join("\n") : ""}`);
            }}>{sending ? "Envoi…" : "Tout envoyer par e-mail"}</button>
            <button className="btn-secondary" onClick={copyAll}>Tout copier</button>
            <button className="btn-secondary" onClick={exportCsv}>Exporter en CSV</button>
          </div>
        )}
      </div>

      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-muted">
          <tr><th className="py-2">E-mail</th><th>Code</th><th>État</th><th></th></tr>
        </thead>
        <tbody>
          {invites.map((i) => (
            <tr key={i.id} className="border-t">
              <td className="py-2">{i.email}</td>
              <td><code className="font-mono">{i.code}</code></td>
              <td>{i.used_at ? <span className="text-ok">utilisé le {new Date(i.used_at).toLocaleString("fr-FR")}</span> : <span className="text-muted">en attente</span>}</td>
              <td className="text-right">
                <a href={mailtoLink(i)} className="text-accent underline mr-3">e-mail</a>
                <button className="text-danger" onClick={() => remove(i.id)}>supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
