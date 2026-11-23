"use client";
import { useState } from "react";
import Link from "next/link";
import { notify } from "@/components/Toaster";

export type Missing = { email: string; name: string; exam: string };

/** Chiffre « pas passé » cliquable : liste des étudiants concernés, adresses à copier, relance à préparer dans sa messagerie. */
export default function MissingButton({ people, label }: { people: Missing[]; label: string }) {
  const [open, setOpen] = useState(false);
  if (!people.length) return <span className="text-muted">0</span>;
  const emails = Array.from(new Set(people.map((p) => p.email.toLowerCase())));
  const exams = Array.from(new Set(people.map((p) => p.exam)));
  const copy = async () => { try { await navigator.clipboard.writeText(emails.join("; ")); notify(`${emails.length} adresse(s) copiée(s).`, "ok"); } catch { notify("Copie impossible : sélectionnez les adresses à la main."); } };
  const subject = exams.length === 1 ? `Examen « ${exams[0]} » : vous ne l'avez pas encore passé` : "Examen non passé";
  const body = `Bonjour,\n\nSauf erreur de notre part, vous étiez inscrit(e) à ${exams.length === 1 ? `l'examen « ${exams[0]} »` : "un examen"} et vous ne l'avez pas passé.\nMerci de nous répondre pour convenir d'une solution.\n\nCordialement,\nCybersup`;
  const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md px-1.5 font-semibold tabular-nums text-[#b3361a] underline decoration-dotted underline-offset-4 hover:bg-[#c23b17]/10" title="Voir qui n'a pas passé">{people.length}</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 text-left backdrop-blur-[2px]" role="dialog" aria-modal aria-label="Étudiants qui n'ont pas passé" onClick={() => setOpen(false)}>
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg uppercase text-navy">N&apos;ont pas passé</h3>
            <p className="mt-1 text-sm text-muted">{label} · {people.length} convocation(s), {emails.length} étudiant(s)</p>
            <ul className="mt-4 min-h-0 flex-1 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {people.map((p, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5 text-sm">
                  <Link href={`/admin/etudiants/${encodeURIComponent(p.email)}`} className="font-semibold text-navy hover:text-accent">{p.name || p.email}</Link>
                  <span className="text-muted">{p.email}</span>
                  <span className="ml-auto text-xs text-muted">{p.exam}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)}>Fermer</button>
              <button className="btn-secondary" onClick={copy}>Copier les adresses</button>
              <a className="btn" href={mailto} title="Ouvre votre messagerie avec les adresses en copie cachée. Rien n'est envoyé sans vous.">Préparer une relance</a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
