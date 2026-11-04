import { NextResponse } from "next/server";
import { apiError, body, UUID, withApi } from "@/lib/api/handler";
import { enrich, EMAIL, REG_STATUSES, upsertOne } from "@/lib/api/registrations";

/**
 * GET /api/v1/registrations : liste des inscriptions.
 * Filtres : test_id, email, external_ref, status (registered, started, submitted, terminated, expired),
 * include=convocation (texte de convocation prêt à envoyer), limit (1 à 500, 100 par défaut), offset.
 */
export const GET = withApi("invites:read", async ({ admin, req }) => {
  const q = new URL(req.url).searchParams;
  const testId = q.get("test_id"), email = q.get("email"), ref = q.get("external_ref"), status = q.get("status");
  if (testId && !UUID.test(testId)) return apiError(400, "validation_error", "test_id invalide");
  if (email && !EMAIL.test(email)) return apiError(400, "validation_error", "email invalide");
  if (status && !(REG_STATUSES as readonly string[]).includes(status)) return apiError(400, "validation_error", `status : ${REG_STATUSES.join(", ")}`);
  const limit = Math.min(500, Math.max(1, Number(q.get("limit") || 100) || 100));
  const offset = Math.max(0, Number(q.get("offset") || 0) || 0);
  let sel = admin.from("invites").select("id, test_id, email, code, full_name, extra_minutes, external_ref, used_at, used_by, created_at", { count: "exact" })
    .order("created_at", { ascending: false });
  if (testId) sel = sel.eq("test_id", testId);
  if (email) sel = sel.eq("email", email.trim().toLowerCase());
  if (ref) sel = sel.eq("external_ref", ref);
  // Le statut se calcule d'après les copies : on filtre après coup, sur une fenêtre plus large.
  const { data, count, error } = status ? await sel.limit(5000) : await sel.range(offset, offset + limit - 1);
  if (error) return apiError(500, "server_error");
  let rows = await enrich(admin, data || [], q.get("include") === "convocation");
  let total = count ?? rows.length;
  if (status) { rows = rows.filter((r) => r.status === status); total = rows.length; rows = rows.slice(offset, offset + limit); }
  return NextResponse.json({ data: rows, total, limit, offset });
});

/**
 * POST /api/v1/registrations : inscrit un candidat, ou met à jour son inscription s'il est déjà inscrit à cette épreuve.
 * Corps : { test_id, email, full_name?, extra_minutes?, external_ref? }
 *    ou  { test_id, registrations: [ { email, … }, … ] } (500 au plus).
 * Réponse 201 (créée) ou 200 (déjà inscrit, mise à jour), avec le code et le lien d'accès personnel.
 */
export const POST = withApi("invites:write", async ({ admin, req }) => {
  const input = await body<any>(req);
  const testId = String(input?.test_id || "");
  if (!UUID.test(testId)) return apiError(400, "validation_error", "test_id requis");
  const { data: test } = await admin.from("tests").select("id").eq("id", testId).maybeSingle();
  if (!test) return apiError(404, "not_found", "Épreuve introuvable");
  if (Array.isArray(input.registrations)) {
    if (!input.registrations.length || input.registrations.length > 500) return apiError(400, "validation_error", "1 à 500 inscriptions par appel");
    const results = [];
    for (const r of input.registrations) {
      const x = await upsertOne(admin, testId, r);
      results.push(x.error ? { email: r?.email ?? null, error: x.error } : { ...x.reg, created: x.created });
    }
    return NextResponse.json({ data: results, created: results.filter((r: any) => r.created).length, updated: results.filter((r: any) => r.created === false).length, errors: results.filter((r: any) => r.error).length }, { status: 207 });
  }
  const x = await upsertOne(admin, testId, input);
  if (x.error) return apiError(x.status, "validation_error", x.error);
  return NextResponse.json({ data: x.reg }, { status: x.status });
});
