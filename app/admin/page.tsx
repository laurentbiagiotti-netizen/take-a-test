import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublishButton from "@/components/admin/PublishButton";
import { loadRoster, summarize, type RosterRow } from "@/lib/admin/roster";
import { Pill, Score, VerdictBar, VerdictPill, fmt20, fmtDate } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const STATUTS = [{ k: "", l: "Toutes" }, { k: "publiees", l: "Publiées" }, { k: "brouillons", l: "Brouillons" }];

/** Examens : chaque épreuve avec ses chiffres et ses candidats (prénom, nom, note) d'un coup d'œil. */
export default async function AdminHome({ searchParams }: { searchParams: Promise<{ promo?: string; statut?: string; q?: string }> }) {
  const { promo = "", statut = "", q = "" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "proctor") redirect("/dashboard");
  const isAdmin = profile?.role === "admin";

  const [{ data: tests }, { data: questions }, { data: invites }] = await Promise.all([
    supabase.from("tests").select("id, title, is_published, formation, duration_minutes, opens_at, closes_at, created_at, verdict_pass, verdict_fail").order("created_at", { ascending: false }),
    supabase.from("questions").select("test_id"),
    supabase.from("invites").select("test_id, preview"),
  ]);
  const all = tests || [];
  const roster = await loadRoster(supabase as any, all.map((t: any) => t.id));
  const byTest = new Map<string, RosterRow[]>();
  roster.forEach((r) => byTest.set(r.test_id, [...(byTest.get(r.test_id) || []), r]));
  const nQ = new Map<string, number>(); (questions || []).forEach((x: any) => nQ.set(x.test_id, (nQ.get(x.test_id) || 0) + 1));
  const nInv = new Map<string, number>(); (invites || []).filter((i: any) => !i.preview).forEach((i: any) => nInv.set(i.test_id, (nInv.get(i.test_id) || 0) + 1));

  const promos = Array.from(new Set(all.map((t: any) => t.formation).filter(Boolean))).sort() as string[];
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const shown = all.filter((t: any) =>
    (!promo || (promo === "commune" ? !t.formation : t.formation === promo))
    && (!statut || (statut === "publiees" ? t.is_published : !t.is_published))
    && (!q || norm(t.title).includes(norm(q))));
  const liveTotal = roster.filter((r) => r.status === "in_progress" && !r.preview).length;
  const href = (p: Record<string, string>) => {
    const u = new URLSearchParams({ ...(promo && { promo }), ...(statut && { statut }), ...(q && { q }), ...p });
    [...u.keys()].forEach((k) => !u.get(k) && u.delete(k));
    return `/admin${u.toString() ? `?${u}` : ""}`;
  };
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-sm ring-1 ring-inset transition-colors ${on ? "bg-fg text-white ring-fg" : "bg-surface text-muted ring-line hover:text-fg"}`;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h1">Examens</h1>
          <p className="mt-1 text-sm text-muted">
            {all.length} épreuve(s) · {all.filter((t: any) => t.is_published).length} publiée(s)
            {liveTotal > 0 && <> · <span className="font-medium text-[#1d4ed8]">{liveTotal} candidat(s) en train de composer</span></>}
          </p>
        </div>
        <form action="/admin" className="relative w-full sm:w-72">
          {promo && <input type="hidden" name="promo" value={promo} />}
          {statut && <input type="hidden" name="statut" value={statut} />}
          <input name="q" defaultValue={q} placeholder="Rechercher une épreuve" className="input !pl-9" />
          <svg aria-hidden viewBox="0 0 20 20" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
        </form>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {STATUTS.map((s) => <Link key={s.k || "t"} href={href({ statut: s.k })} className={chip(statut === s.k)}>{s.l}</Link>)}
        {promos.length > 0 && <span className="mx-1 h-5 w-px bg-line" aria-hidden />}
        {promos.length > 0 && [{ k: "", l: "Toutes les promos" }, ...promos.map((p) => ({ k: p, l: p })), { k: "commune", l: "Communes" }].map((x) => (
          <Link key={x.k || "all"} href={href({ promo: x.k })} className={chip(promo === x.k)}>{x.l}</Link>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {shown.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
            <p className="text-muted">{all.length ? "Aucune épreuve ne correspond à ces filtres." : "Aucune épreuve pour l'instant."}</p>
            {isAdmin && !all.length && <Link href="/admin/new" className="btn mt-4">Créer la première épreuve</Link>}
          </div>
        )}
        {shown.map((t: any) => {
          const rows = byTest.get(t.id) || [];
          const real = rows.filter((r) => !r.preview);
          const list = real.length ? real : rows;
          const s = summarize(list);
          const top = [...list].sort((a, b) => (a.status === "in_progress" ? -1 : 0) - (b.status === "in_progress" ? -1 : 0) || (b.score20 ?? -1) - (a.score20 ?? -1)).slice(0, 5);
          const qn = nQ.get(t.id) || 0;
          return (
            <article key={t.id} className="group rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(20,26,51,0.04)] transition-shadow hover:shadow-[0_1px_2px_rgba(20,26,51,0.04),0_12px_32px_-18px_rgba(20,26,51,0.25)]">
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <div className="flex flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {t.is_published
                      ? <Pill cls="bg-ok/10 text-ok ring-ok/25"><span className="h-1.5 w-1.5 rounded-full bg-ok" />Publiée</Pill>
                      : <Pill cls="bg-fg/5 text-muted ring-fg/10">Brouillon</Pill>}
                    <span className="text-muted">{t.formation || "Toutes les promos"}</span>
                    {s.live > 0 && <Link href={`/admin/tests/${t.id}/live`}><Pill cls="bg-[#2563eb]/10 text-[#1d4ed8] ring-[#2563eb]/25"><span className="h-1.5 w-1.5 rounded-full bg-[#2563eb] animate-pulse" />{s.live} en direct</Pill></Link>}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold leading-snug">
                    <Link href={`/admin/tests/${t.id}`} className="hover:text-accent">{t.title}</Link>
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {qn} question(s) · {t.duration_minutes} min
                    {(t.opens_at || t.closes_at) && <> · {t.opens_at ? fmtDate(t.opens_at) : "…"} → {t.closes_at ? fmtDate(t.closes_at) : "…"}</>}
                  </p>

                  <dl className="mt-4 grid grid-cols-3 gap-3">
                    <div><dt className="text-[11px] uppercase tracking-wide text-faint">Inscrits</dt><dd className="text-xl font-semibold tabular-nums">{nInv.get(t.id) || 0}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-wide text-faint">Rendues</dt><dd className="text-xl font-semibold tabular-nums">{s.done}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-wide text-faint">Moyenne</dt><dd className="text-xl font-semibold tabular-nums">{fmt20(s.avg)}<span className="text-sm font-normal text-faint">/20</span></dd></div>
                  </dl>
                  <div className="mt-3"><VerdictBar pass={s.pass} review={s.review} fail={s.fail} /></div>
                  <div className="mt-1.5 flex gap-3 text-[11px] text-muted tabular-nums">
                    <span><span className="text-ok font-medium">{s.pass}</span> réussi(s)</span>
                    <span><span className="text-warn font-medium">{s.review}</span> à statuer</span>
                    <span><span className="text-danger font-medium">{s.fail}</span> échoué(s)</span>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                    <Link href={`/admin/tests/${t.id}`} className="btn !py-1.5">Ouvrir</Link>
                    {isAdmin && <Link href={`/admin/tests/${t.id}/questions`} className="btn-secondary !py-1.5">Questions</Link>}
                    {isAdmin && !t.is_published && <PublishButton id={t.id} title={t.title} published={false} questions={qn} formation={t.formation} className="btn-secondary !py-1.5" />}
                  </div>
                </div>

                <div className="border-t border-line lg:border-t-0 lg:border-l bg-surface-2/60 rounded-b-xl lg:rounded-bl-none lg:rounded-r-xl">
                  {top.length ? (
                    <>
                      <ul className="divide-y divide-line">
                        {top.map((r) => (
                          <li key={r.attempt_id}>
                            <Link href={`/admin/attempts/${r.attempt_id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent">
                                {(r.first[0] || "") + (r.last[0] || "")}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {r.first} <span className="font-semibold tracking-wide">{r.last}</span>
                                {r.preview && <span className="ml-1.5 rounded bg-fg/5 px-1 text-[10px] uppercase text-muted">essai</span>}
                              </span>
                              <span className="hidden sm:inline"><Score value={r.score20} pass={t.verdict_pass ?? 10} fail={t.verdict_fail ?? 8} /></span>
                              <VerdictPill verdict={r.verdict} status={r.status} forced={r.forced} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <Link href={`/admin/tests/${t.id}`} className="block border-t border-line px-5 py-2.5 text-center text-xs font-medium text-muted hover:text-fg">
                        {list.length > top.length ? `Voir les ${list.length} candidats →` : "Voir le détail →"}
                      </Link>
                    </>
                  ) : (
                    <div className="flex h-full min-h-[10rem] flex-col items-center justify-center gap-2 px-6 py-8 text-center text-sm text-muted">
                      <span>Aucun candidat n&apos;a encore passé cette épreuve.</span>
                      {isAdmin && <Link href={`/admin/tests/${t.id}/invites`} className="text-xs font-medium text-accent hover:underline">Inscrire des candidats →</Link>}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
