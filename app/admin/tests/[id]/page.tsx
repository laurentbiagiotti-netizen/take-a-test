import { createClient } from "@/lib/supabase/server";
import { loadRoster, summarize } from "@/lib/admin/roster";
import RosterTable from "@/components/admin/RosterTable";
import { Histogram, Stat, fmt20 } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Résultats d'une épreuve : chiffres clés, répartition des notes et chaque étudiant (prénom, nom, note). */
export default async function ExamResults({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const rows = await loadRoster(supabase as any, [id]);
  const real = rows.filter((r) => !r.preview);
  const essai = !real.some((r) => !r.absent) && rows.some((r) => r.preview);
  const s = summarize(essai ? rows : real);
  const invited = real.length;

  return (
    <main className="px-4 sm:px-8 py-6 space-y-5">
      {essai && (
        <p className="rounded-xl bg-[#f08a3e]/[0.12] px-4 py-2.5 text-sm text-[#a64a12] ring-1 ring-inset ring-[#f08a3e]/30">
          Aucun étudiant n&apos;a encore composé : les chiffres comptent les copies d&apos;essai de l&apos;équipe.
        </p>
      )}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_1fr_1.35fr]">
        <Stat label="Copies rendues" value={s.done} unit={invited ? `/${invited}` : undefined}
          hint={s.live ? <span className="text-[#1d4ed8]">{s.live} en cours</span> : s.absent ? `${s.absent} absent(s)` : invited ? "aucun absent" : "aucun inscrit"} />
        <Stat dark label="Moyenne" value={fmt20(s.avg)} unit="/20" hint={s.median != null ? `médiane ${fmt20(s.median)}` : "pas encore de copie"} />
        <Stat label="Meilleure note" value={fmt20(s.best)} unit="/20" hint={s.worst != null ? `plus basse ${fmt20(s.worst)}` : undefined} />
        <Stat label="Au-dessus de 10" value={s.done ? Math.round((s.above10 / s.done) * 100) : "—"} unit={s.done ? "%" : undefined} hint={s.done ? `${s.above10} sur ${s.done}` : undefined} />
        <div className="col-span-2 md:col-span-2 xl:col-span-1"><Histogram bins={s.bins} /></div>
      </section>
      <RosterTable rows={rows} emptyText="Aucun étudiant inscrit ni passé pour l'instant." />
    </main>
  );
}
