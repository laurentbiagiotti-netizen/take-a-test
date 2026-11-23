"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { RosterRow } from "@/lib/admin/roster";
import { Score, VerdictPill, fmtDate } from "@/components/admin/ui";
import { toCsv } from "@/lib/excel/csv";

type Col = "last" | "first" | "test" | "score" | "verdict" | "date";
const ORDER: Record<string, number> = { pass: 0, review: 1, fail: 2 };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Liste des candidats d'une épreuve ou d'une promo : prénom, nom, note sur 20 et décision
 * d'un coup d'œil. Recherche, tri par colonne, filtre par décision, export CSV.
 */
export default function RosterTable({ rows, tests, thresholds, showTest = false, compact = false, emptyText }: {
  rows: RosterRow[];
  tests?: Record<string, { title: string; pass?: number | null; fail?: number | null }>;
  thresholds?: { pass?: number | null; fail?: number | null };
  showTest?: boolean; compact?: boolean; emptyText?: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "score", dir: -1 });
  const [only, setOnly] = useState<string>("");
  const nPreview = rows.filter((r) => r.preview).length;
  const nReal = rows.length - nPreview;
  const [withPreview, setWithPreview] = useState(nReal === 0 && nPreview > 0);

  const shown = useMemo(() => {
    const f = norm(q.trim());
    const list = rows.filter((r) => (withPreview || !r.preview)
      && (!only || (only === "live" ? r.status === "in_progress" : r.verdict === only))
      && (!f || norm(`${r.first} ${r.last} ${r.email} ${tests?.[r.test_id]?.title || ""}`).includes(f)));
    const val = (r: RosterRow): string | number => {
      switch (sort.col) {
        case "last": return norm(r.last || r.email);
        case "first": return norm(r.first);
        case "test": return norm(tests?.[r.test_id]?.title || "");
        case "score": return r.score20 ?? -1;
        case "verdict": return r.status === "in_progress" ? -1 : r.verdict ? ORDER[r.verdict] : 9;
        case "date": return r.submitted_at || r.started_at || "";
      }
    };
    return [...list].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || norm(a.last).localeCompare(norm(b.last)); });
  }, [rows, q, sort, only, withPreview, tests]);

  const counts = useMemo(() => {
    const base = rows.filter((r) => withPreview || !r.preview);
    return { pass: base.filter((r) => r.verdict === "pass").length, review: base.filter((r) => r.verdict === "review").length,
      fail: base.filter((r) => r.verdict === "fail").length, live: base.filter((r) => r.status === "in_progress").length };
  }, [rows, withPreview]);

  const head = (col: Col, label: string, cls = "") => (
    <th className={`px-3 py-2.5 font-medium ${cls}`}>
      <button className={`inline-flex items-center gap-1 hover:text-fg ${sort.col === col ? "text-fg" : ""}`}
        onClick={() => setSort((s) => ({ col, dir: s.col === col ? (-s.dir as 1 | -1) : col === "score" || col === "date" ? -1 : 1 }))}>
        {label}<span className="text-[10px] w-2">{sort.col === col ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );

  const exportCsv = () => {
    const data = [["Prénom", "Nom", "E-mail", ...(showTest ? ["Épreuve"] : []), "Note /20", "Décision", "Statut", "Rendu le"],
      ...shown.map((r) => [r.first, r.last, r.email, ...(showTest ? [tests?.[r.test_id]?.title || ""] : []),
        r.score20 == null ? "" : r.score20.toFixed(2).replace(".", ","), r.verdict === "pass" ? "Réussi" : r.verdict === "fail" ? "Échoué" : r.verdict === "review" ? "À statuer" : "",
        r.status, r.submitted_at ? new Date(r.submitted_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : ""])];
    const url = URL.createObjectURL(new Blob([toCsv(data)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "candidats.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const chip = (k: string, label: string, n: number, dot?: string) => (
    <button onClick={() => setOnly((o) => (o === k ? "" : k))}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${only === k ? "bg-fg text-white ring-fg" : "bg-surface text-muted ring-line hover:text-fg"}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}{label}<span className="tabular-nums opacity-70">{n}</span>
    </button>
  );

  return (
    <div className="rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(20,26,51,0.04),0_8px_24px_-16px_rgba(20,26,51,0.12)] overflow-hidden">
      {!compact && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
          <div className="relative flex-1 min-w-[12rem]">
            <svg aria-hidden viewBox="0 0 20 20" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-faint"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
            <input className="w-full rounded-md bg-surface-2 py-1.5 pl-8 pr-3 text-sm outline-none ring-1 ring-inset ring-line focus:ring-accent" placeholder="Rechercher un candidat" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {chip("pass", "Réussis", counts.pass, "bg-ok")}
          {chip("review", "À statuer", counts.review, "bg-warn")}
          {chip("fail", "Échoués", counts.fail, "bg-danger")}
          {counts.live > 0 && chip("live", "En cours", counts.live, "bg-[#2563eb]")}
          {nPreview > 0 && (
            <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
              <input type="checkbox" checked={withPreview} onChange={(e) => setWithPreview(e.target.checked)} />Copies d&apos;essai ({nPreview})
            </label>
          )}
          <button onClick={exportCsv} disabled={!shown.length} className="ml-auto text-xs font-medium text-muted hover:text-fg disabled:opacity-40">Exporter (.csv)</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-faint">
            <tr>
              {head("first", "Prénom", "pl-4")}
              {head("last", "Nom")}
              {showTest && head("test", "Épreuve")}
              {head("score", "Note /20")}
              {head("verdict", "Décision")}
              {!compact && head("date", "Date", "pr-4")}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => {
              const t = tests?.[r.test_id];
              return (
                <tr key={r.attempt_id} className="group hover:bg-accent/[0.04]">
                  <td className="pl-4 pr-3 py-2.5">
                    <Link href={`/admin/attempts/${r.attempt_id}`} className="font-medium group-hover:text-accent">{r.first || <span className="text-faint">—</span>}</Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/attempts/${r.attempt_id}`} className="font-semibold tracking-wide">{r.last}</Link>
                    {(!r.named || r.preview || r.suspicion) && (
                      <span className="ml-2 inline-flex gap-1 align-middle">
                        {!r.named && <span title={r.email} className="text-[10px] uppercase tracking-wide text-faint">d&apos;après l&apos;e-mail</span>}
                        {r.preview && <span className="rounded bg-fg/5 px-1.5 text-[10px] uppercase tracking-wide text-muted">essai</span>}
                        {r.suspicion && <span className="rounded bg-danger/10 px-1.5 text-[10px] uppercase tracking-wide text-danger">suspicion</span>}
                      </span>
                    )}
                  </td>
                  {showTest && <td className="px-3 py-2.5 text-muted max-w-[16rem] truncate">{t?.title}</td>}
                  <td className="px-3 py-2.5"><Score value={r.score20} pass={(t?.pass ?? thresholds?.pass) ?? 10} fail={(t?.fail ?? thresholds?.fail) ?? 8} /></td>
                  <td className="px-3 py-2.5"><VerdictPill verdict={r.verdict} status={r.status} forced={r.forced} manual={r.needs_manual} /></td>
                  {!compact && <td className="pl-3 pr-4 py-2.5 text-muted whitespace-nowrap tabular-nums">{fmtDate(r.submitted_at || r.started_at, true)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && (
          <div className="px-6 py-10 text-center text-sm text-muted">
            {rows.length && !withPreview && nPreview === rows.length
              ? <>Seules des copies d&apos;essai de l&apos;équipe existent. <button className="underline" onClick={() => setWithPreview(true)}>Les afficher</button></>
              : q || only ? "Aucun candidat ne correspond." : emptyText || "Aucun candidat n'a encore passé cette épreuve."}
          </div>
        )}
      </div>
    </div>
  );
}
