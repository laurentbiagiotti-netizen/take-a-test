import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadRoster, type RosterRow } from "@/lib/admin/roster";
import { PageTitle, Stat, fmt20, fmtDay, tier } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pilotage" };

const COMMUNE = "Communes";
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const pctTxt = (v: number | null) => (v == null ? "—" : `${v} %`);
/** Année scolaire d'une date : de septembre à août. */
const schoolYear = (d: string) => { const x = new Date(d); const y = x.getMonth() >= 8 ? x.getFullYear() : x.getFullYear() - 1; return `${y}-${y + 1}`; };

function figures(rows: RosterRow[]) {
  const invited = rows.length;
  const came = rows.filter((r) => !r.absent);
  const done = came.filter((r) => r.score20 != null);
  const pass = done.filter((r) => r.verdict === "pass").length;
  const avg = done.length ? done.reduce((s, r) => s + (r.score20 || 0), 0) / done.length : null;
  return { invited, came: came.length, missing: invited - came.length, done: done.length, pass, participation: pct(came.length, invited), success: pct(pass, done.length), avg };
}

function Bar({ value, tone = "bg-navy" }: { value: number | null; tone?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-fg/[0.08]"><div className={`h-full rounded-full ${tone}`} style={{ width: `${value ?? 0}%` }} /></div>
      <span className="w-12 text-sm tabular-nums">{pctTxt(value)}</span>
    </div>
  );
}
const successTone = (v: number | null) => (v == null ? "bg-fg/20" : v >= 70 ? "bg-[#2fa862]" : v >= 50 ? "bg-[#5561c9]" : v >= 30 ? "bg-[#f08a3e]" : "bg-[#c23b17]");

function Table({ title, desc, first, lines }: { title: string; desc?: string; first: string; lines: { key: string; label: React.ReactNode; sub?: string; f: ReturnType<typeof figures> }[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
      <div className="px-5 pt-5">
        <h2 className="font-display text-lg uppercase text-navy">{title}</h2>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-y border-line bg-surface-2/60 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-fg/60">
              <th className="px-5 py-2.5">{first}</th><th className="px-3 py-2.5 text-right">Convoqués</th><th className="px-3 py-2.5 text-right">Ont passé</th>
              <th className="px-3 py-2.5 text-right">Pas passé</th><th className="px-3 py-2.5">Participation</th><th className="px-3 py-2.5">Réussite</th><th className="px-5 py-2.5 text-right">Moyenne</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-b border-line last:border-b-0 hover:bg-fg/[0.02]">
                <td className="px-5 py-3"><div className="font-medium text-fg">{l.label}</div>{l.sub && <div className="text-xs text-muted">{l.sub}</div>}</td>
                <td className="px-3 py-3 text-right tabular-nums">{l.f.invited}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-navy">{l.f.came}</td>
                <td className={`px-3 py-3 text-right tabular-nums ${l.f.missing ? "font-semibold text-[#b3361a]" : "text-muted"}`}>{l.f.missing}</td>
                <td className="px-3 py-3"><Bar value={l.f.participation} /></td>
                <td className="px-3 py-3"><Bar value={l.f.success} tone={successTone(l.f.success)} /></td>
                <td className={`px-5 py-3 text-right font-bold tabular-nums ${tier(l.f.avg).text}`}>{fmt20(l.f.avg)}</td>
              </tr>
            ))}
            {!lines.length && <tr><td colSpan={7} className="px-5 py-10 text-center text-muted">Aucune donnée sur cette période.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Pilotage : participation et réussite par classe, campus, examen et domaine, et évolution d'une année sur l'autre. */
export default async function Pilotage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const { annee } = await searchParams;
  const supabase = await createClient();
  const { data: tests } = await supabase.from("tests").select("id, title, formation, campus, is_published, opens_at, created_at").order("created_at", { ascending: false });
  const all = (tests || []).map((t: any) => ({ ...t, year: schoolYear(t.opens_at || t.created_at) }));
  const roster = (await loadRoster(supabase as any, all.map((t) => t.id))).filter((r) => !r.preview);
  const byTest = new Map<string, RosterRow[]>();
  for (const r of roster) { const l = byTest.get(r.test_id) || []; l.push(r); byTest.set(r.test_id, l); }

  const years = Array.from(new Set(all.map((t) => t.year))).sort().reverse();
  const year = annee === "toutes" ? "toutes" : years.includes(annee || "") ? (annee as string) : years[0] || "toutes";
  const scope = all.filter((t) => year === "toutes" || t.year === year);
  const rowsOf = (list: typeof all) => list.flatMap((t) => byTest.get(t.id) || []);
  const group = (key: (t: (typeof all)[number]) => string) => {
    const m = new Map<string, typeof all>();
    for (const t of scope) { const k = key(t); m.set(k, [...(m.get(k) || []), t]); }
    return [...m.entries()].map(([k, list]) => ({ key: k, list, f: figures(rowsOf(list)) })).filter((g) => g.f.invited > 0).sort((a, b) => a.key.localeCompare(b.key, "fr"));
  };
  const total = figures(rowsOf(scope));
  const classes = group((t) => t.formation || COMMUNE);
  const campuses = group((t) => t.campus || "Non précisé");
  const exams = scope.map((t) => ({ t, f: figures(byTest.get(t.id) || []) })).filter((x) => x.f.invited > 0);

  const dom = new Map<string, { score: number; max: number; n: number }>();
  for (const r of rowsOf(scope)) for (const d of r.domains || []) {
    const x = dom.get(d.domain) || { score: 0, max: 0, n: 0 }; x.score += d.score; x.max += d.max; x.n += 1; dom.set(d.domain, x);
  }
  const domains = [...dom.entries()].map(([k, v]) => ({ k, ...v, ratio: pct(v.score, v.max) })).sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0));

  const yearly = [...years].reverse().map((y) => ({ y, f: figures(rowsOf(all.filter((t) => t.year === y))), n: all.filter((t) => t.year === y).length }));
  const delta = (cur: number | null, prev: number | null, unit = " pts") => cur == null || prev == null ? null : (
    <span className={`ml-2 text-xs font-semibold ${cur - prev >= 0 ? "text-[#1f7a44]" : "text-[#b3361a]"}`}>{cur - prev >= 0 ? "+" : "−"}{(Math.abs(Math.round((cur - prev) * 10)) / 10).toString().replace(".", ",")}{unit}</span>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle>Pilotage</PageTitle>
          <p className="mt-1.5 text-[15px] text-muted">Qui a passé ses examens, qui ne les a pas passés, et le taux de réussite par classe.</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-fg/[0.06] p-1 text-sm">
          {[...years, "toutes"].map((y) => (
            <Link key={y} href={`/admin/pilotage?annee=${y}`} className={`rounded-lg px-3 py-1.5 ${y === year ? "bg-surface font-semibold text-navy shadow-sm" : "text-fg/70 hover:text-fg"}`}>{y === "toutes" ? "Toutes les années" : y}</Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Convocations" value={total.invited} hint={`${scope.length} examen(s)`} />
        <Stat dark label="Ont passé l'examen" value={total.came} hint={`${pctTxt(total.participation)} de participation`} />
        <Stat label="N'ont pas passé" value={total.missing} tone={total.missing ? "text-[#c23b17]" : undefined} hint={`${pctTxt(pct(total.missing, total.invited))} des convoqués`} />
        <Stat label="Taux de réussite" value={total.success ?? "—"} unit={total.success != null ? "%" : undefined} hint={`${total.pass} réussite(s) sur ${total.done} copie(s)`} />
        <Stat label="Moyenne" value={fmt20(total.avg)} unit="/20" tone={tier(total.avg).text} />
      </div>

      <div className="mt-6 space-y-6">
        <Table title="Par classe" first="Classe" desc="Une convocation = un étudiant inscrit à un examen. « Pas passé » : inscrit mais jamais entré dans l'épreuve."
          lines={classes.map((c) => ({ key: c.key, f: c.f, sub: `${c.list.length} examen(s)`,
            label: c.key === COMMUNE ? c.key : <Link className="hover:text-accent" href={`/admin/classes?classe=${encodeURIComponent(c.key)}`}>{c.key}</Link> }))} />

        <Table title="Par examen" first="Examen"
          lines={exams.map(({ t, f }) => ({ key: t.id, f, sub: `${t.formation || COMMUNE}${t.opens_at ? ` · ${fmtDay(t.opens_at)}` : ""}`,
            label: <Link className="hover:text-accent" href={`/admin/tests/${t.id}`}>{t.title}</Link> }))} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Table title="Par campus" first="Campus" lines={campuses.map((c) => ({ key: c.key, label: c.key, f: c.f, sub: `${c.list.length} examen(s)` }))} />
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
            <h2 className="font-display text-lg uppercase text-navy">Par domaine</h2>
            <p className="mt-1 text-sm text-muted">Part des points obtenus, du domaine le plus fragile au plus solide.</p>
            <div className="mt-4 space-y-3">
              {domains.map((d) => (
                <div key={d.k} className="flex items-center gap-3 text-sm">
                  <span className="w-44 shrink-0 truncate" title={d.k}>{d.k}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-fg/[0.08]"><div className={`h-full rounded-full ${successTone(d.ratio)}`} style={{ width: `${d.ratio ?? 0}%` }} /></div>
                  <span className="w-12 text-right font-semibold tabular-nums">{pctTxt(d.ratio)}</span>
                  <span className="w-20 text-right text-xs text-muted">{d.n} copie(s)</span>
                </div>
              ))}
              {!domains.length && <p className="py-6 text-center text-sm text-muted">Indiquez le domaine des questions pour voir cette répartition.</p>}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
          <h2 className="font-display text-lg uppercase text-navy">D&apos;une année sur l&apos;autre</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {yearly.map((y, i) => {
              const p = i > 0 ? yearly[i - 1].f : null;
              return (
                <div key={y.y} className="rounded-xl border border-line p-4">
                  <div className="flex items-baseline justify-between"><span className="font-display text-base text-navy">{y.y}</span><span className="text-xs text-muted">{y.n} examen(s) · {y.f.came} copie(s)</span></div>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between"><dt className="text-muted">Participation</dt><dd className="font-semibold tabular-nums">{pctTxt(y.f.participation)}{delta(y.f.participation, p?.participation ?? null)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Réussite</dt><dd className="font-semibold tabular-nums">{pctTxt(y.f.success)}{delta(y.f.success, p?.success ?? null)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Moyenne</dt><dd className="font-semibold tabular-nums">{fmt20(y.f.avg)} /20{delta(y.f.avg, p?.avg ?? null, "")}</dd></div>
                  </dl>
                </div>
              );
            })}
            {!yearly.length && <p className="text-sm text-muted">Aucun examen pour l&apos;instant.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
