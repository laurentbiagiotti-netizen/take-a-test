import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { staffPageGuard } from "@/lib/auth/staff";
import ExamTabs from "@/components/admin/ExamTabs";
import PublishButton from "@/components/admin/PublishButton";
import PreviewButton from "@/components/admin/PreviewButton";
import DuplicateButton from "@/components/admin/DuplicateButton";
import { Breadcrumb, PageTitle, Pill, examState, fmtDay, fmtTime } from "@/components/admin/ui";

/** En-tête commun aux pages d'une épreuve : fil d'Ariane, statut, titre, publication et onglets. */
export default async function ExamLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const g = await staffPageGuard();
  const isAdmin = "role" in g && g.role === "admin";
  const supabase = await createClient();
  const [{ data: t }, { count: nq }, { count: live }] = await Promise.all([
    supabase.from("tests").select("id, title, description, formation, is_published, opens_at, closes_at, duration_minutes").eq("id", id).maybeSingle(),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("test_id", id),
    supabase.from("attempts").select("id", { count: "exact", head: true }).eq("test_id", id).eq("status", "in_progress"),
  ]);
  if (!t) notFound();
  const st = examState(t, live ?? 0);
  const when = t.opens_at
    ? `${fmtDay(t.opens_at)} · ${t.closes_at && new Date(t.closes_at).toDateString() === new Date(t.opens_at).toDateString() ? `${fmtTime(t.opens_at)} à ${fmtTime(t.closes_at)}` : `dès ${fmtTime(t.opens_at)}`}`
    : t.closes_at ? `jusqu'au ${fmtDay(t.closes_at)}` : "sans date";
  const desc = (t.description || "").split("\n")[0].slice(0, 80);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-8">
      <Breadcrumb items={[{ href: "/admin", label: "Examens" }, { label: t.title }]} />
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill cls={st.pill}><span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</Pill>
            <Pill cls="bg-[#5561c9]/[0.12] text-navy ring-[#5561c9]/20">{t.formation || "Toutes les promos"}</Pill>
          </div>
          <div className="mt-3"><PageTitle>{t.title}</PageTitle></div>
          <p className="mt-2 text-[15px] text-muted">{[desc, when, `${t.duration_minutes} min`].filter(Boolean).join(" · ")}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <DuplicateButton id={id} title={t.title} className="btn-secondary" />
            <PreviewButton testId={id} className="btn-secondary" />
            <PublishButton variant="switch" id={id} title={t.title} published={t.is_published} questions={nq ?? 0} formation={t.formation} />
          </div>
        )}
      </div>
      <ExamTabs id={id} isAdmin={isAdmin} live={live ?? 0} questions={nq ?? 0} />
      <div className="-mx-4 sm:-mx-8">{children}</div>
    </div>
  );
}
