"use client";
import { DataTable, type Column } from "@/components/admin/DataTable";

export type ItemStat = {
  id: string; position: number; domain: string | null; variant_group: string | null; type: string; prompt: string;
  n: number; reussite: number; sans_reponse: number; discrimination: number; alerte: string | null;
};

const pct = (x: number) => `${Math.round(x * 100)} %`;

const columns: Column<ItemStat>[] = [
  {
    key: "prompt", label: "Question", primary: true, sort: (i) => i.position, className: "max-w-md",
    cell: (i) => <><span className="text-muted mr-2">n° {i.position}</span><span className="line-clamp-2">{i.prompt}</span></>,
  },
  { key: "variant", label: "Variante", sort: (i) => i.variant_group, cell: (i) => <span className="text-xs text-muted">{i.variant_group ? i.variant_group.split("-").pop() : "-"}</span> },
  { key: "domain", label: "Domaine", sort: (i) => i.domain, cell: (i) => <span className="text-xs">{i.domain || "-"}</span> },
  { key: "n", label: "Copies", sort: (i) => i.n, cell: (i) => i.n },
  { key: "success", label: "Réussite", sort: (i) => i.reussite, cell: (i) => pct(i.reussite) },
  { key: "blank", label: "Sans réponse", sort: (i) => i.sans_reponse, cell: (i) => pct(i.sans_reponse) },
  {
    key: "disc", label: "Discrimination", title: "Quart supérieur moins quart inférieur", sort: (i) => i.discrimination,
    cell: (i) => <span className={i.discrimination < 0.15 ? "text-warn" : i.discrimination >= 0.3 ? "text-ok" : ""}>{i.discrimination.toFixed(2)}</span>,
  },
  { key: "alert", label: "Alerte", sort: (i) => i.alerte, cell: (i) => <span className="text-warn">{i.alerte || ""}</span> },
];

export function StatsTable({ items }: { items: ItemStat[] }) {
  return (
    <DataTable
      rows={items} columns={columns} rowKey={(i) => i.id} caption="Statistiques par question"
      rowClassName={(i) => (i.alerte ? "bg-warn/10" : "")}
      initialSort={{ key: "prompt", dir: "asc" }}
      search={(i) => `${i.prompt} ${i.domain ?? ""} ${i.alerte ?? ""}`} searchLabel="Rechercher une question ou un domaine"
      empty="Pas encore de copie terminée."
    />
  );
}
