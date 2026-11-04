import { describe, expect, it, vi } from "vitest";

/* Fausse base Supabase en mémoire : juste ce qu'utilisent les routes d'inscription. */
function fakeDb(seed: Record<string, any[]>) {
  const db: Record<string, any[]> = structuredClone(seed);
  const rpcs: any[] = [];
  const builder = (table: string) => {
    let rows = () => db[table] || [];
    const filters: ((r: any) => boolean)[] = [];
    let op: "select" | "insert" | "update" | "delete" = "select", payload: any = null, single = false, maybe = false, count = false, range: [number, number] | null = null, lim: number | null = null;
    const run = () => {
      if (op === "insert") { const r = { id: crypto.randomUUID(), created_at: new Date().toISOString(), used_at: null, used_by: null, ...payload }; if ((db[table] || []).some((x) => x.test_id === r.test_id && x.email === r.email)) return { data: null, error: { code: "23505", message: "duplicate" } }; (db[table] ||= []).push(r); return { data: r, error: null }; }
      const hit = rows().filter((r) => filters.every((f) => f(r)));
      if (op === "update") { for (const r of hit) { if (payload.email && db[table].some((x) => x !== r && x.test_id === (payload.test_id ?? r.test_id) && x.email === payload.email)) return { data: null, error: { code: "23505", message: "dup" } }; if (payload.test_id && db[table].some((x) => x !== r && x.test_id === payload.test_id && x.email === (payload.email ?? r.email))) return { data: null, error: { code: "23505", message: "dup" } }; Object.assign(r, payload); } return { data: single ? hit[0] : hit, error: null }; }
      if (op === "delete") { db[table] = rows().filter((r) => !hit.includes(r)); return { data: null, error: null }; }
      let out = hit; if (range) out = out.slice(range[0], range[1] + 1); if (lim) out = out.slice(0, lim);
      return { data: single || maybe ? (out[0] ?? null) : out, error: null, count: count ? hit.length : null };
    };
    const b: any = {
      select: (_c?: string, o?: any) => { if (o?.count) count = true; return b; },
      insert: (p: any) => { op = "insert"; payload = p; return b; },
      update: (p: any) => { op = "update"; payload = p; return b; },
      delete: () => { op = "delete"; return b; },
      eq: (k: string, v: any) => { filters.push((r) => r[k] === v); return b; },
      in: (k: string, v: any[]) => { filters.push((r) => v.includes(r[k])); return b; },
      order: () => b, range: (a: number, z: number) => { range = [a, z]; return b; }, limit: (n: number) => { lim = n; return b; },
      single: () => { single = true; return Promise.resolve(run()); }, maybeSingle: () => { maybe = true; return Promise.resolve(run()); },
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  };
  return { db, rpcs, client: { from: builder, rpc: (n: string, a: any) => { rpcs.push([n, a]); return Promise.resolve({ data: null, error: null }); } } as any };
}

vi.mock("@/lib/security/env", () => ({ appUrl: () => "https://exam.cybersup.ai" }));
import { cleanFields, enrich, upsertOne } from "@/lib/api/registrations";

const T1 = "11111111-1111-1111-1111-111111111111", T2 = "22222222-2222-2222-2222-222222222222";
const seed = () => ({
  tests: [{ id: T1, title: "Admission B1", duration_minutes: 50, opens_at: null, closes_at: null }, { id: T2, title: "Admission B3", duration_minutes: 50, opens_at: null, closes_at: null }],
  profiles: [{ id: "p-ines", email: "ines@exemple.fr" }],
  invites: [{ id: "33333333-3333-3333-3333-333333333333", test_id: T1, email: "ines@exemple.fr", code: "ABCD-EFGH", full_name: "Inès B", extra_minutes: 0, external_ref: "hs-1", used_at: "2026-11-03T10:00:00Z", used_by: "p-ines", created_at: "2026-11-01" }],
  attempts: [{ id: "a1", test_id: T1, candidate_id: "p-ines", status: "submitted", score: 41, max_score: 50, violation_count: 0, started_at: "x", submitted_at: "y", end_reason: null }],
});

describe("inscriptions (API v1)", () => {
  it("contrôle des champs", () => {
    expect(cleanFields({ email: "pas-un-mail" }, true)).toEqual({ error: "email invalide" });
    expect(cleanFields({ email: " Jean@Ex.FR ", extra_minutes: 20 }, true)).toEqual({ fields: { email: "jean@ex.fr", extra_minutes: 20 } });
    expect(cleanFields({ extra_minutes: 900 }, false)).toHaveProperty("error");
  });
  it("statut, copie, lien d'accès et convocation", async () => {
    const f = fakeDb(seed());
    const [r] = await enrich(f.client, f.db.invites, true);
    expect(r.status).toBe("submitted");
    expect(r.attempt.score).toBe(41);
    expect(r.access_url).toBe("https://exam.cybersup.ai/acces#code=ABCD-EFGH");
    expect(r.convocation.body).toContain("Admission B1");
  });
  it("création puis mise à jour idempotente (même épreuve, même e-mail)", async () => {
    const f = fakeDb(seed());
    const a = await upsertOne(f.client, T2, { email: "Jean@Ex.fr", full_name: "Jean D", external_ref: "grimp-9" });
    expect(a.status).toBe(201); expect(a.reg.status).toBe("registered"); expect(a.reg.code).toMatch(/\w/);
    const b = await upsertOne(f.client, T2, { email: "jean@ex.fr", extra_minutes: 15 });
    expect(b.status).toBe(200); expect(b.reg.extra_minutes).toBe(15); expect(b.reg.code).toBe(a.reg.code);
    expect(f.db.invites.filter((i) => i.email === "jean@ex.fr")).toHaveLength(1);
    expect(f.rpcs.map((x) => x[1].p_event)).toEqual(["registration.created", "registration.updated"]);
    expect(JSON.stringify(f.rpcs)).not.toContain(a.reg.code);
  });
});

/* Les routes elles-mêmes, avec l'authentification court-circuitée. */
let current: any;
vi.mock("@/lib/api/handler", async (orig) => {
  const real: any = await orig();
  return { ...real, withApi: (_s: string, h: any) => async (req: any, ctx: any) => h({ admin: current.client, req, scopes: [], keyId: "k", actorId: "u" }, await ctx.params) };
});
const req = (url: string, init?: any) => new Request(url, init) as any;
describe("routes /api/v1/registrations", async () => {
  const list = await import("@/app/api/v1/registrations/route");
  const one = await import("@/app/api/v1/registrations/[id]/route");
  it("liste filtrée par statut et par référence externe", async () => {
    current = fakeDb(seed());
    await upsertOne(current.client, T1, { email: "zoe@ex.fr" });
    const r = await (await list.GET(req("https://x/api/v1/registrations?test_id=" + T1 + "&status=registered"), { params: Promise.resolve({}) })).json();
    expect(r.data.map((x: any) => x.email)).toEqual(["zoe@ex.fr"]);
    const r2 = await (await list.GET(req("https://x/api/v1/registrations?external_ref=hs-1"), { params: Promise.resolve({}) })).json();
    expect(r2.data[0].status).toBe("submitted");
  });
  it("inscription en lot : créées, mises à jour, erreurs", async () => {
    current = fakeDb(seed());
    const res = await list.POST(req("https://x/api/v1/registrations", { method: "POST", body: JSON.stringify({ test_id: T1, registrations: [{ email: "a@ex.fr" }, { email: "ines@exemple.fr", full_name: "Inès Bernard" }, { email: "faux" }] }) }), { params: Promise.resolve({}) });
    const j = await res.json();
    expect([res.status, j.created, j.updated, j.errors]).toEqual([207, 1, 1, 1]);
  });
  it("changer d'épreuve avant le début, refusé après", async () => {
    current = fakeDb(seed());
    const a = await upsertOne(current.client, T1, { email: "lea@ex.fr" });
    const ok = await one.PATCH(req("https://x", { method: "PATCH", body: JSON.stringify({ test_id: T2, regenerate_code: true }) }), { params: Promise.resolve({ id: a.reg.id }) });
    const j = await ok.json();
    expect([ok.status, j.data.test_id, j.data.code === a.reg.code]).toEqual([200, T2, false]);
    const no = await one.PATCH(req("https://x", { method: "PATCH", body: JSON.stringify({ test_id: T2 }) }), { params: Promise.resolve({ id: "33333333-3333-3333-3333-333333333333" }) });
    expect(no.status).toBe(409);
    const tiers = await one.PATCH(req("https://x", { method: "PATCH", body: JSON.stringify({ extra_minutes: 20 }) }), { params: Promise.resolve({ id: "33333333-3333-3333-3333-333333333333" }) });
    expect(tiers.status).toBe(200);
  });
  it("désinscription : possible avant le début, refusée après", async () => {
    current = fakeDb(seed());
    const a = await upsertOne(current.client, T1, { email: "tom@ex.fr" });
    expect((await one.DELETE(req("https://x", { method: "DELETE" }), { params: Promise.resolve({ id: a.reg.id }) })).status).toBe(204);
    expect((await one.DELETE(req("https://x", { method: "DELETE" }), { params: Promise.resolve({ id: "33333333-3333-3333-3333-333333333333" }) })).status).toBe(409);
  });
});
