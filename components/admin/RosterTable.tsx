"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { notify } from "@/components/Toaster";
import { useRouter } from "next/navigation";
import type { RosterRow } from "@/lib/admin/roster";
import { Avatar, NoteBar, VerdictPill, fmtDuration } from "@/components/admin/ui";
import { toCsv } from "@/lib/excel/csv";

type Col = "first" | "last" | "test" | "score" | "note" | "duration" | "watch" | "verdict";
const ORDER: Record<string, number> = { pass: 0, review: 1, fail: 2 };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STRIPES = "bg-[repeating-linear-gradient(135deg,transparent_0,transparent_10px,rgba(15,22,64,0.035)_10px,rgba(15,22,64,0.035)_20px)]";

/**
 * Candidats d'une épreuve (ou d'une promo) : prénom, nom, score, note sur 20, durée,
 * surveillance et décision. Recherche, tri par colonne, absents, filtre par décision, export CSV.
 */
export default function RosterTable({ rows, tests, showTest = false, emptyText, emptyAction }: {
  rows: RosterRow[];
  tests?: Record<string, { title: string }>;
  thresholds?: { pass?: number | null; fail?: number | null };
  showTest?: boolean; compact?: boolean; emptyText?: string; emptyAction?: { href: string; label: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "last", dir: 1 });
  const [only, setOnly] = useState("");
  const [watch, setWatch] = useState("");
  const [range, setRange] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  // Filtres et tri gardés d'une visite à l'autre, page par page
  const storeKey = `cx-roster:${usePathname() || ""}`;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(storeKey) || "null");
      if (v) { setOnly(v.only || ""); setWatch(v.watch || ""); setRange(v.range || ""); if (v.sort?.col) setSort(v.sort); if (typeof v.absents === "boolean") setAbsents(v.absents); }
    } catch {}
    setReady(true);
  }, [storeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const nAbsent = rows.filter((r) => r.absent).length;
  const nPreview = rows.filter((r) => r.preview).length;
  const nReal = rows.filter((r) => !r.preview && !r.absent).length;
  const [absents, setAbsents] = useState(true);
  const [withPreview, setWithPreview] = useState(nReal === 0 && nPreview > 0);

  useEffect(() => { if (ready) try { localStorage.setItem(storeKey, JSON.stringify({ only, watch, range, sort, absents })); } catch {} }, [ready, storeKey, only, watch, range, sort, absents]);
  const active = [only, watch, range].filter(Boolean).length;

  const base = rows.filter((r) => (withPreview || !r.preview) && (absents || !r.absent));
  const counts = { pass: base.filter((r) => r.verdict === "pass").length, review: base.filter((r) => r.verdict === "review").length, fail: base.filter((r) => r.verdict === "fail").length };

  const shown = useMemo(() => {
    const f = norm(q.trim());
    const list = base.filter((r) => (!only || r.verdict === only)
      && (!watch || (!r.absent && (watch === "ras" ? !r.violations && !r.suspicion : watch === "infr" ? r.violations > 0 : r.suspicion)))
      && (!range || (r.score20 != null && (range === "lt10" ? r.score20 < 10 : range === "lt8" ? r.score20 < 8 : r.score20 >= 10)))
      && (!f || norm(`${r.first} ${r.last} ${r.email} ${tests?.[r.test_id]?.title || ""}`).includes(f)));
    const val = (r: RosterRow): string | number => {
      switch (sort.col) {
        case "first": return norm(r.first);
        case "last": return norm(r.last || r.email);
        case "test": return norm(tests?.[r.test_id]?.title || "");
        case "score": return r.score ?? -1;
        case "note": return r.score20 ?? -1;
        case "duration": return r.duration_s ?? -1;
        case "watch": return r.violations + (r.suspicion ? 100 : 0);
        case "verdict": return r.absent ? 10 : r.status === "in_progress" ? -1 : r.verdict ? ORDER[r.verdict] : 9;
      }
    };
    return [...list].sort((a, b) => {
      if (a.absent !== b.absent && sort.col !== "last" && sort.col !== "first") return a.absent ? 1 : -1;
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || norm(a.last).localeCompare(norm(b.last));
    });
  }, [base, q, sort, only, watch, range, tests]);

  const th = (col: Col, label: string, cls = "") => (
    <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg/60 ${cls}`}>
      <button className={`inline-flex items-center gap-1 hover:text-fg ${sort.col === col ? "text-fg" : ""}`}
        onClick={() => setSort((s) => ({ col, dir: s.col === col ? (-s.dir as 1 | -1) : ["note", "score", "watch"].includes(col) ? -1 : 1 }))}>
        {label}{sort.col === col && <span className="text-accent">{sort.dir === 1 ? "↑" : "↓"}</span>}
      </button>
    </th>
  );

  const exportCsv = () => {
    const data = [["Prénom", "Nom", "E-mail", ...(showTest ? ["Épreuve"] : []), "Score", "Sur", "Note /20", "Décision", "Durée (min)", "Infractions", "Statut"],
      ...shown.map((r) => [r.first, r.last, r.email, ...(showTest ? [tests?.[r.test_id]?.title || ""] : []),
        r.score ?? "", r.max ?? "", r.score20 == null ? "" : r.score20.toFixed(2).replace(".", ","),
        r.verdict === "pass" ? "Réussi" : r.verdict === "fail" ? "Échoué" : r.verdict === "review" ? "À statuer" : "",
        r.duration_s == null ? "" : Math.round(r.duration_s / 60), r.violations, r.absent ? "absent" : r.status])];
    const url = URL.createObjectURL(new Blob([toCsv(data)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "candidats.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const picked = shown.filter((r) => sel.has(r.attempt_id));
  const selectable = shown.filter((r) => !r.absent);
  const allSel = selectable.length > 0 && selectable.every((r) => sel.has(r.attempt_id));
  const toggleSel = (id: string) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const copyMails = async (list: RosterRow[]) => {
    const mails = Array.from(new Set(list.map((r) => r.email.toLowerCase()).filter(Boolean)));
    try { await navigator.clipboard.writeText(mails.join("; ")); notify(`${mails.length} adresse(s) copiée(s).`, "ok"); } catch { notify("Copie impossible."); }
  };
  const fsel = "rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

  const chip = (k: string, label: string, n: number, dot: string) => (
    <button onClick={() => setOnly((o) => (o === k ? "" : k))} aria-pressed={only === k}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${only === k ? "bg-navy text-white ring-navy" : "bg-surface text-fg/70 ring-line hover:text-fg"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label}<span className="tabular-nums opacity-70">{n}</span>
    </button>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,22,64,0.04),0_16px_40px_-28px_rgba(15,22,64,0.25)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <div className="relative w-full sm:w-64">
          <svg aria-hidden viewBox="0 0 20 20" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
          <input className="w-full rounded-xl border border-line-strong bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Rechercher un étudiant" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {nAbsent > 0 && (
          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[#e8600b]" checked={absents} onChange={(e) => setAbsents(e.target.checked)} />Afficher les absents ({nAbsent})
          </label>
        )}
        {nPreview > 0 && (
          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="h-4 w-4 accent-[#e8600b]" checked={withPreview} onChange={(e) => setWithPreview(e.target.checked)} />Copies d&apos;essai ({nPreview})
          </label>
        )}
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          <select className={fsel} value={watch} onChange={(e) => setWatch(e.target.value)} aria-label="Filtrer par surveillance">
            <option value="">Surveillance : tout</option><option value="ras">RAS</option><option value="infr">Avec infractions</option><option value="susp">Suspicion</option>
          </select>
          <select className={fsel} value={range} onChange={(e) => setRange(e.target.value)} aria-label="Filtrer par note">
            <option value="">Note : toutes</option><option value="lt10">Sous 10</option><option value="lt8">Sous 8</option><option value="gte10">10 et plus</option>
          </select>
          {active > 0 && <button className="px-1 text-xs text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => { setOnly(""); setWatch(""); setRange(""); }}>Effacer les filtres</button>}
          {chip("pass", "Réussis", counts.pass, "bg-[#2fa862]")}
          {chip("review", "À statuer", counts.review, "bg-[#f08a3e]")}
          {chip("fail", "Échoués", counts.fail, "bg-[#c23b17]")}
          <button onClick={exportCsv} disabled={!shown.length}
            className="ml-1 inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium hover:border-fg/30 disabled:opacity-40">
            <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4"><path fill="currentColor" d="M10 3v8.6l2.8-2.8 1 1L10 14.4 6.2 9.8l1-1L9.3 11.6V3h.7ZM4 15h12v1.5H4z" /></svg>CSV
          </button>
        </div>
      </div>
      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-navy/[0.05] px-4 py-2.5 text-sm">
          <span className="font-semibold text-navy">{picked.length} étudiant(s) sélectionné(s)</span>
          <a className="btn-secondary ml-auto !py-1.5" href={`/admin/fiches?ids=${picked.slice(0, 80).map((r) => r.attempt_id).join(",")}`}>Fiches jury en un seul PDF</a>
          <button className="btn-secondary !py-1.5" onClick={() => copyMails(picked)}>Copier les adresses</button>
          <button className="px-2 text-muted hover:text-fg" onClick={() => setSel(new Set())}>Tout décocher</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-y border-line bg-surface-2/60 text-left">
            <tr>
              <th className="w-10 pl-4"><input type="checkbox" className="h-4 w-4 accent-[#e8600b]" aria-label="Tout sélectionner" checked={allSel} disabled={!selectable.length}
                onChange={() => setSel(allSel ? new Set() : new Set(selectable.map((r) => r.attempt_id)))} /></th>
              {th("first", "Prénom")}
              {th("last", "Nom")}
              {showTest && th("test", "Épreuve")}
              {th("score", "Score", "text-right")}
              {th("note", "Note")}
              {th("duration", "Durée", "text-right")}
              {th("watch", "Surveillance", "text-center")}
              {th("verdict", "Décision")}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => {
              const go = () => !r.absent && router.push(`/admin/attempts/${r.attempt_id}`);
              return (
                <tr key={r.attempt_id} onClick={go} className={`group ${r.absent ? `${STRIPES} text-muted` : "cursor-pointer hover:bg-accent/[0.035]"}`}>
                  <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                    {!r.absent && <input type="checkbox" className="h-4 w-4 accent-[#e8600b]" aria-label={`Sélectionner ${r.first} ${r.last}`} checked={sel.has(r.attempt_id)} onChange={() => toggleSel(r.attempt_id)} />}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <Avatar first={r.first} last={r.last} note={r.absent ? null : r.score20} />
                      <span className={r.absent ? "" : "text-fg"}>{r.first || <span className="text-faint">—</span>}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold uppercase tracking-wide ${r.absent ? "text-fg/60" : "text-navy"}`}>{r.last}</span>
                    {!r.named && !r.absent && <span title={r.email} className="ml-2 text-[10px] uppercase tracking-wide text-faint">d&apos;après l&apos;e-mail</span>}
                    {r.preview && <span className="ml-2 rounded bg-fg/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">essai</span>}
                    <div className="mt-0.5 text-xs font-normal normal-case tracking-normal text-muted">
                      <Link href={`/admin/etudiants/${encodeURIComponent(r.email.toLowerCase())}`} onClick={(e) => e.stopPropagation()} className="hover:text-accent hover:underline" title="Ouvrir la fiche étudiant">{r.email}</Link>
                    </div>
                  </td>
                  {showTest && <td className="max-w-[16rem] truncate px-4 py-3 text-muted">{tests?.[r.test_id]?.title}</td>}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.score == null || r.absent ? <span className="text-faint">—</span> : <><span className="font-bold text-fg">{fmtN(r.score)}</span><span className="text-muted">/{fmtN(r.max)}</span></>}
                  </td>
                  <td className="px-4 py-3">{r.absent ? <span className="rounded-full border border-dashed border-line-strong px-2.5 py-0.5 text-xs">Absent</span> : <NoteBar value={r.score20} />}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-fg/80">{r.absent ? "" : r.status === "in_progress" ? <span className="text-[#1d4ed8]">en cours</span> : fmtDuration(r.duration_s)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.absent ? null : r.suspicion
                      ? <span className="rounded-full bg-[#c23b17]/[0.12] px-2.5 py-1 text-xs font-semibold text-[#b3361a]">Suspicion</span>
                      : r.violations
                        ? <span className="rounded-full bg-[#f08a3e]/[0.18] px-2.5 py-1 text-xs font-semibold text-[#b54d14]">{r.violations} infr.</span>
                        : <span className="text-xs font-bold tracking-wide text-[#1f8a4c]">RAS</span>}
                  </td>
                  <td className="px-4 py-3">{!r.absent && <VerdictPill verdict={r.verdict} status={r.status} forced={r.forced} manual={r.needs_manual} />}</td>
                  <td className="pr-4 text-faint">{!r.absent && <span className="transition-transform group-hover:translate-x-0.5 inline-block">›</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && (
          <div className="px-6 py-12 text-center text-sm text-muted">
            {nPreview && !withPreview && nReal === 0
              ? <>Seules des copies d&apos;essai de l&apos;équipe existent. <button className="underline" onClick={() => setWithPreview(true)}>Les afficher</button></>
              : q || active ? <>Aucun étudiant ne correspond. {active > 0 && <button className="underline" onClick={() => { setOnly(""); setWatch(""); setRange(""); }}>Effacer les filtres</button>}</>
                : <><span className="block font-display text-lg uppercase text-navy">{emptyText || "Aucun candidat pour l'instant"}</span>
                  {emptyAction && <Link href={emptyAction.href} className="btn mt-4">{emptyAction.label}</Link>}</>}
          </div>
        )}
      </div>
    </div>
  );
}

const fmtN = (n: number | null) => (n == null ? "—" : (Math.round(n * 100) / 100).toString().replace(".", ","));
