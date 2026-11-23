import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadRoster, summarize } from "@/lib/admin/roster";
import { Avatar, Breadcrumb, NoteBar, PageTitle, Stat, VerdictPill, fmt20, fmtDay, fmtDuration } from "@/components/admin/ui";
import Accommodations from "@/components/admin/Accommodations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fiche étudiant" };

/** Fiche étudiant : tous ses examens, ses notes, ses fiches jury et son tiers-temps, retrouvés par son adresse mail. */
export default async function Etudiant({ params }: { params: Promise<{ email: string }> }) {
  const email = decodeURIComponent((await params).email).trim().toLowerCase();
  const supabase = await createClient();
  const [{ data: profiles }, { data: invites }, { data: acc }] = await Promise.all([
    supabase.from("profiles").select("id").ilike("email", email),
    supabase.from("invites").select("test_id").ilike("email", email),
    supabase.from("student_accommodations").select("extra_minutes, note").eq("email", email).maybeSingle(),
  ]);
  const pids = (profiles || []).map((p: any) => p.id);
  const { data: atts } = pids.length ? await supabase.from("attempts").select("test_id").in("candidate_id", pids) : { data: [] as any[] };
  const ids = Array.from(new Set([...(invites || []), ...(atts || [])].map((x: any) => x.test_id)));
  const { data: tests } = ids.length ? await supabase.from("tests").select("id, title, formation, campus, opens_at, created_at").in("id", ids) : { data: [] as any[] };
  const tmap = new Map((tests || []).map((t: any) => [t.id, t]));
  const rows = (await loadRoster(supabase as any, ids)).filter((r) => r.email.toLowerCase() === email && !r.preview)
    .sort((a, b) => +new Date(tmap.get(b.test_id)?.opens_at || tmap.get(b.test_id)?.created_at || 0) - +new Date(tmap.get(a.test_id)?.opens_at || tmap.get(a.test_id)?.created_at || 0));
  const s = summarize(rows);
  const who = rows.find((r) => r.named && !r.absent) || rows.find((r) => !r.absent) || rows[0];
  const name = who ? `${who.first} ${who.last}`.trim() : email;
  const classes = Array.from(new Set(rows.map((r) => tmap.get(r.test_id)?.formation).filter(Boolean))) as string[];
  const done = rows.filter((r) => !r.absent && r.status !== "in_progress");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <Breadcrumb items={[{ href: "/admin/classes", label: "Classes" }, ...(classes[0] ? [{ href: `/admin/classes?classe=${encodeURIComponent(classes[0])}`, label: classes[0] }] : []), { label: name }]} />
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Avatar first={who?.first || ""} last={who?.last || email} note={s.avg} size={52} />
        <div className="min-w-0">
          <PageTitle>{name}</PageTitle>
          <p className="mt-1 text-[15px] text-muted"><a className="hover:text-accent" href={`mailto:${email}`}>{email}</a>{classes.length ? ` · ${classes.join(", ")}` : ""}</p>
        </div>
        {done.length > 1 && <Link className="btn-secondary ml-auto" href={`/admin/fiches?ids=${done.map((r) => r.attempt_id).join(",")}`}>Toutes ses fiches jury (PDF)</Link>}
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat dark label="Moyenne" value={fmt20(s.avg)} unit="/20" hint={`sur ${s.done} copie(s)`} />
        <Stat label="Examens passés" value={s.total} unit={`/${rows.length}`} hint={`${s.pass} réussi(s), ${s.review} à statuer, ${s.fail} échoué(s)`} />
        <Stat label="Pas passés" value={s.absent} tone={s.absent ? "text-[#c23b17]" : undefined} hint="inscrit, jamais entré dans l'épreuve" />
        <Stat label="Tiers-temps" value={acc ? `+${acc.extra_minutes}` : "—"} unit={acc ? "min" : undefined} hint={acc?.note || (acc ? "appliqué à toutes ses épreuves" : "aucun aménagement")} />
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/60 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-fg/60">
                <th className="px-5 py-2.5">Examen</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Note</th><th className="px-3 py-2.5 text-right">Durée</th>
                <th className="px-3 py-2.5 text-center">Surveillance</th><th className="px-3 py-2.5">Décision</th><th className="px-5 py-2.5 text-right">Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const t = tmap.get(r.test_id);
                return (
                  <tr key={r.attempt_id} className={r.absent ? "text-muted" : ""}>
                    <td className="px-5 py-3"><Link className="font-semibold text-navy hover:text-accent" href={`/admin/tests/${r.test_id}`}>{t?.title || "Examen"}</Link><div className="text-xs text-muted">{t?.formation || "Toutes les promos"}</div></td>
                    <td className="whitespace-nowrap px-3 py-3 text-fg/80">{fmtDay(t?.opens_at || r.started_at) || "—"}</td>
                    <td className="px-3 py-3">{r.absent ? <span className="rounded-full border border-dashed border-line-strong px-2.5 py-0.5 text-xs">Pas passé</span> : <NoteBar value={r.score20} width="w-24" />}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{r.absent ? "" : r.status === "in_progress" ? "en cours" : fmtDuration(r.duration_s)}</td>
                    <td className="px-3 py-3 text-center text-xs">{r.absent ? "" : r.suspicion ? <span className="font-semibold text-[#b3361a]">Suspicion</span> : r.violations ? <span className="font-semibold text-[#a64a12]">{r.violations} infr.</span> : <span className="font-bold text-[#1f7a44]">RAS</span>}</td>
                    <td className="px-3 py-3">{!r.absent && <VerdictPill verdict={r.verdict} status={r.status} forced={r.forced} manual={r.needs_manual} />}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">{!r.absent && <><Link className="text-navy hover:text-accent" href={`/admin/attempts/${r.attempt_id}`}>Copie</Link><span className="mx-2 text-faint">·</span><Link className="text-navy hover:text-accent" href={`/admin/attempts/${r.attempt_id}/fiche`}>Fiche jury</Link></>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="px-6 py-14 text-center">
            <p className="font-display text-lg uppercase text-navy">Aucun examen pour cette adresse</p>
            <p className="mt-1 text-sm text-muted">Vérifiez l&apos;adresse mail, ou inscrivez l&apos;étudiant depuis l&apos;onglet « Inscriptions » d&apos;un examen.</p>
            <Link href="/admin" className="btn mt-4">Voir les examens</Link>
          </div>
        )}
      </section>
      <div className="mt-6"><Accommodations students={[{ email, name }]} /></div>
    </main>
  );
}
