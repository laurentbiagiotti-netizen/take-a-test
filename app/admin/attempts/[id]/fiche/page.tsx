import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VERDICT_LABEL, fmt20, type Verdict } from "@/lib/exam/verdict";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  fullscreen_exit: "sorties du plein écran", tab_hidden: "changements d'onglet", window_blur: "changements de fenêtre", fast_answers: "réponses anormalement rapides",
  multiple_screens: "écran secondaire", devtools_open: "outils de développement", camera_off: "caméra coupée",
  camera_refused: "caméra refusée", no_face: "absence de visage", multiple_faces: "plusieurs visages",
  camera_covered: "caméra masquée", camera_frozen: "image figée", other_person: "autre personne (corps visible)", phone_detected: "téléphone visible", room_scan_requested: "scan de la pièce demandé (pause)", room_scan: "pièce filmée au téléphone", exam_resumed: "reprise après la pause", room_scan_missing: "pause sans scan de la pièce (30 min)", snapshots_missing: "photos absentes",
  device_changed: "changement d'appareil", ip_changed: "changement d'adresse IP", connection_gap: "coupures réseau",
  print_attempt: "tentatives d'impression", violation_threshold: "seuil d'infractions atteint", staff_suspicion: "suspicion de fraude signalée", paste_blocked: "collages bloqués", copy_blocked: "copies bloquées",
};
const CAM = new Set(["no_face", "multiple_faces", "camera_covered", "camera_frozen", "other_person", "phone_detected", "camera_refused", "camera_off"]);
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

  const v = report?.verdict as Verdict | undefined;
  const VTONE: Record<string, string> = { pass: "border-[#2fa862] text-[#1f7a44]", review: "border-[#f08a3e] text-[#a64a12]", fail: "border-[#c23b17] text-[#b3361a]" };
  const box = "rounded-2xl border border-line bg-surface p-6 print:rounded-none print:border-black/40 print:bg-white print:p-4 print:shadow-none break-inside-avoid";
  const h2 = "font-display text-sm uppercase tracking-wide text-navy print:text-black";

  return (
    <main className="mx-auto max-w-[820px] space-y-5 px-6 py-8 print:max-w-none print:space-y-3 print:p-0 print:text-black">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <a href={`/admin/attempts/${id}`} className="text-sm text-muted hover:text-fg">‹ Copie de l&apos;étudiant</a>
        <div className="flex gap-2"><a className="btn-secondary" href={`/admin/pv/${a.test_id}`}>Procès-verbal de la session</a><PrintButton label="Enregistrer en PDF" /></div>
      </div>

      <header className="flex items-end justify-between gap-6 border-b-2 border-navy pb-4 print:border-black">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent print:text-black">Cybersup · Fiche jury</div>
          <h1 className="mt-1 font-display text-3xl uppercase leading-tight text-navy print:text-black">{name}</h1>
          <div className="mt-1 text-sm text-muted print:text-black">{a.candidate?.email}{inv?.external_ref ? ` · réf. ${inv.external_ref}` : ""}</div>
        </div>
        <div className="text-right text-sm text-muted print:text-black">
          <div className="font-semibold text-fg print:text-black">{a.test?.title}</div>
          <div>{t(a.started_at)}</div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-[auto_1fr] print:grid-cols-[auto_1fr]">
        <div className="rounded-2xl bg-navy px-7 py-5 text-white print:rounded-none print:border print:border-black print:bg-white print:text-black">
          <div className="text-xs text-white/75 print:text-black">Note</div>
          <div className="mt-1 flex items-baseline gap-1"><span className="font-display text-5xl leading-none text-[#ff8a3d] print:text-black">{fmt20(report?.score20)}</span><span className="text-lg text-white/70 print:text-black">/20</span></div>
          <div className="mt-2 text-xs text-white/75 print:text-black">{report?.score ?? "-"} / {report?.max_score ?? "-"} points</div>
        </div>
        <div className={`${box} border-l-4 ${v ? VTONE[v] : ""}`}>
          <div className={h2}>Décision motivée</div>
          <div className="mt-2 font-display text-2xl uppercase">{v ? VERDICT_LABEL[v] : "En attente"}</div>
          <div className="mt-2 space-y-1 text-sm text-fg print:text-black">
            {report?.thresholds && <p>Barème de l&apos;épreuve : réussi à partir de {report.thresholds.pass}/20, échoué sous {report.thresholds.fail}/20.</p>}
            {report?.verdict_override
              ? <p><b>Décision de l&apos;équipe</b>{report.verdict_override.by ? ` (${report.verdict_override.by})` : ""}, calcul automatique : {report.verdict_auto ? VERDICT_LABEL[report.verdict_auto as Verdict] : "-"}.<br />Motif : {report.verdict_override.reason || "non renseigné"}</p>
              : <p>Décision calculée automatiquement d&apos;après la note{below.length ? " et les planchers par domaine" : ""}.</p>}
            {below.length > 0 && <p className="font-semibold text-[#b3361a] print:text-black">Sous le plancher en {below.join(", ")} : à creuser en entretien.</p>}
            {report?.needs_manual && <p className="font-semibold">Une réponse rédigée reste à corriger : la note peut encore évoluer.</p>}
          </div>
        </div>
      </section>

      <section className={box}>
        <h2 className={h2}>Résultats par domaine</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted print:text-black"><tr><th className="py-1.5">Domaine</th><th>Points</th><th>Réussite</th><th>Plancher</th></tr></thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.domain} className="border-t border-line print:border-black/30">
                <td className="py-1.5 font-medium">{d.domain}</td>
                <td className="tabular-nums">{d.score} / {d.max}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-fg/[0.08] print:border print:border-black/40 print:bg-white"><div className={`h-full ${d.below ? "bg-[#c23b17]" : "bg-[#2fa862]"} print:bg-black`} style={{ width: `${Math.round((d.ratio ?? 0) * 100)}%` }} /></div>
                    <span className="tabular-nums">{d.ratio != null ? `${Math.round(d.ratio * 100)} %` : "-"}</span>
                  </div>
                </td>
                <td className={d.below ? "font-semibold text-[#b3361a] print:text-black" : "text-muted print:text-black"}>{d.floor != null ? `${Math.round(d.floor * 100)} %${d.below ? " (non atteint)" : ""}` : "-"}</td>
              </tr>
            ))}
            {!domains.length && <tr><td colSpan={4} className="py-3 text-muted">Aucun domaine renseigné sur les questions.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className={box}>
        <h2 className={h2}>Surveillance et déroulé</h2>
        <div className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 print:grid-cols-2">
          <span>Statut : {STATUS[a.status] || a.status}</span>
          <span>Durée : {minutes != null ? `${minutes} min sur ${a.test?.duration_minutes + (a.extra_minutes || 0)}` : "-"}{a.extra_minutes ? ` (tiers-temps +${a.extra_minutes} min)` : ""}</span>
          <span>Début : {t(a.started_at)}</span>
          <span>Fin : {t(a.submitted_at)}</span>
          <span>Infractions comptées : <b className={a.violation_count ? "text-[#b3361a] print:text-black" : ""}>{a.violation_count}</b>{a.suspicion_at ? " · suspicion de fraude signalée" : ""}</span>
          <span>Accusé de réception : <span className="font-mono">{report?.receipt?.reference || "-"}</span></span>
        </div>
        {counts.size > 0 ? (
          <ul className="mt-3 grid list-disc gap-x-6 pl-5 text-sm sm:grid-cols-2 print:grid-cols-2">
            {Array.from(counts.entries()).map(([k, n]) => <li key={k}>{n} × {LABEL[k]}</li>)}
          </ul>
        ) : <p className="mt-3 text-sm font-medium text-[#1f7a44] print:text-black">Aucune alerte pendant l&apos;épreuve.</p>}
        {(signed || []).length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-muted print:text-black">{marked.length ? "Photos prises lors d'anomalies caméra" : "Photos (début, milieu, fin)"}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 print:grid-cols-6">
              {(signed || []).map((s: any, k: number) => s.signedUrl && (
                <figure key={k}>
                  <img src={s.signedUrl} alt="" className="w-full rounded border border-line" />
                  <figcaption className="text-[10px] text-muted print:text-black">{t((uniq[k] as any).created_at)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </section>

      {a.test?.interview_guide && (
        <section className={box}>
          <h2 className={h2}>Grille d&apos;entretien</h2>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">{a.test.interview_guide}</pre>
        </section>
      )}

      <section className={box}>
        <h2 className={h2}>Avis du jury</h2>
        <div className="mt-3 space-y-5 text-sm">
          <div className="border-b border-line pb-9 print:border-black/50">Points forts :</div>
          <div className="border-b border-line pb-9 print:border-black/50">Points de vigilance :</div>
          <div className="flex flex-wrap gap-6"><span>☐ Favorable</span><span>☐ Réservé</span><span>☐ Défavorable</span></div>
          <div className="grid grid-cols-3 gap-6 pt-2 text-xs text-muted print:text-black">
            <div className="border-t border-fg/40 pt-1.5">Nom du jury</div><div className="border-t border-fg/40 pt-1.5">Date</div><div className="border-t border-fg/40 pt-1.5">Signature</div>
          </div>
        </div>
      </section>
    </main>
  );
}
