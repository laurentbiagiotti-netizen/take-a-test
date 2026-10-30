import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Grader from "@/components/Grader";
import StaffActions from "@/components/StaffActions";

export const dynamic = "force-dynamic";

const ANOM: Record<string, string> = { no_face: "aucun visage", multiple_faces: "plusieurs visages", camera_covered: "caméra masquée", camera_frozen: "image figée" };
const SEV: Record<string, string> = { info: "text-muted", warning: "text-warn", violation: "text-danger font-semibold", critical: "text-danger font-bold" };
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
  const CAM = new Set(["no_face", "multiple_faces", "camera_covered", "camera_frozen"]);
  const camEvents = (events || []).filter((e: any) => CAM.has(e.kind));
  const signedSnapshots: { url: string; ts: string; anomaly?: string }[] = [];
  if (snaps.length) {
    const { data: signed } = await supabase.storage.from("snapshots").createSignedUrls(snaps.map((e: any) => e.detail.path), 900);
    (signed || []).forEach((s, i) => {
      if (!s.signedUrl) return;
      const t = new Date(snaps[i].created_at).getTime();
      const near = camEvents.find((e: any) => Math.abs(new Date(e.created_at).getTime() - t) < 8000);
      signedSnapshots.push({ url: s.signedUrl, ts: snaps[i].created_at, anomaly: near?.kind });
    });
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
  const mcqAnswers = sorted.filter((x: any) => x.question?.type === "mcq_single" || x.question?.type === "mcq_multi");
  const termAnswers = sorted.filter((x: any) => x.question?.type === "terminal");
  const funAnswers = sorted.filter((x: any) => ["ordering", "matching", "hotspot", "short_answer"].includes(x.question?.type));
  const { data: termStates } = await supabase.from("terminal_states").select("question_id, done_ids, total").eq("attempt_id", id);
  const { data: termHistory } = await supabase.from("terminal_history").select("question_id, cwd, command, created_at").eq("attempt_id", id).order("id");
  const t = (d?: string | null) => d ? new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "-";

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div>
        <a href="/admin" className="text-sm text-muted">← Retour</a>
        <h1 className="h1 mt-2">{a.test?.title}</h1>
        <p className="text-fg">{a.candidate?.full_name} · {a.candidate?.email}</p>
        <div className="text-sm text-muted mt-1 grid grid-cols-2 md:grid-cols-4 gap-1">
          <span>Statut : <b>{STATUS[a.status] || a.status}</b>{a.end_reason ? ` (${a.end_reason})` : ""}</span>
          <span>Note : <b>{a.score ?? "-"}{a.max_score != null ? ` / ${a.max_score}` : ""}</b></span>
          <span>Infractions : <b className={a.violation_count ? "text-danger" : ""}>{a.violation_count}</b></span>
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
          <h2 className="h2">Vérification d&apos;identité</h2>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {identity.document && <a href={identity.document} target="_blank" rel="noreferrer"><img src={identity.document} alt="Pièce d'identité" className="rounded border" /></a>}
            {identity.selfie && <a href={identity.selfie} target="_blank" rel="noreferrer"><img src={identity.selfie} alt="Selfie" className="rounded border" /></a>}
          </div>
          {a.identity_note && <p className="text-sm text-muted mt-1">Note : {a.identity_note}</p>}
        </section>
      )}

      {longAnswers.length > 0 && (
        <section>
          <h2 className="h2">Réponses rédigées à corriger</h2>
          <div className="mt-2 space-y-3">
            {longAnswers.map((ans: any) => (
              <Grader key={ans.id} answerId={ans.id} question={ans.question} response={ans.response} initialScore={ans.score} initialFeedback={ans.feedback} />
            ))}
          </div>
        </section>
      )}

      {mcqAnswers.length > 0 && (
        <section>
          <h2 className="h2">QCM (corrigés automatiquement)</h2>
          <div className="mt-2 space-y-2">
            {mcqAnswers.map((ans: any) => {
              const sel: string[] = ans.response?.selected || [];
              return (
                <div key={ans.id} className="card">
                  <div className="text-xs text-muted">{ans.score ?? 0}/{ans.question?.points} pt</div>
                  <div className="font-medium mt-1 whitespace-pre-wrap">{ans.question?.prompt}</div>
                  <div className="text-sm text-fg mt-1">
                    Réponse : {(ans.question?.options || []).filter((o: any) => sel.includes(o.id)).map((o: any) => o.text).join(" · ") || "(aucune)"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(termAnswers.length > 0 || (termHistory || []).length > 0) && (
        <section>
          <h2 className="h2">Défis terminal</h2>
          <div className="mt-2 space-y-3">
            {(answers || []).filter((x: any) => x.question?.type === "terminal").map((ans: any) => {
              const cmds = (termHistory || []).filter((h: any) => h.question_id === ans.question_id);
              return (
                <div key={ans.id} className="card">
                  <div className="text-xs text-muted">{ans.score ?? 0}/{ans.question?.points} pt · {cmds.length} commande(s) · missions {(termStates || []).find((t: any) => t.question_id === ans.question_id)?.done_ids?.length ?? 0}/{(termStates || []).find((t: any) => t.question_id === ans.question_id)?.total ?? "?"}</div>
                  <div className="font-medium mt-1 whitespace-pre-wrap">{ans.question?.prompt}</div>
                  <div className="text-sm mt-1">Flag saisi : <code className={ans.score ? "text-ok" : "text-danger"}>{ans.response?.flag || "(aucun)"}</code></div>
                  {cmds.length > 0 && (
                    <pre className="mt-3 max-h-60 overflow-y-auto rounded-md border border-line bg-[#05070d] p-3 text-xs font-mono text-[#c9d1e3]">
                      {cmds.map((h: any) => `${new Date(h.created_at).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}  ${h.cwd}$ ${h.command}`).join("\n")}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {funAnswers.length > 0 && (
        <section>
          <h2 className="h2">Ordre, association, repérage, réponses courtes</h2>
          <div className="mt-2 space-y-2">
            {funAnswers.map((ans: any) => {
              const q = ans.question, o = q?.options || {}, r = ans.response || {};
              const txt = (list: any[], ids: string[]) => ids.map((i) => list?.find((x: any) => x.id === i)?.text ?? (list?.find((x: any) => x.id === i)?.cells || []).join(" ; ") ?? i);
              let shown = "";
              if (q.type === "ordering") shown = txt(o, r.order || []).map((t: string, k: number) => `${k + 1}. ${t}`).join("   ");
              if (q.type === "matching") shown = Object.entries(r.pairs || {}).map(([l, rr]) => `${txt(o.left, [l])[0]} → ${txt(o.right, [rr as string])[0]}`).join("   ");
              if (q.type === "hotspot") shown = txt(o.segments, r.selected || []).join("   |   ");
              if (q.type === "short_answer") shown = r.text || "";
              return (
                <div key={ans.id} className="card">
                  <div className="text-xs text-muted">{ans.score ?? 0}/{q?.points} pt</div>
                  <div className="font-medium mt-1 whitespace-pre-wrap">{q?.prompt}</div>
                  <div className="text-sm text-muted mt-1 break-words">Réponse : <span className="text-fg">{shown || "(aucune)"}</span></div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {signedSnapshots.length > 0 && (
        <section>
          <h2 className="h2">Photos webcam ({signedSnapshots.length}){camEvents.length ? <span className="badge-warn ml-2 align-middle">{camEvents.length} anomalie(s) caméra</span> : null}</h2>
          <p className="text-xs text-muted mt-1">Encadrées en orange : photos prises au moment d&apos;une anomalie détectée (à vérifier, la détection automatique peut se tromper).</p>
          <div className="mt-2 grid grid-cols-3 md:grid-cols-6 gap-2">
            {signedSnapshots.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block">
                <img src={s.url} alt="" className={`aspect-square object-cover rounded border ${s.anomaly ? "border-2 border-accent" : ""}`} />
                <div className={`text-[10px] mt-0.5 ${s.anomaly ? "text-accent" : "text-muted"}`}>{s.anomaly ? `${ANOM[s.anomaly]} · ` : ""}{new Date(s.ts).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}</div>
              </a>
            ))}
          </div>
        </section>
      )}
      {a.media_purged_at && <p className="text-sm text-muted">Photos supprimées le {t(a.media_purged_at)} (durée de conservation atteinte).</p>}

      <section>
        <h2 className="h2">Journal de surveillance ({events?.length || 0})</h2>
        <ul className="mt-2 text-sm max-h-96 overflow-y-auto border rounded p-2 bg-surface">
          {(events || []).filter((e: any) => e.kind !== "snapshot").map((e: any) => (
            <li key={e.id} className="border-b last:border-0 py-1">
              <code className="text-muted">{new Date(e.created_at).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}</code>{" "}
              <b className={SEV[e.severity] || ""}>{e.kind}</b>
              {e.detail ? <span className="text-muted"> {JSON.stringify(e.detail)}</span> : null}
              {e.ip ? <span className="text-faint"> · {e.ip}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
