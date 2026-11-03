import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const CAMERA = ["no_face", "multiple_faces", "other_person", "camera_covered", "camera_frozen", "camera_refused", "camera_off"];
const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? "-" : n.toLocaleString("fr-FR", { maximumFractionDigits: d }));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Tableau de bord d'une épreuve : entonnoir (invités, commencés, rendus,
 * résultats), répartition des notes sur 20, moyennes par domaine et anomalies.
 * Les copies d'aperçu des admins ne sont pas comptées.
 */
export default async function Dashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "proctor") redirect("/dashboard");

  const [{ data: test }, { data: invites }, { data: attempts }, { data: reports }] = await Promise.all([
    supabase.from("tests").select("title, verdict_pass, verdict_fail, duration_minutes").eq("id", id).single(),
    supabase.from("invites").select("email, preview").eq("test_id", id),
    supabase.from("attempts").select("id, status, started_at, submitted_at, violation_count, suspicion_at, candidate:profiles(email)").eq("test_id", id),
    supabase.rpc("test_results", { p_test: id }),
  ]);
  const previews = new Set((invites || []).filter((i: any) => i.preview).map((i: any) => i.email));
  const real = (attempts || []).filter((a: any) => !previews.has(a.candidate?.email));
  const ids = real.map((a: any) => a.id);
  const { data: events } = ids.length
    ? await supabase.from("proctor_events").select("attempt_id, kind").in("attempt_id", ids).in("kind", [...CAMERA, "phone_detected"])
    : { data: [] as any[] };

  const invited = (invites || []).filter((i: any) => !i.preview).length;
  const started = real.filter((a: any) => a.status !== "pending").length;
  const done = real.filter((a: any) => ["submitted", "expired", "terminated"].includes(a.status));
  const rep = (a: any) => (reports as any)?.[a.id] || null;
  const scores = done.map((a: any) => rep(a)?.score20).filter((x: any) => typeof x === "number") as number[];
  const verdict = (v: string) => done.filter((a: any) => rep(a)?.verdict === v).length;
  const pass = verdict("pass"), review = verdict("review"), fail = verdict("fail");
  const durations = done.filter((a: any) => a.started_at && a.submitted_at)
    .map((a: any) => (new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 60000);

  // Répartition des notes par tranche de 2 points
  const bins = Array.from({ length: 10 }, (_, k) => ({ from: k * 2, n: 0 }));
  for (const s of scores) bins[Math.min(9, Math.floor(s / 2))].n++;
  const binMax = Math.max(1, ...bins.map((b) => b.n));

  // Moyenne par domaine
  const dom = new Map<string, { sum: number; n: number }>();
  for (const a of done) for (const d of rep(a)?.domains || []) {
    if (typeof d.ratio !== "number") continue;
    const x = dom.get(d.domain) || { sum: 0, n: 0 };
    x.sum += d.ratio; x.n++; dom.set(d.domain, x);
  }
  const domains = [...dom.entries()].map(([name, x]) => ({ name, avg: x.sum / x.n })).sort((a, b) => a.avg - b.avg);

  const withKind = (kinds: string[]) => new Set((events || []).filter((e: any) => kinds.includes(e.kind)).map((e: any) => e.attempt_id)).size;
  const anomalies = [
    { label: "Alerte caméra", n: withKind(CAMERA) },
    { label: "Téléphone visible", n: withKind(["phone_detected"]) },
    { label: "Infractions (onglet, plein écran…)", n: real.filter((a: any) => a.violation_count > 0).length },
    { label: "Suspicion signalée", n: real.filter((a: any) => a.suspicion_at).length },
  ];

  const funnel = [
    { label: "Invités", n: invited, tone: "bg-line-strong" },
    { label: "Ont commencé", n: started, tone: "bg-accent/60" },
    { label: "Ont rendu", n: done.length, tone: "bg-accent" },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.n));

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <a href={`/admin/tests/${id}/attempts`} className="text-sm text-muted">← Tentatives</a>
        <h1 className="h1 mt-2">Tableau de bord · {test?.title}</h1>
        <p className="text-sm text-muted mt-1">Copies d&apos;aperçu des admins non comptées. Résultat : « Test réussi » dès {fmt(test?.verdict_pass)}/20, « Test échoué » sous {fmt(test?.verdict_fail)}/20.</p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { k: "Copies rendues", v: String(done.length), s: invited ? `${pct(done.length, invited)} % des invités` : "" },
          { k: "Moyenne", v: scores.length ? `${fmt(scores.reduce((a, b) => a + b, 0) / scores.length)}/20` : "-", s: scores.length ? `médiane ${fmt(median(scores))}/20` : "" },
          { k: "Réussite", v: done.length ? `${pct(pass, done.length)} %` : "-", s: `${pass} réussi(s), ${review} à statuer, ${fail} échoué(s)` },
          { k: "Durée moyenne", v: durations.length ? `${fmt(durations.reduce((a, b) => a + b, 0) / durations.length, 0)} min` : "-", s: test?.duration_minutes ? `sur ${test.duration_minutes} min` : "" },
        ].map((c) => (
          <div key={c.k} className="card">
            <div className="text-xs uppercase tracking-wider text-muted">{c.k}</div>
            <div className="font-display text-3xl mt-2">{c.v}</div>
            <div className="text-xs text-muted mt-1">{c.s}</div>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="h2">Parcours des candidats</div>
          <div className="mt-4 space-y-3">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="flex justify-between text-sm"><span>{f.label}</span><b>{f.n}</b></div>
                <div className="h-3 mt-1 rounded-full bg-surface-2 overflow-hidden"><div className={`h-full rounded-full ${f.tone}`} style={{ width: `${(f.n / funnelMax) * 100}%` }} /></div>
              </div>
            ))}
            <div className="flex h-3 rounded-full overflow-hidden mt-4" aria-label="Résultats">
              {done.length > 0 && <>
                <div className="bg-ok" style={{ width: `${pct(pass, done.length)}%` }} />
                <div className="bg-warn" style={{ width: `${pct(review, done.length)}%` }} />
                <div className="bg-danger" style={{ width: `${pct(fail, done.length)}%` }} />
              </>}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted">
              <span><i className="inline-block w-2 h-2 rounded-full bg-ok mr-1" />Réussi {pass}</span>
              <span><i className="inline-block w-2 h-2 rounded-full bg-warn mr-1" />À statuer {review}</span>
              <span><i className="inline-block w-2 h-2 rounded-full bg-danger mr-1" />Échoué {fail}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="h2">Répartition des notes sur 20</div>
          {scores.length === 0 ? <p className="text-sm text-muted mt-4">Aucune copie notée pour l&apos;instant.</p> : (
            <div className="mt-4 flex items-end gap-1.5 h-44" role="img" aria-label="Histogramme des notes sur 20">
              {bins.map((b) => {
                const tone = b.from + 2 <= (test?.verdict_fail ?? 8) ? "bg-danger/70" : b.from >= (test?.verdict_pass ?? 10) ? "bg-ok/70" : "bg-warn/70";
                return (
                  <div key={b.from} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-[10px] text-muted mb-1">{b.n || ""}</span>
                    <div className={`w-full rounded-t ${tone}`} style={{ height: `${(b.n / binMax) * 100}%`, minHeight: b.n ? 4 : 0 }} title={`${b.from} à ${b.from + 2} : ${b.n}`} />
                    <span className="text-[10px] text-faint mt-1">{b.from}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="h2">Réussite moyenne par domaine</div>
          {domains.length === 0 ? <p className="text-sm text-muted mt-4">Pas encore de données.</p> : (
            <div className="mt-4 space-y-2.5">
              {domains.map((d) => (
                <div key={d.name}>
                  <div className="flex justify-between text-sm"><span>{d.name}</span><b className={d.avg < 0.4 ? "text-danger" : d.avg < 0.6 ? "text-warn" : "text-ok"}>{Math.round(d.avg * 100)} %</b></div>
                  <div className="h-2 mt-1 rounded-full bg-surface-2 overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${d.avg * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="h2">Anomalies (candidats concernés)</div>
          <ul className="mt-4 divide-y divide-line text-sm">
            {anomalies.map((x) => (
              <li key={x.label} className="flex justify-between py-2">
                <span>{x.label}</span>
                <span className={x.n ? "text-warn font-semibold" : "text-muted"}>{x.n}{started ? <span className="text-faint font-normal"> · {pct(x.n, started)} %</span> : null}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-faint mt-3">Les alertes ne décident de rien : chaque cas est à examiner dans la tentative du candidat.</p>
        </div>
      </section>
    </main>
  );
}
