import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  fullscreen_exit: "sorties du plein écran", tab_hidden: "changements d'onglet", window_blur: "changements de fenêtre",
  multiple_screens: "écran secondaire", devtools_open: "outils de développement", camera_off: "caméra coupée",
  camera_refused: "caméra refusée", no_face: "absence de visage", multiple_faces: "plusieurs visages",
  camera_covered: "caméra masquée", camera_frozen: "image figée", snapshots_missing: "photos absentes",
  device_changed: "changement d'appareil", ip_changed: "changement d'adresse IP", connection_gap: "coupures réseau",
  print_attempt: "tentatives d'impression", paste_blocked: "collages bloqués", copy_blocked: "copies bloquées",
};
const CAM = new Set(["no_face", "multiple_faces", "camera_covered", "camera_frozen", "camera_refused", "camera_off"]);
const STATUS: Record<string, string> = { pending: "pas commencé", in_progress: "en cours", submitted: "copie rendue", terminated: "interrompue (infractions)", expired: "temps écoulé" };

/**
 * Fiche candidat pour le jury d'entretien : résultat par domaine, planchers,
 * déroulé de l'épreuve, photos marquantes et grille d'entretien du programme.
 * Pensée pour être imprimée.
 */
export default async function Fiche({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: a } = await supabase.from("attempts")
    .select("*, candidate:profiles(email, full_name), test:tests(id, title, pass_mark, interview_guide, duration_minutes)").eq("id", id).single();
  if (!a) return <main className="p-10">Tentative introuvable.</main>;
  const { data: report } = await supabase.rpc("attempt_report", { p_attempt: id });
  const { data: inv } = await supabase.from("invites").select("full_name, external_ref").eq("test_id", a.test_id).eq("email", a.candidate?.email || "").maybeSingle();
  const { data: events } = await supabase.from("proctor_events").select("kind, severity, detail, created_at").eq("attempt_id", id).order("id");

  const counts = new Map<string, number>();
  for (const e of events || []) if (e.severity !== "info" && LABEL[e.kind]) counts.set(e.kind, (counts.get(e.kind) || 0) + 1);
  const camTimes = (events || []).filter((e: any) => CAM.has(e.kind)).map((e: any) => new Date(e.created_at).getTime());
  const snaps = (events || []).filter((e: any) => e.kind === "snapshot" && e.detail?.path);
  const marked = snaps.filter((s: any) => camTimes.some((t) => Math.abs(new Date(s.created_at).getTime() - t) < 8000));
  // Photos marquantes : celles prises lors d'une anomalie, sinon le début, le milieu et la fin
  const pick = (marked.length ? marked : [snaps[0], snaps[Math.floor(snaps.length / 2)], snaps[snaps.length - 1]]).filter(Boolean).slice(0, 6);
  const uniq = Array.from(new Map(pick.map((s: any) => [s.detail.path, s])).values());
  const { data: signed } = uniq.length ? await supabase.storage.from("snapshots").createSignedUrls(uniq.map((s: any) => s.detail.path), 3600) : { data: [] as any[] };

  const name = a.candidate?.full_name || inv?.full_name || a.candidate?.email;
  const t = (d?: string | null) => d ? new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "-";
  const minutes = a.started_at && a.submitted_at ? Math.round((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 60000) : null;
  const domains: any[] = report?.domains || [];
  const below: string[] = report?.below_floors || [];

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-6 print:p-0 print:text-black print:bg-white">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <a href={`/admin/attempts/${id}`} className="text-sm text-muted">← Détail de la tentative</a>
        <PrintButton />
      </div>

      <header>
        <div className="text-sm text-muted print:text-black">Fiche jury · {a.test?.title}</div>
        <h1 className="h1 mt-1">{name}</h1>
        <div className="text-sm text-muted print:text-black">{a.candidate?.email}{inv?.external_ref ? ` · réf. ${inv.external_ref}` : ""}</div>
      </header>

      <section className="card print:border print:border-black">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-xs text-muted print:text-black">Résultat au QCM</div>
            <div className="font-display text-4xl text-accent print:text-black">{report?.score ?? "-"}<span className="text-faint text-xl print:text-black"> / {report?.max_score ?? "-"}</span></div>
          </div>
          {report?.pass_mark != null && (
            <div className={`badge ${report.passed ? "badge-ok" : "badge-danger"} print:border print:border-black`}>
              {report.passed ? "Admissible" : below.length && (report.score ?? 0) >= report.pass_mark ? "Seuil atteint, mais plancher non atteint" : "Sous le seuil"} (seuil {report.pass_mark})
            </div>
          )}
          <div className="text-sm text-muted print:text-black">
            {STATUS[a.status] || a.status} · {minutes != null ? `${minutes} min utilisées sur ${a.test?.duration_minutes + (a.extra_minutes || 0)}` : ""}{a.extra_minutes ? ` (tiers-temps +${a.extra_minutes} min)` : ""}
          </div>
        </div>
        {below.length > 0 && <p className="mt-3 text-danger print:text-black">À creuser en entretien : résultat sous le plancher en {below.join(", ")}.</p>}

        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-muted print:text-black"><tr><th className="py-1">Domaine</th><th>Points</th><th>Réussite</th><th>Plancher</th></tr></thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.domain} className="border-t">
                <td className="py-1">{d.domain}</td>
                <td>{d.score} / {d.max}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-28 bg-surface-2 print:bg-gray-200"><div className={`h-full ${d.below ? "bg-danger" : "bg-ok"} print:bg-black`} style={{ width: `${Math.round((d.ratio ?? 0) * 100)}%` }} /></div>
                    {d.ratio != null ? `${Math.round(d.ratio * 100)} %` : "-"}
                  </div>
                </td>
                <td className={d.below ? "text-danger font-semibold print:text-black" : "text-muted print:text-black"}>{d.floor != null ? `${Math.round(d.floor * 100)} %${d.below ? " (non atteint)" : ""}` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card print:border print:border-black">
        <h2 className="h2">Déroulé de l&apos;épreuve</h2>
        <div className="text-sm mt-2 grid sm:grid-cols-2 gap-1">
          <span>Début : {t(a.started_at)}</span>
          <span>Fin : {t(a.submitted_at)}</span>
          <span>Infractions comptées : <b className={a.violation_count ? "text-danger print:text-black" : ""}>{a.violation_count}</b></span>
          <span>Référence de l&apos;accusé : <span className="font-mono">{report?.receipt?.reference || "-"}</span></span>
        </div>
        {counts.size > 0 ? (
          <ul className="mt-3 text-sm list-disc pl-5">
            {Array.from(counts.entries()).map(([k, n]) => <li key={k}>{n} × {LABEL[k]}</li>)}
          </ul>
        ) : <p className="mt-3 text-sm text-ok print:text-black">Aucune alerte pendant l&apos;épreuve.</p>}
        {(signed || []).length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-muted print:text-black">{marked.length ? "Photos prises lors d'anomalies caméra" : "Photos (début, milieu, fin)"}</div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(signed || []).map((s: any, k: number) => s.signedUrl && (
                <figure key={k}>
                  <img src={s.signedUrl} alt="" className="rounded border w-full" />
                  <figcaption className="text-[11px] text-muted print:text-black">{t((uniq[k] as any).created_at)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card print:border print:border-black print:break-before-page">
        <h2 className="h2">Grille d&apos;entretien</h2>
        {a.test?.interview_guide
          ? <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">{a.test.interview_guide}</pre>
          : <p className="text-sm text-muted mt-2">Aucune grille enregistrée pour cette épreuve (champ « grille d&apos;entretien » du test).</p>}
      </section>

      <section className="card print:border print:border-black">
        <h2 className="h2">Avis du jury</h2>
        <div className="mt-3 space-y-6 text-sm">
          <div className="border-b border-line print:border-black pb-8">Points forts :</div>
          <div className="border-b border-line print:border-black pb-8">Points de vigilance :</div>
          <div className="flex flex-wrap gap-6">
            <span>☐ Favorable</span><span>☐ Réservé</span><span>☐ Défavorable</span>
            <span className="ml-auto">Jury : ______________________ Date : ____________</span>
          </div>
        </div>
      </section>
    </main>
  );
}
