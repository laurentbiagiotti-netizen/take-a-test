import type { SupabaseClient } from "@supabase/supabase-js";

/** Questions d'une épreuve au format de l'éditeur (corrigés, terminal, exercice externe compris). */
export async function loadDrafts(supabase: SupabaseClient, testId: string): Promise<any[]> {
  const { data: qs } = await supabase.from("questions").select("*").eq("test_id", testId).order("position");
  const ids = (qs || []).map((q: any) => q.id);
  if (!ids.length) return [];
  const [{ data: keys }, { data: terms }, { data: exts }] = await Promise.all([
    supabase.from("answer_keys").select("question_id, correct").in("question_id", ids),
    supabase.from("question_terminals").select("question_id, scenario, flag").in("question_id", ids),
    supabase.from("question_externals").select("question_id, tool, scenario, answer_key, time_limit_s, label").in("question_id", ids),
  ]);
  const keyMap = new Map((keys || []).map((k: any) => [k.question_id, k.correct]));
  const termMap = new Map((terms || []).map((t: any) => [t.question_id, { scenario: JSON.stringify(t.scenario, null, 2), flag: t.flag || "" }]));
  const extMap = new Map((exts || []).map((x: any) => [x.question_id, {
    tool: x.tool, label: x.label || "", time_limit_min: x.time_limit_s ? String(Math.round(x.time_limit_s / 60)) : "",
    scenario: JSON.stringify(x.scenario, null, 2), answer_key: x.answer_key ? JSON.stringify(x.answer_key, null, 2) : "",
  }]));
  return (qs || []).map((q: any) => ({ ...q, correct: keyMap.get(q.id) ?? null, terminal: termMap.get(q.id) ?? null, external: extMap.get(q.id) ?? null }));
}
