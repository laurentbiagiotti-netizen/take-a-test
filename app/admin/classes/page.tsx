import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadRoster, summarize } from "@/lib/admin/roster";
import RosterTable from "@/components/admin/RosterTable";
import { Kpi, Pill, VerdictBar, fmt20 } from "@/components/admin/ui";
import { FORMATIONS } from "@/lib/excel/bank";

export const dynamic = "force-dynamic";
const COMMUNE = "Communes";

/** Vue par classe : les épreuves d'une promo et tous ses candidats avec leur note, toutes épreuves confondues. */
export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ classe?: string }> }) {
  const { classe } = await searchParams;
  const supabase = await createClient();
  const { data: tests } = await supabase.from("tests")
    .select("id, title, formation, is_published, verdict_pass, verdict_fail, created_at").order("created_at", { ascending: false });
  const all = tests || [];
  const roster = await loadRoster(supabase as any, all.map((t: any) => t.id));

  const known = FORMATIONS as readonly string[];
  const names = Array.from(new Set(all.map((t: any) => t.formation || COMMUNE)));
  names.sort((a, b) => (a === COMMUNE ? 1 : b === COMMUNE ? -1 : (known.indexOf(a) + 1 || 99) - (known.indexOf(b) + 1 || 99) || a.localeCompare(b)));
  const current = classe && names.includes(classe) ? classe : names[0];
  const testsOf = (c: string) => all.filter((t: any) => (t.formation || COMMUNE) === c);
  const realOf = (c: string) => { const ids = new Set(testsOf(c).map((t: any) => t.id)); return roster.filter((r) => ids.has(r.test_id) && !r.preview); };

  if (!current) {
    return (
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <h1 className="h1">Classes</h1>
        <div className="mt-6 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center text-muted">
          Aucune épreuve pour l&apos;instant. Chaque épreuve publiée pour une promo apparaîtra ici avec ses candidats.
        </div>
      </main>
    );
  }

  const cTests = testsOf(current);
  const ids = new Set(cTests.map((t: any) => t.id));
  const rows = roster.filter((r) => ids.has(r.test_id));
  const real = rows.filter((r) => !r.preview);
  const s = summarize(real.length ? real : rows);
  const people = new Set((real.length ? real : rows).map((r) => r.email)).size;
  const testMap = Object.fromEntries(cTests.map((t: any) => [t.id, { title: t.title, pass: t.verdict_pass, fail: t.verdict_fail }]));

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <header>
        <h1 className="h1">Classes</h1>
        <p className="mt-1 text-sm text-muted">Les épreuves et les candidats de chaque promo, toutes épreuves confondues.</p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Classes" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {names.map((c) => {
            const r = realOf(c), on = c === current;
            return (
              <Link key={c} href={`/admin/classes?classe=${encodeURIComponent(c)}`} aria-current={on ? "page" : undefined}
                className={`shrink-0 rounded-lg px-3.5 py-2.5 text-sm transition-colors ring-1 ring-inset ${on ? "bg-surface text-fg ring-accent shadow-sm" : "bg-transparent text-muted ring-transparent hover:bg-surface hover:text-fg"}`}>
                <div className="font-medium">{c}</div>
                <div className="text-xs text-faint">{testsOf(c).length} épreuve(s) · {new Set(r.map((x) => x.email)).size} candidat(s)</div>
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{current}</h2>
            {!real.length && rows.length > 0 && <span className="text-xs text-warn">Seules des copies d&apos;essai de l&apos;équipe pour l&apos;instant.</span>}
          </div>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Candidats" value={people} hint={`${s.done} copie(s) rendue(s)`} />
            <Kpi label="Moyenne" value={s.avg == null ? "—" : <>{fmt20(s.avg)}<span className="text-base font-normal text-faint">/20</span></>} />
            <Kpi label="Réussis" value={s.pass} tone="ok" hint={s.done ? `${Math.round((s.pass / s.done) * 100)} % des copies` : undefined} />
            <Kpi label="À statuer / échoués" value={<>{s.review}<span className="font-normal text-faint"> / </span><span className="text-danger">{s.fail}</span></>} tone="warn" />
          </section>
          {s.done > 0 && <VerdictBar pass={s.pass} review={s.review} fail={s.fail} />}

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">Épreuves</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {cTests.map((t: any) => {
                const tr = roster.filter((r) => r.test_id === t.id && !r.preview);
                const ts = summarize(tr);
                return (
                  <Link key={t.id} href={`/admin/tests/${t.id}`} className="group flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 hover:border-line-strong">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium group-hover:text-accent">{t.title}</div>
                      <div className="mt-0.5 text-xs text-muted">{ts.done} rendue(s) · moyenne {fmt20(ts.avg)}/20</div>
                    </div>
                    {t.is_published ? <Pill cls="bg-ok/10 text-ok ring-ok/25">Publiée</Pill> : <Pill cls="bg-fg/5 text-muted ring-fg/10">Brouillon</Pill>}
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">Candidats</h3>
            <RosterTable rows={rows} tests={testMap} showTest emptyText="Aucun candidat de cette promo n'a encore composé." />
          </section>
        </div>
      </div>
    </main>
  );
}
