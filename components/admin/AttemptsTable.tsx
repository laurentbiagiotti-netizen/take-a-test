"use client";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { VERDICT_BADGE, VERDICT_LABEL, fmt20, type Verdict } from "@/lib/exam/verdict";

export type AttemptRow = {
  id: string; name: string; email: string; status: string; score: number | null; max_score: number | null;
  violations: number; camera: number; identity: string | null; silent: boolean; submitted_at: string | null;
  score20: number | null; verdict: Verdict | null; forced: boolean;
};

const STATUS: Record<string, string> = { pending: "pas commencé", in_progress: "en cours", submitted: "rendu", terminated: "interrompu", expired: "temps écoulé" };
const fmt = (d: string) => new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });

const columns: Column<AttemptRow>[] = [
  {
    key: "name", label: "Candidat", primary: true, sort: (a) => a.name,
    cell: (a) => <><div className="font-medium">{a.name}</div>{a.name !== a.email && <div className="text-xs text-muted">{a.email}</div>}</>,
  },
  { key: "status", label: "Statut", sort: (a) => STATUS[a.status] || a.status, cell: (a) => STATUS[a.status] || a.status },
  {
    key: "score", label: "Note", sort: (a) => a.score20,
    cell: (a) => <><b>{fmt20(a.score20)}</b><div className="text-xs text-muted">{a.score ?? "-"}{a.max_score != null ? ` / ${a.max_score} pts` : ""}</div></>,
  },
  {
    key: "verdict", label: "Résultat", sort: (a) => (a.verdict ? { pass: 1, review: 2, fail: 3 }[a.verdict] : null),
    cell: (a) => (a.verdict
      ? <span className={VERDICT_BADGE[a.verdict]} title={a.forced ? "Décision forcée par l'équipe" : undefined}>{VERDICT_LABEL[a.verdict]}{a.forced ? " *" : ""}</span>
      : <span className="text-faint">-</span>),
  },
  {
    key: "violations", label: "Infractions", sort: (a) => a.violations,
    cell: (a) => <span className={a.violations ? "text-danger font-semibold" : ""}>{a.violations}</span>,
  },
  {
    key: "camera", label: "Caméra", title: "Alertes caméra : examinées par un surveillant, elles ne comptent pas comme infractions", sort: (a) => a.camera,
    cell: (a) => (a.camera ? <span className="badge-warn">{a.camera} alerte{a.camera > 1 ? "s" : ""}</span> : <span className="text-faint">-</span>),
  },
  {
    key: "identity", label: "Identité", sort: (a) => (a.identity === "submitted" ? "0" : a.identity),
    cell: (a) => (
      <span className={a.identity === "submitted" ? "text-warn font-semibold" : a.identity === "rejected" ? "text-danger" : ""}>
        {({ submitted: "à vérifier", verified: "validée", rejected: "refusée", pending: "attendue", not_required: "non demandée" } as Record<string, string>)[a.identity || ""] || "-"}
      </span>
    ),
  },
  {
    key: "connection", label: "Connexion", sort: (a) => (a.status === "in_progress" ? (a.silent ? 0 : 1) : null),
    cell: (a) => <span className={a.silent ? "text-danger" : "text-muted"}>{a.status === "in_progress" ? (a.silent ? "perdue" : "en ligne") : "-"}</span>,
  },
  { key: "submitted", label: "Rendu", sort: (a) => a.submitted_at, cell: (a) => (a.submitted_at ? fmt(a.submitted_at) : "-") },
  {
    key: "actions", label: "", actions: true,
    cell: (a) => <><a className="underline mr-3" href={`/admin/attempts/${a.id}`}>Voir</a>{a.submitted_at && <a className="underline mr-3" href={`/admin/attempts/${a.id}/fiche`}>Fiche jury</a>}{a.submitted_at && <a className="underline" href={`/api/staff/attempts/${a.id}/recap`} target="_blank" rel="noopener">PDF</a>}</>,
  },
];

export function AttemptsTable({ rows }: { rows: AttemptRow[] }) {
  return (
    <DataTable
      rows={rows} columns={columns} rowKey={(a) => a.id} caption="Tentatives de l'épreuve"
      rowClassName={(a) => (a.silent ? "bg-danger/10" : "")}
      search={(a) => `${a.name} ${a.email}`} searchLabel="Rechercher un candidat"
      empty="Aucune tentative pour l'instant. Elles apparaissent dès qu'un candidat ouvre l'épreuve."
    />
  );
}
