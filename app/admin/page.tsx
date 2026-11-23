import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRoster, summarize, type RosterRow } from "@/lib/admin/roster";
import { Donut, PageTitle, Pill, examState, fmt20, fmtDay, fmtTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { key: "live", title: "En cours" },
  { key: "open", title: "Ouverts" },
  { key: "soon", title: "À venir" },
  { key: "done", title: "Terminés" },
  { key: "draft", title: "Brouillons", hint: "Non publiés : invisibles pour les étudiants." },
];
const STRIPES = "bg-[repeating-linear-gradient(135deg,transparent_0,transparent_12px,rgba(15,22,64,0.03)_12px,rgba(15,22,64,0.03)_24px)]";

/** Examens rangés par période (en cours, à venir, terminés, brouillons), filtrables par classe. */
export default async function AdminHome({ searchParams }: { searchParams: Promise<{ promo?: string; q?: string }> }) {
  const { promo = "", q = "" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "proctor") redirect("/dashboard");
  const isAdmin = profile?.role === "admin";

  const [{ data: tests }, { data: questions }] = await Promise.all([
    supabase.from("tests").select("id, title, description, is_published, formation, duration_minutes, opens_at, closes_at, created_at, require_webcam, draw_count").order("created_at", { ascending: false }),
    supabase.from("questions").select("test_id"),
  ]);
  const all = tests || [];
  const roster = await loadRoster(supabase as any, all.map((t: any) => t.id));
  const byTest = new Map<string, RosterRow[]>();
  roster.forEach((r) => byTest.set(r.test_id, [...(byTest.get(r.test_id) || []), r]));
  const nQ = new Map<string, number>(); (questions || []).forEach((x: any) => nQ.set(x.test_id, (nQ.get(x.test_id) || 0) + 1));

  const promos = Array.from(new Set(all.map((t: any) => t.formation).filter(Boolean))).sort() as string[];
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const shown = all.filter((t: any) => (!promo || (promo === "commune" ? !t.formation : t.formation === promo))
    && (!q || norm(`${t.title} ${t.description || ""} ${t.formation || ""}`).includes(norm(q))));
  const copies = roster.filter((r) => !r.preview && r.score20 != null).length;
  const href = (p: Record<string, string>) => {
    const u = new URLSearchParams({ ...(promo && { promo }), ...(q && { q }), ...p });
    [...u.keys()].forEach((k) => !u.get(k) && u.delete(k));
    return `/admin${u.toString() ? `?${u}` : ""}`;
  };

  const cards = shown.map((t: any) => {
    const rows = byTest.get(t.id) || [];
    const real = rows.filter((r) => !r.preview);
    const s = summarize(real.some((r) => !r.absent) ? real : rows);
    return { t, s, st: examState(t, s.live) };
  });
  // Dans chaque section : les prochains d'abord pour « à venir », les plus récents ensuite
  const at = (t: any) => +new Date(t.opens_at || t.created_at);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageTitle>Examens</PageTitle>
          <p className="mt-1.5 text-[15px] text-muted">{all.length} examen(s) · {copies} copie(s) rendue(s)</p>
        </div>
        {isAdmin && <Link href="/admin/new" className="btn !px-5 !py-2.5 text-[15px] shadow-[0_10px_24px_-12px_rgba(232,96,11,0.8)]">+ Nouvelle épreuve</Link>}
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action="/admin" className="relative w-full sm:w-64">
          {promo && <input type="hidden" name="promo" value={promo} />}
          <svg aria-hidden viewBox="0 0 20 20" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
          <input name="q" defaultValue={q} placeholder="Rechercher un examen, un bloc" className="w-full rounded-xl border border-line-strong bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
        </form>
        {promos.length > 0 && (
          <div className="inline-flex flex-wrap rounded-xl bg-fg/[0.06] p-1">
            {[{ k: "", l: "Toutes les classes" }, ...promos.map((p) => ({ k: p, l: p })), { k: "commune", l: "Communes" }].map((x) => (
              <Link key={x.k || "all"} href={href({ promo: x.k })}
                className={`rounded-lg px-3.5 py-1.5 text-sm transition-all ${promo === x.k ? "bg-surface font-medium text-fg shadow-[0_1px_3px_rgba(15,22,64,0.12)]" : "text-fg/70 hover:text-fg"}`}>{x.l}</Link>
            ))}
          </div>
        )}
      </div>

      {!cards.length && (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
          <p className="text-muted">{all.length ? "Aucun examen ne correspond." : "Aucun examen pour l'instant."}</p>
          {isAdmin && !all.length && <Link href="/admin/new" className="btn mt-4">Créer le premier examen</Link>}
        </div>
      )}

      {SECTIONS.map((sec) => {
        const list = cards.filter((c) => c.st.key === sec.key).sort((a, b) => (sec.key === "soon" ? at(a.t) - at(b.t) : at(b.t) - at(a.t)));
        if (!list.length) return null;
        return (
          <section key={sec.key} className="mt-8">
            <h2 className="flex items-baseline gap-3 text-xs font-bold uppercase tracking-[0.16em] text-fg/70">
              {sec.title}<span className="text-fg/45">{list.length}</span>
            </h2>
            {sec.hint && <p className="mt-1 text-sm text-muted">{sec.hint}</p>}
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map(({ t, s, st }) => {
                const when = t.opens_at
                  ? `${fmtDay(t.opens_at)} · ${t.closes_at && new Date(t.closes_at).toDateString() === new Date(t.opens_at).toDateString() ? `${fmtTime(t.opens_at)} à ${fmtTime(t.closes_at)}` : `dès ${fmtTime(t.opens_at)}`}`
                  : t.closes_at ? `jusqu'au ${fmtDay(t.closes_at)}` : "Sans date fixée";
                const qn = nQ.get(t.id) || 0;
                return (
                  <Link key={t.id} href={`/admin/tests/${t.id}`}
                    className={`group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,22,64,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(15,22,64,0.45)] before:absolute before:inset-y-0 before:left-0 before:w-[3px] ${st.accent} ${st.key === "draft" ? STRIPES : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill cls={st.pill}><span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</Pill>
                      <Pill cls="bg-[#5561c9]/[0.12] text-navy ring-[#5561c9]/20">{t.formation || "Toutes les promos"}</Pill>
                    </div>
                    <h3 className="mt-3 text-lg font-bold leading-snug text-navy">{t.title}</h3>
                    {t.description && <p className="mt-1 line-clamp-1 text-sm text-muted">{String(t.description).split("\n")[0]}</p>}
                    <ul className="mt-3 space-y-1.5 text-sm text-fg/75">
                      <li className="flex items-center gap-2">
                        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4.5" width="14" height="12" rx="2" /><path d="M3 8.5h14M7 3v3M13 3v3" /></svg>{when}
                      </li>
                      <li className="flex items-center gap-2">
                        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7" /><path d="M8 8a2 2 0 1 1 2.7 1.9c-.5.2-.7.6-.7 1.1M10 13.5v.1" /></svg>
                        {t.draw_count ? `${t.draw_count} sur ${qn}` : qn} question{qn > 1 ? "s" : ""} · {t.duration_minutes} min{t.require_webcam ? " · surveillé" : ""}
                      </li>
                    </ul>
                    <div className="mt-auto pt-4">
                      <div className="flex items-center gap-4 border-t border-line pt-4">
                        <Donut value={s.avg} />
                        <div className="leading-tight">
                          <div className="text-lg font-bold tabular-nums text-navy">{fmt20(s.avg)}</div>
                          <div className="text-xs text-muted">moyenne</div>
                        </div>
                        <div className="leading-tight">
                          <div className="text-lg font-bold tabular-nums text-navy">{s.done}</div>
                          <div className="text-xs text-muted">copie{s.done > 1 ? "s" : ""}</div>
                        </div>
                        {s.live > 0 && <span className="text-xs font-semibold text-[#1f7a44]">{s.live} en direct</span>}
                        <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-fg/[0.06] text-fg/60 transition-colors group-hover:bg-navy group-hover:text-white">›</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
