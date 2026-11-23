"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/Toaster";
import { createClient } from "@/lib/supabase/client";
import { pickTest } from "@/lib/admin/exam-file";
import { loadDrafts } from "@/lib/admin/load-questions";
import { writeQuestions } from "@/lib/admin/save-questions";

/** Duplique une épreuve (réglages et questions, sans les copies ni les inscriptions) en brouillon. */
export default function DuplicateButton({ id, title, className = "" }: { id: string; title: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (busy || !confirm(`Dupliquer « ${title} » ?\n\nLa copie reprend les réglages et les questions, en brouillon, sans les copies ni les inscriptions.`)) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: src } = await supabase.from("tests").select("*").eq("id", id).single();
      if (!user || !src) throw new Error("épreuve introuvable");
      const extra = Object.fromEntries(["draw_rules", "campus", "room"].filter((k) => src[k] != null).map((k) => [k, src[k]]));
      const { data: t, error } = await supabase.from("tests").insert({ ...pickTest(src), ...extra, title: `${src.title} (copie)`.slice(0, 200), owner_id: user.id, is_published: false }).select("id").single();
      if (error || !t) throw new Error(error?.message || "création impossible");
      const drafts = (await loadDrafts(supabase as any, id)).map(({ id: origin, test_id: _t, created_at: _c, ...q }: any) => ({ ...q, origin_id: origin }));
      const err = await writeQuestions(supabase as any, t.id, drafts);
      if (err) notify(`Copie créée, mais : ${err}`);
      else notify(`« ${src.title} » dupliquée avec ${drafts.length} question(s).`, "ok");
      router.push(`/admin/tests/${t.id}/questions`);
    } catch (x: any) { notify(`Duplication impossible : ${x?.message || "erreur"}.`); setBusy(false); }
  };
  return (
    <button onClick={run} disabled={busy} title="Dupliquer cette épreuve" aria-label={`Dupliquer ${title}`} className={className}>
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></svg>
      {busy ? "Copie…" : "Dupliquer"}
    </button>
  );
}
