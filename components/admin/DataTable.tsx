"use client";
import { useMemo, useState, type ReactNode } from "react";

export type SortValue = string | number | null | undefined;

export type Column<T> = {
  key: string;
  label: string;
  /** Infobulle de l'en-tête. */
  title?: string;
  /** Valeur de tri ; sans elle, la colonne n'est pas triable. */
  sort?: (row: T) => SortValue;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Colonne affichée en titre de la carte sur tablette et mobile. */
  primary?: boolean;
  /** Colonne d'actions : alignée à droite, sans libellé sur la carte. */
  actions?: boolean;
};

type Sort = { key: string; dir: "asc" | "desc" };

const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

export function compareValues(a: SortValue, b: SortValue): number {
  const emptyA = a == null || a === "";
  const emptyB = b == null || b === "";
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

/** Trie sans modifier le tableau d'origine ; les valeurs vides restent en bas dans les deux sens. */
export function sortRows<T>(rows: T[], get: (r: T) => SortValue, dir: "asc" | "desc"): T[] {
  return rows
    .map((row, i) => ({ row, i, v: get(row) }))
    .sort((x, y) => {
      const emptyX = x.v == null || x.v === "";
      const emptyY = y.v == null || y.v === "";
      if (emptyX !== emptyY) return emptyX ? 1 : -1;
      const c = compareValues(x.v, y.v);
      return (dir === "asc" ? c : -c) || x.i - y.i;
    })
    .map((x) => x.row);
}

/**
 * Tableau de l'équipe : tri par colonne, recherche, et cartes lisibles sur
 * tablette en mode portrait ou sur téléphone (en dessous de 1024 px).
 */
export function DataTable<T>({
  rows, columns, rowKey, rowClassName, empty, initialSort, search, searchLabel = "Rechercher", caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowClassName?: (row: T) => string;
  empty: ReactNode;
  initialSort?: Sort;
  search?: (row: T) => string;
  searchLabel?: string;
  caption?: string;
}) {
  const [sort, setSort] = useState<Sort | null>(initialSort ?? null);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q && search ? rows.filter((r) => search(r).toLowerCase().includes(q)) : rows;
    const col = sort && columns.find((c) => c.key === sort.key && c.sort);
    return col ? sortRows(filtered, col.sort!, sort.dir) : filtered;
  }, [rows, columns, sort, query, search]);

  const sortable = columns.filter((c) => c.sort);
  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const actions = columns.filter((c) => c.actions);
  const details = columns.filter((c) => c !== primary && !c.actions);

  return (
    <div className="mt-4">
      {(search || sortable.length > 0) && (
        <div className="flex flex-wrap items-end gap-3 mb-3">
          {search && (
            <label className="flex-1 min-w-[200px] text-sm">
              <span className="sr-only">{searchLabel}</span>
              <input type="search" className="input" placeholder={searchLabel} value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          )}
          {sortable.length > 0 && (
            <div className="flex items-center gap-2 lg:hidden text-sm">
              <label className="flex items-center gap-2">
                <span className="text-muted">Trier par</span>
                <select className="input !w-auto min-h-[44px]" value={sort?.key ?? ""}
                  onChange={(e) => setSort(e.target.value ? { key: e.target.value, dir: sort?.dir ?? "asc" } : null)}>
                  <option value="">ordre d&apos;origine</option>
                  {sortable.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </label>
              {sort && (
                <button type="button" className="btn-secondary min-h-[44px]" onClick={() => toggle(sort.key)}
                  aria-label={sort.dir === "asc" ? "Ordre croissant, passer en décroissant" : "Ordre décroissant, passer en croissant"}>
                  {sort.dir === "asc" ? "↑ croissant" : "↓ décroissant"}
                </button>
              )}
            </div>
          )}
          {query && <span className="text-xs text-muted" role="status">{visible.length} sur {rows.length}</span>}
        </div>
      )}

      {/* Grand écran et tablette en paysage : tableau. */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="text-left text-muted sticky top-0 bg-bg z-10">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" title={c.title} className={`py-2 pr-3 font-medium ${c.actions ? "text-right" : ""}`}
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : c.sort ? "none" : undefined}>
                    {c.sort ? (
                      <button type="button" onClick={() => toggle(c.key)}
                        className={`inline-flex items-center gap-1 hover:text-fg ${active ? "text-fg" : ""}`}>
                        {c.label}
                        <span aria-hidden className={active ? "" : "opacity-30"}>{active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                      </button>
                    ) : c.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={rowKey(r)} className={`border-t align-top ${rowClassName?.(r) ?? ""}`}>
                {columns.map((c) => (
                  <td key={c.key} className={`py-2 pr-3 ${c.actions ? "text-right whitespace-nowrap" : ""} ${c.className ?? ""}`}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
            {!visible.length && <tr><td colSpan={columns.length} className="py-8 text-center text-muted">{query ? "Aucun résultat." : empty}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Tablette en portrait et téléphone : une carte par ligne. */}
      <ul className="lg:hidden grid gap-3 md:grid-cols-2">
        {visible.map((r) => (
          <li key={rowKey(r)} className={`card !p-4 ${rowClassName?.(r) ?? ""}`}>
            <div className="text-base">{primary.cell(r)}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {details.map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-xs text-muted" title={c.title}>{c.label}</dt>
                  <dd className={`mt-0.5 break-words ${c.className ?? ""}`}>{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
            {actions.length > 0 && (
              <div className="mt-3 pt-3 border-t flex flex-wrap gap-x-4 gap-y-2 text-sm [&_a]:inline-flex [&_a]:min-h-[44px] [&_a]:items-center [&_button]:min-h-[44px]">
                {actions.map((c) => <div key={c.key} className="flex flex-wrap gap-x-4">{c.cell(r)}</div>)}
              </div>
            )}
          </li>
        ))}
        {!visible.length && <li className="py-8 text-center text-muted md:col-span-2">{query ? "Aucun résultat." : empty}</li>}
      </ul>
    </div>
  );
}
