import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Grader from "@/components/Grader";
import StaffActions from "@/components/StaffActions";

export const dynamic = "force-dynamic";

const SEV: Record<string, string> = { info: "text-slate-600", warning: "text-amber-700", violation: "text-red-600 font-semibold", critical: "text-red-800 font-bold" };
const STATUS: Record<string, string> = { pending: "pas commencé", in_progress: "en cours", submitted: "rendu", terminated: "interrompu", expired: "temps écoulé" };

export default async function AttemptDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "proctor") redirect("/dashboard");

  const { data: a } = await supabase
    .from("attempts").select("*, candidate:profiles(email, full_name), test:tests(title)").eq("id", id).single();
  if (!a) return <main className="p-10">Tentative introuvable.</main>;
  const { data: answers } = await supabase.from("answers").select("*, question:questions(*)").eq("attempt_id", id);
  const { data: events } = await supabase.from("proctor_events").select("*").eq("attempt_id", id).order("id");

  const snaps = (events || []).filter((e: any) => e.kind === "snapshot" && e.detail?.path);
  const signedSnapshots: { url: string; ts: string }[] = [];
  if (snaps.length) {
    const { data: signed } = await supabase.storage.from("snapshots").createSignedUrls(snaps.map((e: any) => e.detail.path), 900);
    (signed || []).forEach((s, i) => { if (s.signedUrl) signedSnapshots.push({ url: s.signedUrl, ts: snaps[i].created_at }); });
  }
  let identity: { document?: string; selfie?: string } = {};
  if (a.identity_paths) {
    const paths = [a.identity_paths.document, a.identity_paths.selfie].filter(Boolean);
    const { data: signed } = await supabase.storage.from("identity").createSignedUrls(paths, 900);
    identity = { document: signed?.[0]?.signedUrl || undefined, selfie: signed?.[1]?.signedUrl || undefined };
  }

  const order: string[] = a.question_order || [];
  const sorted = (answers || []).sort((x: any, y: any) => order.indexOf(x.question_id) - order.indexOf(y.question_id));
  const longAnswers = sorted.filter((x: any) => x.question?.type === "long_text");
  const mcqAnswers = sorted.filter((x: any) => x.question?.type !== "long_text");
  const t = (d?: string | null) => d ? new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "-";

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div>
        <a href="/admin" className="text-sm text-slate-600">← Retour</a>
        <h1 className="text-2xl font-bold mt-2">{a.test?.title}</h1>
        <p className="text-slate-700">{a.candidate?.full_name} · {a.candidate?.email}</p>
        <div className="text-sm text-slate-600 mt-1 grid grid-cols-2 md:grid-cols-4 gap-1">
          <span>Statut : <b>{STATUS[a.status] || a.status}</b>{a.end_reason ? ` (${a.end_reason})` : ""}</span>
          <span>Note : <b>{a.score ?? "-"}{a.max_score != null ? ` / ${a.max_score}` : ""}</b></span>
          <span>Infractions : <b className={a.violation_count ? "text-red-600" : ""}>{a.violation_count}</b></span>
          <span>Identité : <b>{a.identity_status}</b></span>
          <span>Début : {t(a.started_at)}</span>
          <span>Fin prévue : {t(a.deadline_at)}{a.extra_minutes ? ` (+${a.extra_minutes} min)` : ""}</span>
          <span>Rendu : {t(a.submitted_at)}</span>
          <span>Dernier signe de vie : {t(a.last_seen_at)}</span>
          <span className="col-span-2 truncate">IP : {a.client_ip || "-"} · {a.user_agent || ""}</span>
        </div>
      </div>

      <StaffActions attemptId={a.id} status={a.status} identityStatus={a.identity_status} isAdmin={profile?.role === "admin"} />

      {(identity.document || identity.selfie) && (
        <section>
          <h2 className="font-semibold">Vérification d&apos;identité</h2>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {identity.document && <a href={identity.document} target="_blank" rel="noreferrer"><img src={identity.document} alt="Pièce d'identité" className="rounded border" /></a>}
            {identity.selfie && <a href={identity.selfie} target="_blank" rel="noreferrer"><img src={identity.selfie} alt="Selfie" className="rounded border" /></a>}
          </div>
          {a.identity_note && <p className="text-sm text-slate-600 mt-1">Note : {a.identity_note}</p>}
        </section>
      )}

      {longAnswers.length > 0 && (
        <section>
          <h2 className="font-semibold">Réponses rédigées à corriger</h2>
          <div className="mt-2 space-y-3">
            {longAnswers.map((ans: any) => (
              <Grader key={ans.id} answerId={ans.id} question={ans.question} response={ans.response} initialScore={ans.score} initialFeedback={ans.feedback} />
            ))}
          </div>
        </section>
      )}

      {mcqAnswers.length > 0 && (
        <section>
          <h2 className="font-semibold">QCM (corrigés automatiquement)</h2>
          <div className="mt-2 space-y-2">
            {mcqAnswers.map((ans: any) => {
              const sel: string[] = ans.response?.selected || [];
              return (
                <div key={ans.id} className="card">
                  <div className="text-xs text-slate-500">{ans.score ?? 0}/{ans.question?.points} pt</div>
                  <div className="font-medium mt-1 whitespace-pre-wrap">{ans.question?.prompt}</div>
                  <div className="text-sm text-slate-700 mt-1">
                    Réponse : {(ans.question?.options || []).filter((o: any) => sel.includes(o.id)).map((o: any) => o.text).join(" · ") || "(aucune)"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {signedSnapshots.length > 0 && (
        <section>
          <h2 className="font-semibold">Photos webcam ({signedSnapshots.length})</h2>
          <div className="mt-2 grid grid-cols-3 md:grid-cols-6 gap-2">
            {signedSnapshots.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block">
                <img src={s.url} alt="" className="aspect-square object-cover rounded border" />
                <div className="text-[10px] text-slate-500 mt-0.5">{new Date(s.ts).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}</div>
              </a>
            ))}
          </div>
        </section>
      )}
      {a.media_purged_at && <p className="text-sm text-slate-500">Photos supprimées le {t(a.media_purged_at)} (durée de conservation atteinte).</p>}

      <section>
        <h2 className="font-semibold">Journal de surveillance ({events?.length || 0})</h2>
        <ul className="mt-2 text-sm max-h-96 overflow-y-auto border rounded p-2 bg-white">
          {(events || []).filter((e: any) => e.kind !== "snapshot").map((e: any) => (
            <li key={e.id} className="border-b last:border-0 py-1">
              <code className="text-slate-500">{new Date(e.created_at).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}</code>{" "}
              <b className={SEV[e.severity] || ""}>{e.kind}</b>
              {e.detail ? <span className="text-slate-500"> {JSON.stringify(e.detail)}</span> : null}
              {e.ip ? <span className="text-slate-400"> · {e.ip}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
