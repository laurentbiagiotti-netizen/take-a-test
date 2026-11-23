"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, TIERS, fmt20, tier } from "@/components/admin/ui";
import { toCsv } from "@/lib/excel/csv";

export type MatrixExam = { id: string; title: string; date: string | null; state: string; invitedCount: number };
export type MatrixCell = { note: number | null; score: number | null; max: number | null; status: string; attempt_id?: string };
export type MatrixStudent = { key: string; first: string; last: string; email: string; cells: Record<string, MatrixCell | undefined>; avg: number | null };

const STRIPES = "bg-[repeating-linear-gradient(135deg,transparent_0,transparent_8px,rgba(15,22,64,0.05)_8px,rgba(15,22,64,0.05)_16px)]";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const day = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).replace(".", "") : "";

/** Tableau d'une classe : un étudiant par ligne, un examen par colonne, la note colorée par palier. */
export default function ClassMatrix({ exams, students, className }: { exams: MatrixExam[]; students: MatrixStudent[]; className: string }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"note" | "raw">("note");
  const shown = useMemo(() => {
    const f = norm(q.trim());
    return students.filter((s) => !f || norm(`${s.first} ${s.last} ${s.email}`).includes(f));
  }, [students, q]);

  const cellText = (c: MatrixCell) => mode === "note" ? fmt20(c.note) : `${(Math.round((c.score ?? 0) * 100) / 100).toString().replace(".", ",")}/${c.max ?? "?"}`;
  const exportCsv = () => {
    const data = [["Nom", "Prénom", "E-mail", ...exams.map((e) => e.title), "Moyenne"],
      ...shown.map((s) => [s.last, s.first, s.email, ...exams.map((e) => {
        const c = s.cells[e.id];
        return !c ? "" : c.note != null ? (mode === "note" ? c.note.toFixed(2).replace(".", ",") : `${c.score}/${c.max}`) : c.status === "absent" ? "abs." : "";
      }), s.avg == null ? "" : s.avg.toFixed(2).replace(".", ",")])];
    const url = URL.createObjectURL(new Blob([toCsv(data)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${className}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="inline-flex rounded-xl bg-fg/[0.06] p-1">
          {([["note", "Note /20"], ["raw", "Score brut"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k}
              className={`rounded-lg px-3.5 py-1.5 text-sm transition-all ${mode === k ? "bg-surface font-medium shadow-[0_1px_3px_rgba(15,22,64,0.12)]" : "text-fg/70 hover:text-fg"}`}>{l}</button>
          ))}
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium hover:border-fg/30">
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4"><path fill="currentColor" d="M10 3v8.6l2.8-2.8 1 1L10 14.4 6.2 9.8l1-1L9.3 11.6V3h.7ZM4 15h12v1.5H4z" /></svg>CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,22,64,0.04),0_16px_40px_-28px_rgba(15,22,64,0.25)]">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <div className="relative w-full sm:w-64">
            <svg aria-hidden viewBox="0 0 20 20" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
            <input className="w-full rounded-xl border border-line-strong bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Rechercher un étudiant" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted">
            {TIERS.map((t) => <span key={t.label} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${t.cls}`} />{t.label}</span>)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-line bg-surface-2/60">
                <th className="sticky left-0 z-10 min-w-[16rem] bg-surface-2 px-4 py-3 text-left align-bottom text-[11px] font-semibold uppercase tracking-[0.08em] text-fg/60">Étudiant</th>
                {exams.map((e) => {
                  const soon = e.state === "soon";
                  return (
                    <th key={e.id} className={`min-w-[7.5rem] border-l border-line px-2 py-3 text-center align-bottom ${e.invitedCount && e.invitedCount < students.length ? "bg-navy/[0.05]" : ""}`}>
                      <Link href={`/admin/tests/${e.id}`} className="group block">
                        <div className={`text-[10px] font-bold uppercase tracking-wide ${soon ? "text-[#e8600b]" : "text-[#e8600b]"}`}>
                          {day(e.date)}{e.invitedCount && e.invitedCount < students.length ? <span className="text-navy"> · {e.invitedCount} élève{e.invitedCount > 1 ? "s" : ""}</span> : null}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-navy group-hover:text-accent">{e.title}</div>
                      </Link>
                    </th>
                  );
                })}
                <th className="min-w-[6rem] border-l border-line px-3 py-3 text-center align-bottom text-[11px] font-semibold uppercase tracking-[0.08em] text-fg/60">Moyenne</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.key} className="border-b border-line last:border-b-0 hover:bg-accent/[0.03]">
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2.5">
                    <span className="flex items-center gap-3">
                      <Avatar first={s.first} last={s.last} note={s.avg} />
                      <span className="min-w-0"><span className="block truncate"><span className="font-bold uppercase tracking-wide text-navy">{s.last}</span> <span className="text-fg">{s.first}</span></span><span className="block truncate text-xs text-muted">{s.email}</span></span>
                    </span>
                  </td>
                  {exams.map((e) => {
                    const c = s.cells[e.id];
                    const notInvited = !c && e.invitedCount > 0;
                    return (
                      <td key={e.id} className={`border-l border-line px-2 py-2 text-center ${notInvited ? STRIPES : ""}`}>
                        {c?.note != null ? (
                          <Link href={`/admin/attempts/${c.attempt_id}`} className={`inline-flex min-w-[3.25rem] justify-center rounded-lg px-2.5 py-1.5 text-[13px] font-semibold tabular-nums transition-transform hover:scale-105 ${tier(c.note).soft}`}>
                            {cellText(c)}
                          </Link>
                        ) : c?.status === "in_progress" ? <span className="text-xs font-semibold text-[#1d4ed8]">en cours</span>
                          : c?.status === "absent" && (e.state === "soon" || e.state === "draft") ? <span className="text-xs italic text-muted">à venir</span>
                          : c?.status === "absent" ? <span className="rounded-full bg-[#c23b17]/10 px-2 py-0.5 text-[11px] font-semibold text-[#b3361a]">abs.</span>
                          : !c && e.state === "soon" ? <span className="text-xs italic text-muted">à venir</span>
                          : notInvited ? null : <span className="text-faint">—</span>}
                      </td>
                    );
                  })}
                  <td className="border-l border-line px-3 py-2 text-center">
                    <span className={`text-[15px] font-bold tabular-nums ${tier(s.avg).text}`}>{fmt20(s.avg)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <div className="px-6 py-12 text-center text-sm text-muted">{q ? "Aucun étudiant ne correspond." : "Aucun étudiant dans cette classe pour l'instant."}</div>}
        </div>
      </div>
    </div>
  );
}
