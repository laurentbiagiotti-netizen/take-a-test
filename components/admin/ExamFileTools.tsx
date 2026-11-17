"use client";
import { useRef, useState } from "react";
import { notify } from "@/components/Toaster";
import { buildExamFile, examToCsv, readExamCsv, parseExamJson, toDraftQuestion, type DraftQuestion } from "@/lib/admin/exam-file";

function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) => (s || "epreuve").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "epreuve";

/** Lit un fichier d'épreuve (.json complet ou .csv une ligne par question). */
export async function readExamFile(f: File) {
  if (f.size > 20 * 1024 * 1024) throw new Error("fichier trop lourd (20 Mo maximum)");
  const text = await f.text();
  if (/\.(csv|tsv|txt)$/i.test(f.name)) {
    const x = readExamCsv(text);
    return { test: {} as Record<string, any>, questions: x.questions, skipped: x.skipped, ignoredColumns: x.ignoredColumns };
  }
  const file = parseExamJson(text);
  return { test: file.test, questions: file.questions, skipped: [] as { line: number; error: string }[], ignoredColumns: [] as string[] };
}

/** Résumé lisible des lignes écartées et des colonnes non reconnues. */
export function importReport(x: { skipped: { line: number; error: string }[]; ignoredColumns: string[] }): string {
  const parts: string[] = [];
  if (x.skipped.length) parts.push(`${x.skipped.length} ligne(s) écartée(s) : ` + x.skipped.slice(0, 5).map((s) => `ligne ${s.line} (${s.error})`).join(" ; ") + (x.skipped.length > 5 ? "…" : ""));
  if (x.ignoredColumns.length) parts.push(`colonnes non reconnues : ${x.ignoredColumns.join(", ")}`);
  return parts.join(". ");
}

/**
 * Épreuve complète en fichier : tous les types de questions, corrigés,
 * scénarios et réglages (JSON), ou une ligne par question (CSV).
 */
export default function ExamFileTools({ test, questions, locked, onImport }: {
  test: Record<string, any>; questions: DraftQuestion[]; locked: boolean;
  onImport: (q: DraftQuestion[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const name = slug(test?.title);

  const exportJson = () => {
    try { download(`${name}.cybersup-exam.json`, JSON.stringify(buildExamFile(test, questions), null, 2), "application/json"); }
    catch { notify("Un scénario JSON est invalide : corrigez-le avant d'exporter."); }
  };
  const exportCsv = () => {
    try { download(`${name}.csv`, examToCsv(questions), "text/csv;charset=utf-8"); }
    catch { notify("Un scénario JSON est invalide : corrigez-le avant d'exporter."); }
  };

  const read = async (f: File) => {
    setBusy(true);
    try {
      const x = await readExamFile(f);
      const rep = importReport(x);
      if (!x.questions.length) notify(`Aucune question importée. ${rep}`);
      else {
        onImport(x.questions.map(toDraftQuestion));
        notify(`${x.questions.length} question(s) ajoutée(s) depuis ${f.name}. Pensez à enregistrer.${rep ? ` ${rep}.` : ""}`, rep ? "info" : "ok");
      }
    } catch (e: any) {
      notify(`Import impossible : ${e?.message || "fichier illisible"}.`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm rounded-lg border border-line bg-surface/60 p-3">
      <span className="text-xs text-muted mr-1">Épreuve complète, tous types de questions :</span>
      <div className="flex flex-wrap items-center gap-1.5 ml-auto">
        <button className="btn-secondary !py-1.5 !px-3" onClick={exportJson} title="Réglages et questions avec corrigés et scénarios">Exporter (.json)</button>
        <button className="btn-secondary !py-1.5 !px-3" onClick={exportCsv} disabled={!questions.length}>Exporter (.csv)</button>
        <button className="btn !py-1.5 !px-3" disabled={locked || busy} onClick={() => input.current?.click()}
          title={locked ? "Des candidats ont déjà composé : questions verrouillées" : "Ajoute les questions du fichier à celles de l'épreuve"}>
          {busy ? "Lecture…" : "Importer des questions"}
        </button>
      </div>
      <input ref={input} type="file" accept=".json,.csv,.tsv,.txt,application/json,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
    </div>
  );
}
