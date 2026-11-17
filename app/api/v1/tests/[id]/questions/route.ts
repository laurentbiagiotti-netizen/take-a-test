import { NextResponse } from "next/server";
import { apiError, body, UUID, withApi, type ApiCtx } from "@/lib/api/handler";
import { build } from "@/lib/api/questions";

/**
 * GET  : questions de l'épreuve dans l'ordre. Avec la portée tests:write, chaque
 *        question porte aussi son corrigé (correct), son terminal et son exercice externe.
 * PUT  : remplace toutes les questions (500 max).
 * POST : ajoute des questions à la suite des existantes (même format).
 * Refusés en 409 (questions_locked) dès qu'un vrai candidat a composé ; les copies
 * d'essai de l'équipe (aperçu) ne verrouillent pas.
 *
 * Question : { type, prompt, points?, domain?, variant_group?, explanation?, time_limit_s?, image_url?,
 *   options?, correct? (ou key),
 *   terminal?: { scenario, flag? },
 *   external?: { tool, label?, time_limit_s?, scenario?, answer_key? } }
 * QCM : options [{ id?, text, image_url? }] et correct en index (0, 1…) ou en id d'option ("a", "b"…).
 */
export const GET = withApi<{ id: string }>("tests:read", async ({ admin, scopes }, { id }) => {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const { data: qs } = await admin.from("questions").select("*").eq("test_id", id).order("position");
  if (!scopes.includes("tests:write") || !qs?.length) return NextResponse.json({ data: qs || [] });
  const ids = qs.map((q) => q.id);
  const [{ data: k }, { data: t }, { data: x }] = await Promise.all([
    admin.from("answer_keys").select("*").in("question_id", ids),
    admin.from("question_terminals").select("*").in("question_id", ids),
    admin.from("question_externals").select("*").in("question_id", ids),
  ]);
  const keys = new Map((k || []).map((r) => [r.question_id, r.correct]));
  const terms = new Map((t || []).map((r) => [r.question_id, { scenario: r.scenario, flag: r.flag }]));
  const exts = new Map((x || []).map(({ question_id, ...r }) => [question_id, r]));
  return NextResponse.json({ data: qs.map((q) => ({ ...q, correct: keys.get(q.id) ?? null, terminal: terms.get(q.id) ?? null, external: exts.get(q.id) ?? null })) });
});

async function locked(admin: ApiCtx["admin"], testId: string) {
  const [{ data: started }, { data: previews }] = await Promise.all([
    admin.from("attempts").select("candidate:profiles(email)").eq("test_id", testId).neq("status", "pending"),
    admin.from("invites").select("email").eq("test_id", testId).eq("preview", true),
  ]);
  const prev = new Set((previews || []).map((p: any) => p.email));
  return (started || []).some((a: any) => !prev.has(a.candidate?.email));
}

async function write(admin: ApiCtx["admin"], b: { rows: any[]; keyRows: any[]; termRows: any[]; extRows: any[] }) {
  if (!b.rows.length) return null;
  const ins = await admin.from("questions").insert(b.rows);
  if (ins.error) return ins.error.message;
  for (const [table, rows] of [["answer_keys", b.keyRows], ["question_terminals", b.termRows], ["question_externals", b.extRows]] as const) {
    if (rows.length) { const r = await admin.from(table).insert(rows); if (r.error) return `${table} : ${r.error.message}`; }
  }
  return null;
}

async function save(ctx: ApiCtx, id: string, mode: "replace" | "append") {
  if (!UUID.test(id)) return apiError(404, "not_found");
  const { data: test } = await ctx.admin.from("tests").select("id").eq("id", id).maybeSingle();
  if (!test) return apiError(404, "not_found");
  const input = await body<any[]>(ctx.req, 4 * 1024 * 1024);
  if (!Array.isArray(input) || input.length > 500) return apiError(400, "validation_error", "Tableau de questions attendu (500 max)");
  if (await locked(ctx.admin, id)) return apiError(409, "questions_locked", "Des candidats ont déjà composé : dupliquez l'épreuve");
  let start = 0;
  if (mode === "append") {
    const { count } = await ctx.admin.from("questions").select("id", { count: "exact", head: true }).eq("test_id", id);
    start = count ?? 0;
    if (start + input.length > 2000) return apiError(400, "validation_error", "2000 questions maximum par épreuve");
  }
  const b = build(id, input, start);
  if ("error" in b) return apiError(400, "validation_error", b.error);
  if (mode === "replace") {
    const del = await ctx.admin.from("questions").delete().eq("test_id", id);
    if (del.error) return apiError(409, "questions_locked", del.error.message);
  }
  const err = await write(ctx.admin, b);
  if (err) return apiError(400, "validation_error", err);
  return NextResponse.json({ data: { count: b.rows.length, total: start + b.rows.length } }, { status: mode === "append" ? 201 : 200 });
}

export const PUT = withApi<{ id: string }>("tests:write", (ctx, { id }) => save(ctx, id, "replace"));
export const POST = withApi<{ id: string }>("tests:write", (ctx, { id }) => save(ctx, id, "append"));
