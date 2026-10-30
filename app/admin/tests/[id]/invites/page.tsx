"use client";
import { notify } from "@/components/Toaster";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { genCode } from "@/lib/security/tokens";
import { convocation, importCandidates } from "@/lib/exam/convocation";

type Invite = {
  id: string; test_id: string; email: string; code: string; full_name: string | null;
  extra_minutes: number; external_ref: string | null; used_at: string | null; created_at: string;
};

/**
 * Candidats d'une épreuve : import (liste d'adresses ou export HubSpot / Grimp),
 * tiers-temps réglé à l'avance, convocations préparées en brouillon.
 * Rien n'est envoyé automatiquement : l'équipe relit et envoie elle-même.
 */
export default function InvitesPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<any>(null);
  const [origin, setOrigin] = useState("");
  const [preview, setPreview] = useState<Invite | null>(null);
  const [note, setNote] = useState<string | null>(null);

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

  const parsed = input.trim() ? importCandidates(input) : { rows: [], skipped: 0 };

  const addBatch = async () => {
    if (!parsed.rows.length) return notify("Aucune adresse e-mail valide");
    setBusy(true);
    const existing = new Set(invites.map((i) => i.email));
    const fresh = parsed.rows.filter((r) => !existing.has(r.email));
    const { error } = fresh.length
      ? await supabase.from("invites").insert(fresh.map((r) => ({ ...r, test_id: id, code: genCode() })))
      : { error: null };
    setBusy(false);
    if (error) return notify(error.message);
    setNote(`${fresh.length} candidat(s) ajouté(s)${parsed.rows.length - fresh.length ? `, ${parsed.rows.length - fresh.length} déjà présent(s)` : ""}${parsed.skipped ? `, ${parsed.skipped} ligne(s) ignorée(s) (adresse absente ou en double)` : ""}.`);
    setInput("");
    load();
  };

  const setExtra = async (inv: Invite, minutes: number) => {
    const v = Math.min(600, Math.max(0, Math.round(minutes || 0)));
    if (v === inv.extra_minutes) return;
    const { error } = await supabase.from("invites").update({ extra_minutes: v }).eq("id", inv.id);
    if (error) return notify(error.message);
    setInvites((all) => all.map((x) => x.id === inv.id ? { ...x, extra_minutes: v } : x));
  };

  const remove = async (inviteId: string) => {
    if (!confirm("Supprimer cette invitation ?")) return;
    await supabase.from("invites").delete().eq("id", inviteId);
    load();
  };

  const conv = (i: Invite) => convocation({
    email: i.email, fullName: i.full_name, code: i.code, extraMinutes: i.extra_minutes,
    testTitle: test?.title || "", durationMinutes: test?.duration_minutes || 0,
    opensAt: test?.opens_at, closesAt: test?.closes_at, origin, testId: id,
  });

  const mailto = (i: Invite) => {
    const c = conv(i);
    return `mailto:${c.to}?subject=${encodeURIComponent(c.subject)}&body=${encodeURIComponent(c.body)}`;
  };

  const download = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;

  const exportConvocations = () => {
    const todo = invites.filter((i) => !i.used_at);
    const csv = "email,nom,tiers_temps,code,sujet,message\n" + todo.map((i) => {
      const c = conv(i);
      return [i.email, i.full_name || "", String(i.extra_minutes), i.code, c.subject, c.body].map(cell).join(",");
    }).join("\n");
    download(`convocations-${id}.csv`, "﻿" + csv, "text/csv");
  };

  const exportCodes = () => {
    const csv = "email,nom,code,tiers_temps,lien,identifiant_externe\n" + invites.map((i) =>
      [i.email, i.full_name || "", i.code, String(i.extra_minutes), `${origin}/test/${id}`, i.external_ref || ""].map(cell).join(",")).join("\n");
    download(`invitations-${id}.csv`, "﻿" + csv, "text/csv");
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <a href={`/admin/tests/${id}`} className="text-sm text-muted">← Retour à l&apos;examen</a>
      <h1 className="h1 mt-2">Candidats · {test?.title}</h1>

      <div className="card mt-6">
        <div className="text-sm font-medium">Ajouter des candidats</div>
        <p className="text-xs text-muted mt-1">
          Collez une liste d&apos;adresses, ou directement un export CSV de HubSpot, de Grimp ou d&apos;un tableur.
          Colonnes reconnues : e-mail, prénom, nom (ou nom complet), tiers-temps (en minutes), identifiant.
        </p>
        <textarea className="input mt-2 min-h-[120px] font-mono text-sm" placeholder={"alice@example.com\nbob@example.com\n\nou\n\nEmail;Prénom;Nom;Tiers-temps\nalice@example.com;Alice;Martin;15"} value={input} onChange={(e) => setInput(e.target.value)} />
        {input.trim() && (
          <p className="text-xs text-muted mt-2">
            {parsed.rows.length} candidat(s) reconnu(s){parsed.rows.some((r) => r.extra_minutes) ? `, dont ${parsed.rows.filter((r) => r.extra_minutes).length} avec tiers-temps` : ""}{parsed.skipped ? `, ${parsed.skipped} ligne(s) ignorée(s)` : ""}.
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <button className="btn" onClick={addBatch} disabled={busy || !parsed.rows.length}>{busy ? "Ajout…" : "Ajouter et générer les codes"}</button>
        </div>
        {note && <p className="text-sm text-ok mt-2" role="status">{note}</p>}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="h2">{invites.length} candidat{invites.length === 1 ? "" : "s"}</h2>
        {invites.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={exportConvocations}>Convocations à relire (CSV)</button>
            <button className="btn-secondary" onClick={exportCodes}>Exporter les codes</button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted mt-1">
        Les convocations ne partent jamais toutes seules : ouvrez-les une par une dans votre messagerie (bouton « brouillon »),
        ou exportez-les pour les transformer en brouillons Gmail à relire et envoyer vous-même.
      </p>

      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-muted">
          <tr><th className="py-2">Candidat</th><th>Code</th><th title="Minutes ajoutées à la durée de l'épreuve">Tiers-temps</th><th>État</th><th></th></tr>
        </thead>
        <tbody>
          {invites.map((i) => (
            <tr key={i.id} className="border-t align-top">
              <td className="py-2">
                <div>{i.full_name || i.email}</div>
                {i.full_name && <div className="text-xs text-muted">{i.email}</div>}
                {i.external_ref && <div className="text-xs text-faint">réf. {i.external_ref}</div>}
              </td>
              <td><code className="font-mono">{i.code}</code></td>
              <td>
                <label className="flex items-center gap-1">
                  <input type="number" min={0} max={600} step={5} defaultValue={i.extra_minutes} disabled={!!i.used_at}
                    className="input !w-20 !py-1" aria-label={`Tiers-temps de ${i.email}`}
                    onBlur={(e) => setExtra(i, Number(e.target.value))} />
                  <span className="text-xs text-muted">min</span>
                </label>
              </td>
              <td>{i.used_at ? <span className="text-ok">compte lié le {new Date(i.used_at).toLocaleString("fr-FR")}</span> : <span className="text-muted">en attente</span>}</td>
              <td className="text-right whitespace-nowrap">
                <button className="underline mr-3" onClick={() => setPreview(i)}>voir</button>
                <a href={mailto(i)} className="text-accent underline mr-3">brouillon</a>
                <button className="text-danger" onClick={() => remove(i.id)}>supprimer</button>
              </td>
            </tr>
          ))}
          {!invites.length && <tr><td colSpan={5} className="py-8 text-center text-muted">Aucun candidat pour l&apos;instant : collez une liste d&apos;adresses ou un export HubSpot / Grimp ci-dessus.</td></tr>}
        </tbody>
      </table>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" role="dialog" aria-modal aria-label="Convocation" onClick={() => setPreview(null)}>
          <div className="card max-w-2xl w-full max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs text-muted">À : {preview.email}</div>
            <div className="font-medium mt-1">{conv(preview).subject}</div>
            <pre className="mt-3 whitespace-pre-wrap text-sm font-sans">{conv(preview).body}</pre>
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary" onClick={() => { navigator.clipboard.writeText(conv(preview).body); }}>Copier le texte</button>
              <a className="btn" href={mailto(preview)}>Ouvrir en brouillon</a>
              <button className="btn-secondary ml-auto" onClick={() => setPreview(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
