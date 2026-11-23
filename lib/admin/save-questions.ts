import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftQuestion } from "@/lib/admin/exam-file";

/** Types dont le corrigé est rangé dans answer_keys. */
export const KEYED_TYPES = ["mcq_single", "mcq_multi", "ordering", "matching", "hotspot", "short_answer", "sql", "decode", "password", "blocks", "headers",
  "subnet", "netpuzzle", "sokoban", "robot", "adsim", "tickets", "feed", "evtx", "bash", "sim"];

type Q = DraftQuestion & { id?: string; difficulty?: string | null; origin_id?: string | null };

/**
 * Enregistre les questions d'une épreuve : les questions existantes sont mises à jour
 * (ce qui garde leur historique de versions), les nouvelles sont créées, les retirées
 * supprimées. Renvoie le premier message d'erreur.
 */
export async function writeQuestions(supabase: SupabaseClient, testId: string, questions: Q[]): Promise<string | null> {
  const { data: existing, error: e0 } = await supabase.from("questions").select("id").eq("test_id", testId);
  if (e0) return e0.message;
  const keep = new Set(questions.map((q) => q.id).filter(Boolean) as string[]);
  const gone = (existing || []).map((r: any) => r.id).filter((x: string) => !keep.has(x));
  if (gone.length) {
    const del = await supabase.from("questions").delete().in("id", gone);
    if (del.error) return del.error.message;
  }
  const row = (q: Q, i: number) => ({
    test_id: testId, position: i, type: q.type, prompt: q.prompt, options: q.options, points: q.points,
    image_url: q.image_url ?? null, domain: q.domain?.trim() || null, variant_group: q.variant_group?.trim() || null,
    explanation: q.explanation?.trim() || null, time_limit_s: q.time_limit_s || null,
    difficulty: q.difficulty || null, ...(q.origin_id ? { origin_id: q.origin_id } : {}),
  });
  const ids: string[] = [];
  for (const [i, q] of questions.entries()) {
    if (q.id && (existing || []).some((r: any) => r.id === q.id)) {
      const { error } = await supabase.from("questions").update(row(q, i)).eq("id", q.id);
      if (error) return error.message;
      ids.push(q.id);
    } else {
      const { data, error } = await supabase.from("questions").insert(row(q, i)).select("id").single();
      if (error || !data) return error?.message || "Question non créée.";
      ids.push(data.id);
      q.id = data.id;
    }
  }
  let firstErr: string | null = null;
  const keyRows = questions.map((q, i) => ({ question_id: ids[i], correct: q.correct ?? [] })).filter((_, i) => KEYED_TYPES.includes(questions[i].type));
  if (keyRows.length) { const r = await supabase.from("answer_keys").upsert(keyRows); firstErr ||= r.error?.message || null; }
  const termRows = questions.map((q, i) => q.type === "terminal" && q.terminal ? ({
    question_id: ids[i], scenario: JSON.parse(q.terminal.scenario), flag: q.terminal.flag.trim() || null,
  }) : null).filter(Boolean);
  if (termRows.length) { const r = await supabase.from("question_terminals").upsert(termRows as any[]); firstErr ||= r.error?.message || null; }
  const extRows = questions.map((q, i) => {
    const x = q.external;
    if (q.type !== "external" || !x) return null;
    const minutes = parseInt(x.time_limit_min, 10);
    return {
      question_id: ids[i], tool: x.tool, label: x.label.trim() || null,
      time_limit_s: Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : null,
      scenario: JSON.parse(x.scenario), answer_key: x.answer_key.trim() ? JSON.parse(x.answer_key) : null,
    };
  }).filter(Boolean);
  if (extRows.length) { const r = await supabase.from("question_externals").upsert(extRows as any[]); firstErr ||= r.error?.message || null; }
  return firstErr;
}
