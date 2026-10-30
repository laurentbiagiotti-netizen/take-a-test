import { NextResponse } from "next/server";
import { apiError, body, UUID, withApi } from "@/lib/api/handler";
import { validateScenario } from "@/lib/terminal/shell";
import { validateQuestion, type QType } from "@/lib/questions/kinds";

/**
 * GET : questions du test (les bonnes réponses ne sont incluses que si la
 * clé possède aussi la portée tests:write).
 * PUT : remplace toutes les questions (refusé si des candidats ont commencé).
 *   [{ type, prompt, points, image_url?, options?: [{id?, text, image_url?}], correct?: [optionId|index],
 *      terminal?: { scenario: {...}, flag?: "CYBER{...}" },
 *      // types ordering / matching / hotspot / short_answer : options + key (voir openapi.yaml)
 *    }]
 */
export const GET = withApi<{ id: string }>("tests:read", async ({ admin, scopes }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const { data: qs } = await admin.from("questions").select("*").eq("test_id", id).order("position");
  let keys = new Map<string, unknown>();
  let terms = new Map<string, unknown>();
  if (scopes.includes("tests:write") && qs?.length) {
    const ids = qs.map((q) => q.id);
    const { data: k } = await admin.from("answer_keys").select("*").in("question_id", ids);
    keys = new Map((k || []).map((r) => [r.question_id, r.correct]));
    const { data: t } = await admin.from("question_terminals").select("*").in("question_id", ids);
    terms = new Map((t || []).map((r) => [r.question_id, { scenario: r.scenario, flag: r.flag }]));
  }
  return NextResponse.json({ data: (qs || []).map((q) => scopes.includes("tests:write")
    ? { ...q, correct: keys.get(q.id) ?? null, terminal: terms.get(q.id) ?? null } : q) });
});

const TYPES = new Set(["mcq_single", "mcq_multi", "long_text", "terminal", "ordering", "matching", "hotspot", "short_answer"]);
const FUN = new Set(["ordering", "matching", "hotspot", "short_answer"]);

export const PUT = withApi<{ id: string }>("tests:write", async ({ admin, req }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const input = await body<any[]>(req, 2 * 1024 * 1024);
  if (!Array.isArray(input) || input.length > 500) return apiError(400, "validation_error", "Tableau de questions attendu (500 max)");

  const { count } = await admin.from("attempts").select("id", { count: "exact", head: true })
    .eq("test_id", id).neq("status", "pending");
  if ((count ?? 0) > 0) return apiError(409, "questions_locked", "Des candidats ont déjà composé : dupliquez le test");

  const rows: any[] = [];
  const keyRows: any[] = [];
  const termRows: any[] = [];
  for (const [i, q] of input.entries()) {
    if (!q || !TYPES.has(q.type) || typeof q.prompt !== "string" || !q.prompt.trim()) {
      return apiError(400, "validation_error", `Question ${i + 1} invalide`);
    }
    const qid = crypto.randomUUID();
    let options = null;
    if (FUN.has(q.type)) {
      const err = validateQuestion(q.type as QType, q.options, q.key);
      if (err) return apiError(400, "validation_error", `Question ${i + 1} : ${err}`);
      options = q.options;
      keyRows.push({ question_id: qid, correct: q.key });
    } else if (q.type === "terminal") {
      const err = validateScenario(q.terminal?.scenario);
      if (err) return apiError(400, "validation_error", `Question ${i + 1} : ${err}`);
      const flag = String(q.terminal?.flag || "").trim();
      if (flag.length > 200) return apiError(400, "validation_error", `Question ${i + 1} : flag de 200 caractères maximum`);
      if (!flag && !(q.terminal.scenario.objectives || []).length) return apiError(400, "validation_error", `Question ${i + 1} : au moins une mission ou un flag`);
      termRows.push({ question_id: qid, scenario: q.terminal.scenario, flag: flag || null });
    } else if (q.type !== "long_text") {
      if (!Array.isArray(q.options) || q.options.length < 2) return apiError(400, "validation_error", `Question ${i + 1} : 2 options minimum`);
      options = q.options.map((o: any) => ({ id: crypto.randomUUID(), text: String(o.text ?? ""), image_url: o.image_url ?? null, _ref: o.id }));
      const correct = (Array.isArray(q.correct) ? q.correct : []).map((c: any) => {
        const byIdx = typeof c === "number" ? options![c] : options!.find((o: any) => o._ref === c);
        return byIdx?.id;
      }).filter(Boolean);
      if (!correct.length) return apiError(400, "validation_error", `Question ${i + 1} : au moins une bonne réponse`);
      if (q.type === "mcq_single" && correct.length !== 1) return apiError(400, "validation_error", `Question ${i + 1} : une seule bonne réponse`);
      options = options.map(({ _ref, ...o }: any) => o);
      keyRows.push({ question_id: qid, correct });
    }
    rows.push({ id: qid, test_id: id, position: i, type: q.type, prompt: q.prompt, points: Number(q.points ?? 1), image_url: q.image_url ?? null, options });
  }

  const del = await admin.from("questions").delete().eq("test_id", id);
  if (del.error) return apiError(409, "questions_locked", del.error.message);
  if (rows.length) {
    const ins = await admin.from("questions").insert(rows);
    if (ins.error) return apiError(400, "validation_error", ins.error.message);
    if (keyRows.length) await admin.from("answer_keys").insert(keyRows);
    if (termRows.length) await admin.from("question_terminals").insert(termRows);
  }
  return NextResponse.json({ data: { count: rows.length } });
});
