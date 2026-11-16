import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftQuestion } from "@/lib/admin/exam-file";

/** Types dont le corrigé est rangé dans answer_keys. */
export const KEYED_TYPES = ["mcq_single", "mcq_multi", "ordering", "matching", "hotspot", "short_answer", "sql", "decode", "password", "blocks", "headers",
  "subnet", "netpuzzle", "sokoban", "robot", "adsim", "tickets", "feed", "evtx", "bash", "sim"];

/**
 * Remplace toutes les questions d'une épreuve (questions, corrigés, scénarios
 * de terminal et d'exercices externes). Renvoie le premier message d'erreur.
 */
export async function writeQuestions(supabase: SupabaseClient, testId: string, questions: DraftQuestion[]): Promise<string | null> {
  const del = await supabase.from("questions").delete().eq("test_id", testId);
  if (del.error) return del.error.message;
  if (!questions.length) return null;
  const rows = questions.map((q, i) => ({
    test_id: testId, position: i, type: q.type, prompt: q.prompt,
    options: q.options, points: q.points,
    image_url: q.image_url ?? null,
    domain: q.domain?.trim() || null, variant_group: q.variant_group?.trim() || null,
    explanation: q.explanation?.trim() || null, time_limit_s: q.time_limit_s || null,
  }));
  const { data: inserted, error } = await supabase.from("questions").insert(rows).select("id");
  if (error) return error.message;
  let firstErr: string | null = null;
  const keyRows = (inserted || []).map((row: any, idx: number) => ({ question_id: row.id, correct: questions[idx].correct ?? [] }))
    .filter((_, idx) => KEYED_TYPES.includes(questions[idx].type));
  if (keyRows.length) { const r = await supabase.from("answer_keys").upsert(keyRows); firstErr ||= r.error?.message || null; }
  const termRows = (inserted || []).map((row: any, idx: number) => questions[idx].type === "terminal" && questions[idx].terminal ? ({
    question_id: row.id, scenario: JSON.parse(questions[idx].terminal!.scenario), flag: questions[idx].terminal!.flag.trim() || null,
  }) : null).filter(Boolean);
  if (termRows.length) { const r = await supabase.from("question_terminals").upsert(termRows as any[]); firstErr ||= r.error?.message || null; }
  const extRows = (inserted || []).map((row: any, idx: number) => {
    const x = questions[idx].external;
    if (questions[idx].type !== "external" || !x) return null;
    const minutes = parseInt(x.time_limit_min, 10);
    return {
      question_id: row.id, tool: x.tool, label: x.label.trim() || null,
      time_limit_s: Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : null,
      scenario: JSON.parse(x.scenario), answer_key: x.answer_key.trim() ? JSON.parse(x.answer_key) : null,
    };
  }).filter(Boolean);
  if (extRows.length) { const r = await supabase.from("question_externals").upsert(extRows as any[]); firstErr ||= r.error?.message || null; }
  return firstErr;
}
