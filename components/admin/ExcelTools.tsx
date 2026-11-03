"use client";
import { useRef, useState } from "react";
import { notify } from "@/components/Toaster";
import { COLUMNS, FORMATIONS, parseBank, toBankRow, type ImportRow } from "@/lib/excel/bank";
import { parseCsv, toCsv } from "@/lib/excel/csv";

type Q = { type: string; prompt: string; options: any; correct: any; points: number; domain?: string | null; time_limit_s?: number | null; explanation?: string | null };

function download(name: string, data: ArrayBuffer | string, type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Banque de questions en Excel, au format de la plateforme de Dylan : modèle à
 * remplir, import avec aperçu des erreurs ligne par ligne, export.
 */
export default function ExcelTools({ questions, formation, locked, onFormation, onImport }: {
  questions: Q[]; formation: string; locked: boolean;
  onFormation: (f: string) => void;
  onImport: (q: any[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ file: string; rows: ImportRow[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const template = async () => {
    const { bankWorkbook } = await import("@/lib/excel/xlsx");
    download("modele-questions-cybersup.xlsx", await bankWorkbook([], true));
  };

  const exportBank = async () => {
    const rows = questions.map((q) => toBankRow(q, formation)).filter(Boolean) as (string | number)[][];
    if (!rows.length) return notify("Aucune question exportable (QCM, vrai/faux, réponse courte).");
    const { bankWorkbook } = await import("@/lib/excel/xlsx");
    download("questions.xlsx", await bankWorkbook(rows, false));
    const skipped = questions.length - rows.length;
    if (skipped) notify(`${skipped} question(s) d'un autre type (terminal, exercice, association…) ne sont pas dans le fichier.`, "info");
  };

  const exportCsv = () => {
    const rows = questions.map((q) => toBankRow(q, formation)).filter(Boolean) as (string | number)[][];
    if (!rows.length) return notify("Aucune question exportable (QCM, vrai/faux, réponse courte).");
    download("questions.csv", toCsv([[...COLUMNS], ...rows]), "text/csv;charset=utf-8");
    const skipped = questions.length - rows.length;
    if (skipped) notify(`${skipped} question(s) d'un autre type (terminal, exercice, association…) ne sont pas dans le fichier.`, "info");
  };

  const read = async (f: File) => {
    if (f.size > 10 * 1024 * 1024) return notify("Fichier trop lourd (10 Mo maximum).");
    setBusy(true);
    try {
      const sheet = /\.(csv|txt)$/i.test(f.name)
        ? parseCsv(await f.text())
        : await (await import("@/lib/excel/xlsx")).readSheet(await f.arrayBuffer());
      const rows = parseBank(sheet, {
        existing: questions.map((q) => q.prompt), formation: formation || undefined,
        themes: questions.map((q) => q.domain || "").filter(Boolean),
      });
      if (!rows.length) notify("Aucune question trouvée dans ce fichier (ou aucune pour cette formation).");
      else setPreview({ file: f.name, rows });
    } catch (e: any) {
      notify(e?.message || "Fichier illisible.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const ok = preview?.rows.filter((r) => r.question) || [];
  const bad = preview?.rows.filter((r) => !r.question) || [];

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="text-xs text-muted">Formation de l&apos;épreuve
        <select className="input mt-1 !w-auto !py-1" value={formation} onChange={(e) => onFormation(e.target.value)}>
          <option value="">(toutes)</option>
          {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <button className="btn-secondary" onClick={template}>Modèle Excel</button>
      <button className="btn-secondary" onClick={exportBank} disabled={!questions.length}>Exporter en Excel</button>
      <button className="btn-secondary" onClick={exportCsv} disabled={!questions.length}>Exporter en CSV</button>
      <button className="btn-secondary" disabled={locked || busy} onClick={() => input.current?.click()}
        title={locked ? "Des candidats ont déjà composé : questions verrouillées" : undefined}>
        {busy ? "Lecture…" : "Importer (Excel ou CSV)"}
      </button>
      <input ref={input} type="file" accept=".xlsx,.csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Aperçu de l'import" onClick={() => setPreview(null)}>
          <div className="card w-full max-w-5xl max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">Aperçu de l&apos;import · {preview.file}</div>
                <div className="text-xs text-muted">
                  {ok.length} question(s) prête(s), {bad.length} avec erreur(s){formation ? ` · seules les questions de « ${formation} » et les questions communes sont gardées` : ""}.
                  Les thèmes proches (« Réseau », « réseaux ») sont regroupés.
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn" disabled={!ok.length} onClick={() => {
                  onImport(ok.map((r) => {
                    const q = r.question!;
                    return { type: q.type, prompt: q.prompt, options: q.options, correct: q.correct, points: q.points,
                      domain: q.domain, time_limit_s: q.time_limit_s, explanation: q.explanation, variant_group: null };
                  }));
                  setPreview(null);
                  notify(`${ok.length} question(s) ajoutée(s). Pensez à enregistrer.`, "ok");
                }}>Ajouter les {ok.length} question(s) valides</button>
                <button className="btn-secondary" onClick={() => setPreview(null)}>Annuler</button>
              </div>
            </div>
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-muted"><tr><th className="py-1 pr-2">Ligne</th><th className="pr-2">Question</th><th className="pr-2">Type</th><th className="pr-2">Thème</th><th>État</th></tr></thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className="border-t align-top">
                    <td className="py-1 pr-2 text-muted">{r.line}</td>
                    <td className="pr-2 max-w-md"><span className="line-clamp-2">{r.prompt || "(vide)"}</span></td>
                    <td className="pr-2 whitespace-nowrap">{r.typeLabel}</td>
                    <td className="pr-2">{r.domain || "-"}</td>
                    <td>{r.question ? <span className="text-ok">OK</span> : <span className="text-danger">{r.errors.join(" ; ")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
