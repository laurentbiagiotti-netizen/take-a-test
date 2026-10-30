"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatClock } from "@/lib/exam/client";
import { DataTable, type Column } from "@/components/admin/DataTable";

/** Surveillance en direct : actualisée toute seule toutes les 5 secondes. */
const KIND: Record<string, string> = {
  fullscreen_exit: "sortie du plein écran", tab_hidden: "changement d'onglet", window_blur: "changement de fenêtre",
  multiple_screens: "écran secondaire", devtools_open: "outils de développement", camera_off: "caméra coupée",
  camera_refused: "caméra refusée", no_face: "aucun visage", multiple_faces: "plusieurs visages",
  camera_covered: "caméra masquée", camera_frozen: "image figée", other_person: "autre personne (corps)",
  connection_gap: "coupure réseau", ip_changed: "changement d'IP", device_changed: "changement d'appareil",
  print_attempt: "impression", copy_blocked: "copie bloquée", paste_blocked: "collage bloqué", shortcut_blocked: "raccourci bloqué",
  attempt_terminated: "épreuve interrompue", violation_threshold: "SEUIL D'INFRACTIONS ATTEINT : à examiner", staff_suspicion: "suspicion signalée", attempt_expired: "temps écoulé",
};
const STATUS: Record<string, string> = { in_progress: "en cours", submitted: "rendu", terminated: "interrompu", expired: "temps écoulé" };

type Row = {
  id: string; nom: string; status: string; infractions: number; question: number; total: number;
  secondes_restantes: number; silence: number | null; tiers_temps: number; alertes_recentes: number;
  alertes: { kind: string; severity: string; at: string }[]; camera_absente: boolean;
};

const lost = (r: Row) => r.status === "in_progress" && (r.silence ?? 0) > 45;
const running = (r: Row) => r.status === "in_progress";

const columns: Column<Row>[] = [
  {
    key: "name", label: "Candidat", primary: true, sort: (r) => r.nom,
    cell: (r) => <>
      <div className="font-medium">{r.nom}</div>
      <div className="text-xs text-muted">{STATUS[r.status] || r.status}{r.tiers_temps ? ` · tiers-temps +${r.tiers_temps} min` : ""}</div>
    </>,
  },
  {
    key: "progress", label: "Avancement", sort: (r) => (running(r) ? r.question / Math.max(1, r.total) : null),
    cell: (r) => running(r) ? <>
      <div>{Math.min(r.question, r.total)} / {r.total}</div>
      <div className="h-1 w-24 bg-surface-2 mt-1"><div className="h-full bg-accent" style={{ width: `${(Math.min(r.question, r.total) / Math.max(1, r.total)) * 100}%` }} /></div>
    </> : "-",
  },
  {
    key: "left", label: "Temps restant", sort: (r) => (running(r) ? r.secondes_restantes : null),
    cell: (r) => <span className={`font-mono ${running(r) && r.secondes_restantes < 300 ? "text-danger" : ""}`}>{running(r) ? formatClock(r.secondes_restantes) : "-"}</span>,
  },
  {
    key: "violations", label: "Infractions", sort: (r) => r.infractions,
    cell: (r) => <span className={r.infractions ? "text-danger font-semibold" : ""}>{r.infractions}</span>,
  },
  {
    key: "alerts", label: "Dernières alertes", title: "Les plus récentes d'abord ; tri par nombre d'alertes des 2 dernières minutes",
    sort: (r) => r.alertes_recentes * 1000 + r.alertes.length,
    cell: (r) => <div className="text-xs">
      {r.camera_absente && <div className="text-warn">caméra absente</div>}
      {r.alertes.map((e, k) => (
        <div key={k} className={e.severity === "warning" ? "text-warn" : "text-danger"}>
          {new Date(e.at).toLocaleTimeString("fr-FR")} · {KIND[e.kind] || e.kind}
        </div>
      ))}
      {!r.alertes.length && !r.camera_absente && <span className="text-faint">-</span>}
    </div>,
  },
  {
    key: "connection", label: "Connexion", sort: (r) => (running(r) ? (lost(r) ? -(r.silence ?? 0) : 1) : null),
    cell: (r) => <span className={lost(r) ? "text-danger" : "text-muted"}>{running(r) ? (lost(r) ? `perdue (${r.silence} s)` : "en ligne") : "-"}</span>,
  },
  { key: "actions", label: "", actions: true, cell: (r) => <a className="underline" href={`/admin/attempts/${r.id}`}>Ouvrir</a> },
];

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
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <a href={`/admin/tests/${id}/attempts`} className="text-sm text-muted">← Toutes les tentatives</a>
      <h1 className="h1 mt-2">En direct · {title}</h1>
      <div className="flex flex-wrap gap-4 mt-3 text-sm" role="status" aria-live="polite">
        <span className="badge-ok">{active.length} en cours</span>
        <span className="badge-muted">{meta?.en_attente ?? 0} pas encore commencé(s)</span>
        <span className="badge-muted">{meta?.rendus ?? 0} copie(s) rendue(s)</span>
        <span className="text-faint">Actualisation automatique toutes les 5 secondes{meta ? ` · ${new Date(meta.now).toLocaleTimeString("fr-FR")}` : ""}</span>
      </div>
      {error && <p className="text-danger text-sm mt-3">{error}</p>}

      <DataTable
        rows={rows} columns={columns} rowKey={(r) => r.id} caption="Épreuves en cours"
        rowClassName={(r) => (r.alertes_recentes > 0 ? "bg-danger/10" : "")}
        initialSort={{ key: "alerts", dir: "desc" }}
        search={(r) => r.nom} searchLabel="Rechercher un candidat"
        empty="Aucune épreuve en cours pour le moment."
      />
    </main>
  );
}
