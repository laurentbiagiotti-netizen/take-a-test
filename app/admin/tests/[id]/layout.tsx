import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { staffPageGuard } from "@/lib/auth/staff";
import ExamTabs from "@/components/admin/ExamTabs";
import PublishButton from "@/components/admin/PublishButton";
import PreviewButton from "@/components/admin/PreviewButton";
import { Pill, fmtDate } from "@/components/admin/ui";

/** En-tête commun aux pages d'une épreuve : titre, promo, statut, actions et onglets. */
export default async function ExamLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const g = await staffPageGuard();
  const isAdmin = "role" in g && g.role === "admin";
  const supabase = await createClient();
  const [{ data: t }, { count: nq }, { count: live }] = await Promise.all([
    supabase.from("tests").select("id, title, formation, is_published, opens_at, closes_at, duration_minutes").eq("id", id).maybeSingle(),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("test_id", id),
    supabase.from("attempts").select("id", { count: "exact", head: true }).eq("test_id", id).eq("status", "in_progress"),
  ]);
  if (!t) notFound();
  const window = t.opens_at || t.closes_at
    ? `${t.opens_at ? fmtDate(t.opens_at, true) : "…"} → ${t.closes_at ? fmtDate(t.closes_at, true) : "…"}` : null;

  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6">
          <Link href="/admin" className="text-sm text-muted hover:text-fg">← Examens</Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {t.is_published
                  ? <Pill cls="bg-ok/10 text-ok ring-ok/25"><span className="h-1.5 w-1.5 rounded-full bg-ok" />Publiée</Pill>
                  : <Pill cls="bg-fg/5 text-muted ring-fg/10">Brouillon</Pill>}
                <span className="text-muted">{t.formation || "Toutes les promos"}</span>
                <span className="text-faint">·</span>
                <span className="text-muted">{t.duration_minutes} min · {nq ?? 0} question(s)</span>
                {window && <><span className="text-faint">·</span><span className="text-muted">{window}</span></>}
              </div>
              <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight break-words">{t.title}</h1>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <PreviewButton testId={id} className="btn-secondary !py-1.5" />
                <PublishButton id={id} title={t.title} published={t.is_published} questions={nq ?? 0} formation={t.formation}
                  className={t.is_published ? "btn-secondary !py-1.5" : "btn !py-1.5"} />
              </div>
            )}
          </div>
          <ExamTabs id={id} isAdmin={isAdmin} live={live ?? 0} />
        </div>
      </div>
      {children}
    </>
  );
}
