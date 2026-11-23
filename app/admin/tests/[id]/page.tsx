import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadRoster, summarize } from "@/lib/admin/roster";
import RosterTable from "@/components/admin/RosterTable";
import { Kpi, VerdictBar, fmt20 } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Vue d'ensemble d'une épreuve : chaque candidat avec son prénom, son nom, sa note et la décision. */
export default async function ExamOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: t }, rows, { data: invites }] = await Promise.all([
    supabase.from("tests").select("id, title, verdict_pass, verdict_fail").eq("id", id).maybeSingle(),
    loadRoster(supabase as any, [id]),
    supabase.from("invites").select("id, used_at, preview").eq("test_id", id),
  ]);
  const real = rows.filter((r) => !r.preview);
  const base = real.length ? real : rows;
  const s = summarize(base);
  const invited = (invites || []).filter((i: any) => !i.preview).length;
  const notStarted = Math.max(0, invited - real.length);
  const pass = t?.verdict_pass ?? 10, fail = t?.verdict_fail ?? 8;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
      {!real.length && rows.length > 0 && (
        <p className="rounded-lg bg-warn/10 px-4 py-2.5 text-sm text-warn ring-1 ring-inset ring-warn/25">
          Aucun candidat n&apos;a encore composé : les chiffres ci-dessous comptent les {rows.length} copie(s) d&apos;essai de l&apos;équipe.
        </p>
      )}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Inscrits" value={invited} hint={notStarted ? `${notStarted} pas encore venu(s)` : invited ? "tous sont venus" : <Link href={`/admin/tests/${id}/invites`} className="underline">inscrire des candidats</Link>} />
        <Kpi label="Copies rendues" value={s.done} hint={s.live ? <span className="text-[#1d4ed8]">{s.live} en cours</span> : undefined} tone={s.live ? "live" : undefined} />
        <Kpi label="Moyenne" value={s.avg == null ? "—" : <>{fmt20(s.avg)}<span className="text-base text-faint font-normal">/20</span></>} hint={`réussite à ${pass}/20`} />
        <Kpi label="Réussis" value={s.pass} tone="ok" hint={s.done ? `${Math.round((s.pass / s.done) * 100)} % des copies` : undefined} />
        <Kpi label="À statuer / échoués" value={<>{s.review}<span className="text-faint font-normal"> / </span><span className="text-danger">{s.fail}</span></>} tone="warn" />
      </section>
      {s.done > 0 && <VerdictBar pass={s.pass} review={s.review} fail={s.fail} />}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="h2">Candidats</h2>
          <span className="text-xs text-muted">Cliquez sur un nom pour ouvrir sa copie et sa fiche jury.</span>
        </div>
        <RosterTable rows={rows} thresholds={{ pass, fail }} emptyText="Aucun candidat n'a encore passé cette épreuve." />
      </section>
    </main>
  );
}
