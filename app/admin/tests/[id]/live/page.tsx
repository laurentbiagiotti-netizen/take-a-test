"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatClock } from "@/lib/exam/client";

/** Surveillance en direct : actualisée toute seule toutes les 5 secondes. */
const KIND: Record<string, string> = {
  fullscreen_exit: "sortie du plein écran", tab_hidden: "changement d'onglet", window_blur: "changement de fenêtre",
  multiple_screens: "écran secondaire", devtools_open: "outils de développement", camera_off: "caméra coupée",
  camera_refused: "caméra refusée", no_face: "aucun visage", multiple_faces: "plusieurs visages",
  camera_covered: "caméra masquée", camera_frozen: "image figée", snapshots_missing: "photos absentes",
  connection_gap: "coupure réseau", ip_changed: "changement d'IP", device_changed: "changement d'appareil",
  print_attempt: "impression", copy_blocked: "copie bloquée", paste_blocked: "collage bloqué", shortcut_blocked: "raccourci bloqué",
  attempt_terminated: "épreuve interrompue", attempt_expired: "temps écoulé",
};
const STATUS: Record<string, string> = { in_progress: "en cours", submitted: "rendu", terminated: "interrompu", expired: "temps écoulé" };

type Row = {
  id: string; nom: string; status: string; infractions: number; question: number; total: number;
  secondes_restantes: number; silence: number | null; tiers_temps: number; alertes_recentes: number;
  alertes: { kind: string; severity: string; at: string }[]; camera_absente: boolean;
};

export default function Live() {
  const { id } = useParams<{ id: string }>();
  const supabase = useRef(createClient()).current;
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{ en_attente: number; rendus: number; now: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    supabase.from("tests").select("title").eq("id", id).single().then(({ data }) => setTitle(data?.title || ""));
    let stop = false;
    const tick = async () => {
      const { data, error } = await supabase.rpc("staff_live", { p_test: id });
      if (stop) return;
      if (error) setError(error.message); else { setError(null); setRows(data.attempts || []); setMeta(data); }
    };
    tick();
    const i = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(i); };
  }, [id, supabase]);

  const active = rows.filter((r) => r.status === "in_progress");
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <a href={`/admin/tests/${id}/attempts`} className="text-sm text-muted">← Toutes les tentatives</a>
      <h1 className="h1 mt-2">En direct · {title}</h1>
      <div className="flex flex-wrap gap-4 mt-3 text-sm" role="status" aria-live="polite">
        <span className="badge-ok">{active.length} en cours</span>
        <span className="badge-muted">{meta?.en_attente ?? 0} pas encore commencé(s)</span>
        <span className="badge-muted">{meta?.rendus ?? 0} copie(s) rendue(s)</span>
        <span className="text-faint">Actualisation automatique toutes les 5 secondes{meta ? ` · ${new Date(meta.now).toLocaleTimeString("fr-FR")}` : ""}</span>
      </div>
      {error && <p className="text-danger text-sm mt-3">{error}</p>}

      <table className="mt-6 w-full text-sm">
        <thead className="text-left text-muted">
          <tr><th className="py-2">Candidat</th><th>Avancement</th><th>Temps restant</th><th>Infractions</th><th>Dernières alertes</th><th>Connexion</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const lost = r.status === "in_progress" && (r.silence ?? 0) > 45;
            const hot = r.alertes_recentes > 0;
            return (
              <tr key={r.id} className={`border-t align-top ${hot ? "bg-danger/10" : ""}`}>
                <td className="py-2">
                  <div className="font-medium">{r.nom}</div>
                  <div className="text-xs text-muted">{STATUS[r.status] || r.status}{r.tiers_temps ? ` · tiers-temps +${r.tiers_temps} min` : ""}</div>
                </td>
                <td>
                  {r.status === "in_progress" ? <>
                    <div>{Math.min(r.question, r.total)} / {r.total}</div>
                    <div className="h-1 w-24 bg-surface-2 mt-1"><div className="h-full bg-accent" style={{ width: `${(Math.min(r.question, r.total) / Math.max(1, r.total)) * 100}%` }} /></div>
                  </> : "-"}
                </td>
                <td className={`font-mono ${r.status === "in_progress" && r.secondes_restantes < 300 ? "text-danger" : ""}`}>{r.status === "in_progress" ? formatClock(r.secondes_restantes) : "-"}</td>
                <td className={r.infractions ? "text-danger font-semibold" : ""}>{r.infractions}</td>
                <td className="text-xs">
                  {r.camera_absente && <div className="text-warn">caméra absente</div>}
                  {r.alertes.map((e, k) => (
                    <div key={k} className={e.severity === "warning" ? "text-warn" : "text-danger"}>
                      {new Date(e.at).toLocaleTimeString("fr-FR")} · {KIND[e.kind] || e.kind}
                    </div>
                  ))}
                  {!r.alertes.length && !r.camera_absente && <span className="text-faint">-</span>}
                </td>
                <td className={lost ? "text-danger" : "text-muted"}>{r.status === "in_progress" ? (lost ? `perdue (${r.silence} s)` : "en ligne") : "-"}</td>
                <td className="text-right whitespace-nowrap"><a className="underline" href={`/admin/attempts/${r.id}`}>Ouvrir</a></td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={7} className="py-6 text-center text-muted">Aucune épreuve en cours pour le moment.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
