import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string }[] = [];
const events: any[] = [];
let connectedAt = "2026-11-20T00:00:00Z";
vi.mock("@/lib/google", () => ({
  googleConfigured: () => true,
  loadAccount: async () => ({ email: "ecole@cybersup.ai", token_sealed: "x", calendar_id: "primary", connected_at: connectedAt }),
  sendMail: async (_a: any, to: string, subject: string) => { sent.push({ to, subject }); },
  upsertEvent: async (_a: any, id: string | null, e: any) => { events.push(e); return id || "evt1"; },
}));
vi.mock("@/lib/security/env", () => ({ appUrl: () => "https://exam.cybersup.ai" }));

import { runMailsAndCalendar } from "@/lib/mails";

/** Faux client Supabase : tables en mémoire, filtres eq, neq et in. */
function fake(db: Record<string, any[]>) {
  const from = (table: string) => {
    let rows = db[table] || (db[table] = []);
    const q: any = {
      select: () => q,
      eq: (k: string, v: any) => { rows = rows.filter((r) => r[k] === v); return q; },
      neq: (k: string, v: any) => { rows = rows.filter((r) => r[k] !== v); return q; },
      in: (k: string, v: any[]) => { rows = rows.filter((r) => v.includes(r[k])); return q; },
      upsert: async (row: any) => {
        const i = db[table].findIndex((r) => r.test_id === row.test_id && r.email === row.email && r.kind === row.kind);
        if (i >= 0) db[table][i] = { ...db[table][i], ...row }; else db[table].push(row);
        return { error: null };
      },
      update: (patch: any) => ({ eq: async (k: string, v: any) => { db[table].filter((r) => r[k] === v).forEach((r) => Object.assign(r, patch)); return { error: null }; } }),
      then: (ok: any) => Promise.resolve({ data: rows, error: null }).then(ok),
    };
    return q;
  };
  return { from } as any;
}

const h = (n: number) => new Date(Date.now() + n * 3600 * 1000).toISOString();
const test = (over: any = {}) => ({ id: "t1", title: "Réseau", formation: "B1", campus: "Puteaux", room: "Seine", duration_minutes: 60, is_published: true,
  mail_convocation: true, mail_relance: true, calendar_event_id: null, calendar_hash: null, opens_at: h(24), closes_at: h(26), ...over });
const invite = (email: string, created = h(-1)) => ({ test_id: "t1", email, code: "ABC-DEF", full_name: "Inès Benali", extra_minutes: 0, created_at: created, preview: false });

describe("mails automatiques", () => {
  beforeEach(() => { sent.length = 0; events.length = 0; connectedAt = h(-48); });

  it("convoque une seule fois les inscrits postérieurs à la connexion du compte", async () => {
    const db = { tests: [test()], invites: [invite("a@cybersup.ai"), invite("ancien@cybersup.ai", h(-100))], mail_log: [], attempts: [] };
    const r1 = await runMailsAndCalendar(fake(db));
    expect(r1?.convocations).toBe(1);
    expect(sent.map((s) => s.to)).toEqual(["a@cybersup.ai"]);
    const r2 = await runMailsAndCalendar(fake(db));
    expect(r2?.convocations).toBe(0);
    expect(sent).toHaveLength(1);
    expect(events).toHaveLength(1);
  });

  it("ne convoque pas pour une épreuve non publiée ou dont l'option est coupée", async () => {
    await runMailsAndCalendar(fake({ tests: [test({ is_published: false })], invites: [invite("a@cybersup.ai")], mail_log: [], attempts: [] }));
    await runMailsAndCalendar(fake({ tests: [test({ mail_convocation: false })], invites: [invite("a@cybersup.ai")], mail_log: [], attempts: [] }));
    expect(sent).toHaveLength(0);
  });

  it("relance une seule fois, deux heures après la fin, ceux qui n'ont pas composé", async () => {
    const done = { opens_at: h(-5), closes_at: h(-3) };
    const db = { tests: [test(done)], invites: [invite("absent@cybersup.ai", h(-200)), invite("present@cybersup.ai", h(-200))], mail_log: [],
      attempts: [{ test_id: "t1", status: "submitted", candidate: { email: "present@cybersup.ai" } }] };
    const r = await runMailsAndCalendar(fake(db));
    expect(r?.relances).toBe(1);
    expect(sent.map((s) => s.to)).toEqual(["absent@cybersup.ai"]);
    await runMailsAndCalendar(fake(db));
    expect(sent).toHaveLength(1);
  });

  it("ne relance ni avant deux heures, ni pour une épreuve terminée avant la connexion", async () => {
    await runMailsAndCalendar(fake({ tests: [test({ opens_at: h(-3), closes_at: h(-1) })], invites: [invite("a@cybersup.ai", h(-200))], mail_log: [], attempts: [] }));
    connectedAt = h(-2);
    await runMailsAndCalendar(fake({ tests: [test({ opens_at: h(-9), closes_at: h(-5) })], invites: [invite("a@cybersup.ai", h(-200))], mail_log: [], attempts: [] }));
    expect(sent).toHaveLength(0);
  });
});
