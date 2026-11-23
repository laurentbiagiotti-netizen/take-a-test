import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadRoster, summarize } from "@/lib/admin/roster";
import ClassMatrix, { type MatrixExam, type MatrixStudent } from "@/components/admin/ClassMatrix";
import { Breadcrumb, Donut, PageTitle, Stat, examState, fmt20, fmtDay, tier } from "@/components/admin/ui";
import { FORMATIONS } from "@/lib/excel/bank";
import AddClass from "@/components/admin/AddClass";
import Accommodations from "@/components/admin/Accommodations";

export const dynamic = "force-dynamic";
const COMMUNE = "Communes";

/** Classes : la liste des promos, puis pour chacune un tableau étudiants × examens. */
export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ classe?: string }> }) {
  const { classe } = await searchParams;
  const supabase = await createClient();
  const { data: tests } = await supabase.from("tests")
    .select("id, title, formation, is_published, opens_at, closes_at, created_at").order("created_at", { ascending: true });
  const all = tests || [];
  const { data: created } = await supabase.from("classes").select("name, campus");
  const roster = (await loadRoster(supabase as any, all.map((t: any) => t.id))).filter((r) => !r.preview);

  const known = FORMATIONS as readonly string[];
  const names = Array.from(new Set([...all.map((t: any) => t.formation || COMMUNE), ...(created || []).map((c: any) => c.name)]));
  names.sort((a, b) => (a === COMMUNE ? 1 : b === COMMUNE ? -1 : (known.indexOf(a) + 1 || 99) - (known.indexOf(b) + 1 || 99) || a.localeCompare(b)));
  const testsOf = (c: string) => all.filter((t: any) => (t.formation || COMMUNE) === c);
  const rowsOf = (c: string) => { const ids = new Set(testsOf(c).map((t: any) => t.id)); return roster.filter((r) => ids.has(r.test_id)); };

  // Liste des classes
  if (!classe || !names.includes(classe)) {
    return (
      <main className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <PageTitle>Classes</PageTitle>
            <p className="mt-1.5 text-[15px] text-muted">{names.length} classe(s) · les notes de chaque étudiant, examen par examen.</p>
          </div>
          <AddClass />
        </div>
        {!names.length && (
          <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
            <p className="font-display text-lg uppercase text-navy">Aucune classe pour l&apos;instant</p>
            <p className="mt-1 text-sm text-muted">Créez une classe avec « + Classe », ou publiez un examen pour une promo : elle apparaîtra ici.</p>
            <Link href="/admin/new" className="btn mt-4">Créer un examen</Link>
          </div>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {names.map((c) => {
            const r = rowsOf(c), s = summarize(r);
            const people = new Set(r.map((x) => x.email.toLowerCase())).size;
            return (
              <Link key={c} href={`/admin/classes?classe=${encodeURIComponent(c)}`}
                className="group flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,22,64,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(15,22,64,0.45)]">
                <h2 className="font-display text-xl uppercase text-navy">{c}</h2>
                <p className="mt-1 text-sm text-muted">{people} étudiant(s) · {testsOf(c).length} examen(s)</p>
                <div className="mt-5 flex items-center gap-4 border-t border-line pt-4">
                  <Donut value={s.avg} />
                  <div className="leading-tight"><div className={`text-lg font-bold tabular-nums ${tier(s.avg).text}`}>{fmt20(s.avg)}</div><div className="text-xs text-muted">moyenne</div></div>
                  <div className="leading-tight"><div className="text-lg font-bold tabular-nums text-navy">{s.done}</div><div className="text-xs text-muted">copies</div></div>
                  <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-fg/[0.06] text-fg/60 transition-colors group-hover:bg-navy group-hover:text-white">›</span>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-8"><Accommodations /></div>
      </main>
    );
  }

  // Détail d'une classe
  const cTests = testsOf(classe).sort((a: any, b: any) => +new Date(a.opens_at || a.created_at) - +new Date(b.opens_at || b.created_at));
  const rows = rowsOf(classe);
  const students = new Map<string, MatrixStudent>();
  for (const r of rows) {
    const k = r.email.toLowerCase();
    const s = students.get(k) || { key: k, first: r.first, last: r.last, email: r.email, cells: {}, avg: null };
    if (!r.absent && (!s.first || !s.last)) { s.first = r.first; s.last = r.last; }
    if (r.named && !r.absent) { s.first = r.first; s.last = r.last; }
    s.cells[r.test_id] = { note: r.score20, score: r.score, max: r.max, status: r.absent ? "absent" : r.status, attempt_id: r.attempt_id };
    students.set(k, s);
  }
  const list = [...students.values()].map((s) => {
    const notes = Object.values(s.cells).map((c) => c?.note).filter((n): n is number => n != null);
    return { ...s, avg: notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null };
  }).sort((a, b) => a.last.localeCompare(b.last, "fr"));
  const exams: MatrixExam[] = cTests.map((t: any) => ({
    id: t.id, title: t.title, date: t.opens_at || t.closes_at || t.created_at, state: examState(t).key,
    invitedCount: rows.filter((r) => r.test_id === t.id).length,
  }));
  const s = summarize(rows);
  const passed = exams.filter((e) => e.state === "done" || rows.some((r) => r.test_id === e.id && r.score20 != null)).length;
  const next = cTests.filter((t: any) => t.opens_at && +new Date(t.opens_at) > Date.now()).sort((a: any, b: any) => +new Date(a.opens_at) - +new Date(b.opens_at))[0];
  const missing = rows.filter((r) => r.absent && ["done", "live", "open"].includes(exams.find((e) => e.id === r.test_id)?.state || "")).length;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
      <Breadcrumb items={[{ href: "/admin/classes", label: "Classes" }, { label: classe }]} />
      <div className="mt-5">
        <PageTitle>{classe}</PageTitle>
        <p className="mt-1.5 text-[15px] text-muted">{list.length} étudiant(s) · {cTests.length} examen(s)</p>
      </div>
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat dark label="Moyenne de la classe" value={fmt20(s.avg)} unit="/20" hint={`sur ${s.done} copie(s)`} />
        <Stat label="Examens passés" value={passed} unit={`/${cTests.length}`} hint={next ? `prochain ${fmtDay(next.opens_at)}` : "aucun examen à venir"} />
        <Stat label="Copies manquantes" value={missing} hint="copies attendues non rendues" tone={missing ? "text-[#c23b17]" : undefined} />
      </section>
      {!cTests.length ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <p className="font-display text-lg uppercase text-navy">Aucun examen pour cette classe</p>
          <p className="mt-1 text-sm text-muted">Créez un examen puis publiez-le pour « {classe} » : les étudiants et leurs notes s&apos;afficheront ici.</p>
          <Link href="/admin/new" className="btn mt-4">Créer un examen</Link>
        </div>
      ) : !list.length ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <p className="font-display text-lg uppercase text-navy">Aucun étudiant inscrit</p>
          <p className="mt-1 text-sm text-muted">Inscrivez les étudiants à un examen de la classe pour les voir ici.</p>
          <Link href={`/admin/tests/${cTests[0].id}/invites`} className="btn mt-4">Inscrire des étudiants</Link>
        </div>
      ) : <div className="mt-5"><ClassMatrix exams={exams} students={list} className={classe} /></div>}
      <div className="mt-6"><Accommodations students={list.map((x) => ({ email: x.email, name: `${x.first} ${x.last}`.trim() }))} /></div>
    </main>
  );
}
