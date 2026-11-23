import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadRoster } from "@/lib/admin/roster";
import { conflicts, span } from "@/lib/admin/calendar";
import { PageTitle, Stat, fmtDay, fmtTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aujourd'hui" };

type Todo = { key: string; title: string; detail: string; href: string; cta: string };

function Block({ title, tone, empty, items }: { title: string; tone: string; empty: string; items: Todo[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
      <h2 className="flex items-center gap-2.5 border-b border-line px-5 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-fg/75">
        <span className={`h-2 w-2 rounded-full ${items.length ? tone : "bg-fg/20"}`} />{title}<span className="text-fg/45">{items.length}</span>
      </h2>
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="group flex items-center gap-4 px-5 py-3 hover:bg-fg/[0.03]">
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-navy">{i.title}</span><span className="block truncate text-sm text-muted">{i.detail}</span></span>
                <span className="shrink-0 text-sm font-medium text-accent group-hover:underline">{i.cta} ›</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="px-5 py-5 text-sm text-muted">{empty}</p>}
    </section>
  );
}

/** Aujourd'hui : une seule liste de ce qui demande une action (en cours, à corriger, à statuer, conflits, à préparer). */
export default async function Aujourdhui() {
  const supabase = await createClient();
  const { data: tests } = await supabase.from("tests").select("id, title, formation, campus, room, is_published, opens_at, closes_at, duration_minutes, created_at").order("opens_at");
  const all = tests || [];
  const [roster, { data: qs }] = await Promise.all([
    loadRoster(supabase as any, all.map((t: any) => t.id)).then((r) => r.filter((x) => !x.preview)),
    supabase.from("questions").select("test_id"),
  ]);
  const nQ = new Map<string, number>(); (qs || []).forEach((q: any) => nQ.set(q.test_id, (nQ.get(q.test_id) || 0) + 1));
  const now = Date.now(), week = now + 7 * 86400000;
  const by = (id: string) => roster.filter((r) => r.test_id === id);
  const n = (k: number, one: string, many: string) => `${k} ${k > 1 ? many : one}`;

  const live: Todo[] = all.filter((t: any) => by(t.id).some((r) => r.status === "in_progress")).map((t: any) => {
    const rows = by(t.id); const k = rows.filter((r) => r.status === "in_progress").length;
    return { key: t.id, title: t.title, detail: `${n(k, "étudiant compose", "étudiants composent")} en ce moment${rows.some((r) => r.suspicion) ? " · une suspicion signalée" : ""}`, href: `/admin/tests/${t.id}/live`, cta: "Surveiller" };
  });
  const grade: Todo[] = all.map((t: any) => ({ t, k: by(t.id).filter((r) => r.needs_manual && !r.absent && r.status !== "in_progress").length })).filter((x) => x.k)
    .map(({ t, k }) => ({ key: t.id, title: t.title, detail: `${n(k, "copie avec une réponse rédigée", "copies avec une réponse rédigée")} à corriger à la main`, href: `/admin/tests/${t.id}`, cta: "Corriger" }));
  const decide: Todo[] = all.map((t: any) => ({ t, k: by(t.id).filter((r) => r.verdict === "review" && !r.forced).length })).filter((x) => x.k)
    .map(({ t, k }) => ({ key: t.id, title: t.title, detail: `${n(k, "décision", "décisions")} « À statuer » en attente du jury`, href: `/admin/tests/${t.id}`, cta: "Statuer" }));
  const dated = all.filter((t: any) => t.opens_at).map((t: any) => ({ ...t, ...span(t) }));
  const clash = conflicts(dated.filter((t: any) => t.end > now));
  const conflict: Todo[] = dated.filter((t: any) => clash.has(t.id)).map((t: any) => ({ key: t.id, title: t.title,
    detail: `${fmtDay(t.opens_at)} ${fmtTime(t.opens_at)} · ${Array.from(new Set(clash.get(t.id))).join(" ; ")}`, href: `/admin/tests/${t.id}/questions?vue=reglages#dates`, cta: "Changer la date ou la salle" }));
  const prepare: Todo[] = dated.filter((t: any) => t.start > now && t.start < week).flatMap((t: any) => {
    const issues = [!t.is_published ? "pas encore publiée" : "", !(nQ.get(t.id) || 0) ? "aucune question" : "", !by(t.id).length ? "aucun étudiant inscrit" : ""].filter(Boolean);
    return issues.length ? [{ key: t.id, title: t.title, detail: `${fmtDay(t.opens_at)} ${fmtTime(t.opens_at)} · ${issues.join(", ")}`,
      href: !(nQ.get(t.id) || 0) ? `/admin/tests/${t.id}/questions` : !by(t.id).length ? `/admin/tests/${t.id}/invites` : `/admin/tests/${t.id}/questions`, cta: "Préparer" }] : [];
  });
  const soon = dated.filter((t: any) => t.start > now && t.start < week);
  const total = live.length + grade.length + decide.length + conflict.length + prepare.length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <PageTitle>Aujourd&apos;hui</PageTitle>
      <p className="mt-1.5 text-[15px] text-muted first-letter:uppercase">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat dark label="À traiter" value={total} hint={total ? "éléments ci-dessous" : "rien en attente"} />
        <Stat label="En cours" value={live.length} hint="examens avec des étudiants en train de composer" />
        <Stat label="Cette semaine" value={soon.length} hint={soon[0] ? `prochain : ${fmtDay(soon[0].opens_at)} ${fmtTime(soon[0].opens_at)}` : "aucun examen dans les 7 jours"} />
        <Stat label="Conflits de calendrier" value={conflict.length} tone={conflict.length ? "text-[#c23b17]" : undefined} hint="même promo ou même salle" />
      </div>
      {!all.length ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
          <p className="font-display text-lg uppercase text-navy">Bienvenue</p>
          <p className="mt-1 text-sm text-muted">Créez un premier examen : il apparaîtra ici dès qu&apos;il demandera une action.</p>
          <Link href="/admin/new" className="btn mt-4">Créer un examen</Link>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <Block title="En cours" tone="bg-[#2fa862] animate-pulse" empty="Aucun étudiant ne compose en ce moment." items={live} />
          <Block title="Copies à corriger à la main" tone="bg-[#f08a3e]" empty="Aucune réponse rédigée en attente de correction." items={grade} />
          <Block title="Décisions à statuer" tone="bg-[#f08a3e]" empty="Aucune décision en attente du jury." items={decide} />
          <Block title="Conflits de calendrier" tone="bg-[#c23b17]" empty="Aucun chevauchement de promo ou de salle à venir." items={conflict} />
          <Block title="À préparer cette semaine" tone="bg-[#5561c9]" empty="Les examens des 7 prochains jours sont prêts." items={prepare} />
        </div>
      )}
    </main>
  );
}
