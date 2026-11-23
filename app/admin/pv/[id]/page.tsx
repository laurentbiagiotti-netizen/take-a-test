import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRoster, summarize } from "@/lib/admin/roster";
import { fmt20 } from "@/components/admin/ui";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Procès-verbal de jury" };

const DECISION: Record<string, string> = { pass: "Réussi", review: "À statuer", fail: "Échoué" };
const day = (d?: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }) : "";

/** Procès-verbal de jury d'une session : liste des candidats, notes, décisions, signatures. À imprimer ou enregistrer en PDF. */
export default async function ProcesVerbal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: t } = await supabase.from("tests").select("id, title, formation, campus, room, opens_at, closes_at, duration_minutes, verdict_pass, verdict_fail").eq("id", id).maybeSingle();
  if (!t) notFound();
  const rows = (await loadRoster(supabase as any, [id])).filter((r) => !r.preview)
    .sort((a, b) => (a.last || a.email).localeCompare(b.last || b.email, "fr") || a.first.localeCompare(b.first, "fr"));
  const s = summarize(rows);
  const th = "border border-black/40 px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide";
  const td = "border border-black/40 px-2 py-1.5 align-top";

  return (
    <main className="mx-auto max-w-[900px] px-6 py-8 text-[13px] text-fg print:max-w-none print:p-0 print:text-black">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <a href={`/admin/tests/${id}`} className="text-sm text-muted hover:text-fg">‹ Résultats de l&apos;épreuve</a>
        <PrintButton label="Enregistrer en PDF" />
      </div>
      <div className="rounded-2xl border border-line bg-white p-8 text-black print:rounded-none print:border-0 print:p-0">
        <header className="flex items-end justify-between gap-6 border-b-2 border-black pb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em]">Cybersup</div>
            <h1 className="mt-1 font-display text-2xl uppercase leading-tight">Procès-verbal de jury</h1>
          </div>
          <div className="text-right text-xs">Édité le {day(new Date().toISOString())}</div>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
          <div><dt className="inline font-semibold">Épreuve : </dt><dd className="inline">{t.title}</dd></div>
          <div><dt className="inline font-semibold">Promo : </dt><dd className="inline">{t.formation || "Toutes les promos"}</dd></div>
          <div><dt className="inline font-semibold">Session : </dt><dd className="inline">{day(t.opens_at) || "date non précisée"} · {t.duration_minutes} min</dd></div>
          <div><dt className="inline font-semibold">Lieu : </dt><dd className="inline">{[t.campus, t.room].filter(Boolean).join(", ") || "non précisé"}</dd></div>
          <div className="col-span-2"><dt className="inline font-semibold">Barème : </dt><dd className="inline">réussi à partir de {t.verdict_pass ?? 10}/20, échoué sous {t.verdict_fail ?? 8}/20, à statuer entre les deux.</dd></div>
        </dl>

        <table className="mt-4 w-full border-collapse text-center">
          <tbody>
            <tr>
              {[["Inscrits", rows.length], ["Présents", s.total], ["Absents", s.absent], ["Moyenne", `${fmt20(s.avg)} /20`], ["Réussis", s.pass], ["À statuer", s.review], ["Échoués", s.fail]].map(([l, v]) => (
                <td key={l as string} className="border border-black/40 px-2 py-2"><div className="text-[10px] uppercase tracking-wide">{l}</div><div className="text-lg font-bold tabular-nums">{v}</div></td>
              ))}
            </tr>
          </tbody>
        </table>

        <table className="mt-4 w-full border-collapse">
          <thead className="bg-black/[0.05]">
            <tr><th className={`${th} w-8`}>N°</th><th className={th}>Nom</th><th className={th}>Prénom</th><th className={`${th} w-16`}>Note /20</th><th className={`${th} w-24`}>Surveillance</th><th className={`${th} w-24`}>Décision</th><th className={th}>Observations du jury</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.attempt_id} className="break-inside-avoid">
                <td className={`${td} tabular-nums`}>{i + 1}</td>
                <td className={`${td} font-semibold`}>{r.last || r.email}</td>
                <td className={td}>{r.first}</td>
                <td className={`${td} text-right font-semibold tabular-nums`}>{r.absent ? "abs." : fmt20(r.score20)}</td>
                <td className={td}>{r.absent ? "" : r.suspicion ? "Suspicion" : r.violations ? `${r.violations} infr.` : "RAS"}</td>
                <td className={td}>{r.absent ? "Absent" : r.status === "in_progress" ? "En cours" : r.verdict ? `${DECISION[r.verdict]}${r.forced ? " *" : ""}` : r.needs_manual ? "À corriger" : ""}</td>
                <td className={td}>&nbsp;</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className={`${td} py-6 text-center`}>Aucun candidat inscrit.</td></tr>}
          </tbody>
        </table>
        {rows.some((r) => r.forced) && <p className="mt-1 text-[11px]">* Décision arrêtée par l&apos;équipe, motif consigné sur la fiche jury du candidat.</p>}

        <section className="mt-6 break-inside-avoid">
          <h2 className="text-[11px] font-bold uppercase tracking-wide">Délibération et décisions du jury</h2>
          <div className="mt-1 space-y-7 border border-black/40 p-3 pb-8"><div className="border-b border-black/30" /><div className="border-b border-black/30" /><div className="border-b border-black/30" /></div>
        </section>

        <section className="mt-6 break-inside-avoid">
          <h2 className="text-[11px] font-bold uppercase tracking-wide">Composition du jury et signatures</h2>
          <div className="mt-1 grid grid-cols-3 gap-3">
            {["Président(e) du jury", "Membre du jury", "Membre du jury"].map((l, i) => (
              <div key={i} className="border border-black/40 p-3"><div className="text-[11px]">{l}</div><div className="mt-1 text-[11px]">Nom :</div><div className="h-20" /><div className="border-t border-black/40 pt-1 text-[10px]">Signature</div></div>
            ))}
          </div>
          <p className="mt-4">Fait à ______________________, le ______________________</p>
        </section>
      </div>
    </main>
  );
}
