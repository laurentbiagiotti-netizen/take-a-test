"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { importReport, readExamFile } from "@/components/admin/ExamFileTools";
import { toDraftQuestion } from "@/lib/admin/exam-file";
import { writeQuestions } from "@/lib/admin/save-questions";

export default function NewTest() {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [err, setErr] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const importExam = async (f: File) => {
    setImporting(true); setErr(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const x = await readExamFile(f);
      if (!x.questions.length) throw new Error(`aucune question reconnue. ${importReport(x)}`);
      const base = f.name.replace(/(\.cybersup-exam)?\.(json|csv)$/i, "");
      const row = { ...x.test, title: (x.test.title || base || "Épreuve importée").slice(0, 200), owner_id: user.id, is_published: false };
      const { data, error } = await supabase.from("tests").insert(row).select().single();
      if (error) throw new Error(error.message);
      const e2 = await writeQuestions(supabase as any, data.id, x.questions.map(toDraftQuestion));
      if (e2) throw new Error(`épreuve créée mais questions incomplètes : ${e2}`);
      const rep = importReport(x);
      router.push(`/admin/tests/${data.id}/questions${rep ? `?import=${encodeURIComponent(`${x.questions.length} question(s) importée(s). ${rep}`)}` : ""}`);
    } catch (e: any) {
      setErr(`Import impossible : ${e?.message || "fichier illisible"}.`);
    } finally {
      setImporting(false);
      if (file.current) file.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("tests").insert({ title, description, duration_minutes: duration, owner_id: user.id }).select().single();
    if (error) return setErr(error.message);
    router.push(`/admin/tests/${data.id}/questions`);
  };

  return (
    <main className="max-w-xl mx-auto px-6 py-10">
      <h1 className="h1">Nouvel examen</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="input" placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="block text-sm">Durée (minutes)
          <input className="input mt-1" type="number" min={1} value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} />
        </label>
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn">Créer</button>
      </form>
      <div className="card mt-8 text-sm">
        <div className="font-medium">Importer une épreuve</div>
        <p className="text-muted mt-1">Fichier exporté depuis une autre épreuve (.cybersup-exam.json : réglages et toutes les questions) ou CSV (une ligne par question). L&apos;épreuve est créée non publiée.</p>
        <button className="btn-secondary mt-3" disabled={importing} onClick={() => file.current?.click()}>{importing ? "Import…" : "Choisir un fichier"}</button>
        <input ref={file} type="file" accept=".json,.csv,.tsv,.txt,application/json,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importExam(e.target.files[0])} />
      </div>
    </main>
  );
}
