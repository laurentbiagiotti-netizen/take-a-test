import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteTestButton from "@/components/DeleteTestButton";
import PreviewButton from "@/components/admin/PreviewButton";

const count = <T,>(rows: T[] | null, key: (r: T) => string) => {
  const m = new Map<string, number>();
  for (const r of rows || []) m.set(key(r), (m.get(key(r)) || 0) + 1);
  return m;
};

export default async function AdminHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "proctor") redirect("/dashboard");
  const isAdmin = profile?.role === "admin";

  const [{ data: tests }, { data: questions }, { data: invites }, { data: attempts }] = await Promise.all([
    supabase.from("tests").select("id, title, is_published, formation, duration_minutes, draw_count, opens_at, closes_at, created_at").order("created_at", { ascending: false }),
    supabase.from("questions").select("test_id"),
    supabase.from("invites").select("test_id, email, preview"),
    supabase.from("attempts").select("test_id, status, paused_at, candidate:profiles(email)"),
  ]);
  const previews = new Set((invites || []).filter((i: any) => i.preview).map((i: any) => i.email));
  const real = (attempts || []).filter((a: any) => !previews.has(a.candidate?.email));
  const nQuestions = count(questions, (q: any) => q.test_id);
  const nInvites = count((invites || []).filter((i: any) => !i.preview), (i: any) => i.test_id);
  const nLive = count(real.filter((a: any) => a.status === "in_progress"), (a: any) => a.test_id);
  const nDone = count(real.filter((a: any) => ["submitted", "expired", "terminated"].includes(a.status)), (a: any) => a.test_id);
  const nPaused = count(real.filter((a: any) => a.status === "in_progress" && a.paused_at), (a: any) => a.test_id);
  const liveTotal = [...nLive.values()].reduce((a, b) => a + b, 0);
  const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h1">Examens</h1>
          <p className="text-sm text-muted mt-1">
            {(tests || []).length} épreuve(s)
            {liveTotal > 0 && <> · <span className="text-ok font-medium">{liveTotal} candidat(s) en train de composer</span></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <Link href="/admin/audit" className="btn-secondary">Journal</Link>}
          {isAdmin && <Link href="/admin/api" className="btn-secondary">API et webhooks</Link>}
          {isAdmin && <Link href="/admin/new" className="btn">+ Nouvelle épreuve</Link>}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {(tests || []).length === 0 && (
          <div className="card md:col-span-2 text-center py-12">
            <p className="text-muted">Aucune épreuve pour l&apos;instant.</p>
            {isAdmin && <Link href="/admin/new" className="btn mt-4">Créer la première épreuve</Link>}
          </div>
        )}
        {(tests || []).map((t: any) => {
          const q = nQuestions.get(t.id) || 0, inv = nInvites.get(t.id) || 0, live = nLive.get(t.id) || 0;
          const done = nDone.get(t.id) || 0, paused = nPaused.get(t.id) || 0;
          const window = t.opens_at || t.closes_at
            ? `${t.opens_at ? `du ${dateFr(t.opens_at)}` : ""}${t.closes_at ? ` au ${dateFr(t.closes_at)}` : ""}`.trim()
            : "";
          return (
            <article key={t.id} className="card flex flex-col gap-4 hover:border-line-strong transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {t.is_published ? <span className="badge-ok">publiée</span> : <span className="badge-muted">brouillon</span>}
                    {t.formation && <span className="text-muted">{t.formation}</span>}
                  </div>
                  <h2 className="font-semibold text-lg leading-snug mt-1.5">
                    {isAdmin ? <Link href={`/admin/tests/${t.id}`} className="hover:text-accent">{t.title}</Link> : t.title}
                  </h2>
                </div>
                {live > 0 && (
                  <Link href={`/admin/tests/${t.id}/live`} className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-ok border border-ok/40 rounded-full px-2.5 py-1 hover:bg-ok/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" aria-hidden />{live} en direct
                  </Link>
                )}
              </div>

              <dl className="grid grid-cols-4 gap-2 text-center">
                {[
                  { k: "questions", v: t.draw_count ? `${t.draw_count}/${q}` : String(q), hint: t.draw_count ? "tirées / dans la banque" : "" },
                  { k: "minutes", v: String(t.duration_minutes) },
                  { k: "invités", v: String(inv) },
                  { k: "copies", v: String(done) },
                ].map((s) => (
                  <div key={s.k} className="rounded-md bg-surface-2/70 border border-line py-2" title={s.hint}>
                    <dd className="font-display text-xl">{s.v}</dd>
                    <dt className="text-[11px] text-muted">{s.k}</dt>
                  </div>
                ))}
              </dl>
              {(window || paused > 0) && (
                <p className="text-xs text-muted -mt-1">
                  {window && <>Ouverte {window}</>}
                  {paused > 0 && <span className="text-warn">{window ? " · " : ""}{paused} en pause (scan de la pièce)</span>}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-auto pt-3 border-t border-line">
                {isAdmin && <Link href={`/admin/tests/${t.id}`} className="btn !py-1.5">Modifier</Link>}
                {isAdmin && <PreviewButton testId={t.id} className="btn-secondary !py-1.5" />}
                <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm ml-1" aria-label={`Suivi de ${t.title}`}>
                  {isAdmin && <Link href={`/admin/tests/${t.id}/invites`} className="text-muted hover:text-fg">Candidats</Link>}
                  <Link href={`/admin/tests/${t.id}/live`} className="text-muted hover:text-fg">En direct</Link>
                  <Link href={`/admin/tests/${t.id}/attempts`} className="text-muted hover:text-fg">Tentatives</Link>
                  <Link href={`/admin/tests/${t.id}/dashboard`} className="text-muted hover:text-fg">Tableau de bord</Link>
                </nav>
                {isAdmin && <span className="ml-auto"><DeleteTestButton id={t.id} title={t.title} /></span>}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
