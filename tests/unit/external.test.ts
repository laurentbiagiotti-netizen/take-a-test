import { afterEach, describe, expect, it } from "vitest";
import { peekAudience, resultSignature, signLaunch, toolConfig, verifyLaunch, verifyResultSignature, type LaunchPayload } from "@/lib/external/server";
import { checkKey, gradeChoices, isScenario, publicScenario } from "@/lib/external/grade";

const SECRET = "s".repeat(40);
const env = process.env;
afterEach(() => { process.env = { ...env }; });

function setTools() {
  process.env.EXTERNAL_CRIME_SECRET = SECRET;
  process.env.EXTERNAL_WIN95_SECRET = "w".repeat(40);
  process.env.EXTERNAL_WIN95_URL = "https://win95.exemple.fr/";
}

const payload = (over: Partial<LaunchPayload> = {}): LaunchPayload => ({
  v: 1, aud: "crime", sid: "0b1d6a2e-1111-4222-8333-444455556666", n: "abc", iat: 1_800_000_000,
  exp: Math.floor(Date.now() / 1000) + 600, api: "https://exam.cybersup.ai", scn: { count: 2 }, ...over,
});

describe("configuration des outils", () => {
  it("désactive un outil sans secret ou avec un secret trop court", () => {
    delete process.env.EXTERNAL_CRIME_SECRET;
    expect(toolConfig("crime")).toBeNull();
    process.env.EXTERNAL_CRIME_SECRET = "court";
    expect(toolConfig("crime")).toBeNull();
    expect(toolConfig("inconnu")).toBeNull();
  });
  it("lit l'adresse et en déduit l'origine", () => {
    setTools();
    expect(toolConfig("win95")).toMatchObject({ url: "https://win95.exemple.fr", origin: "https://win95.exemple.fr", grading: "platform" });
    expect(toolConfig("crime")?.url).toBe("https://crime.cybersup.ai");
  });
});

describe("jeton de lancement", () => {
  it("accepte un jeton intact et le rattache à son outil", async () => {
    setTools();
    const t = await signLaunch(payload(), SECRET);
    expect(peekAudience(t)).toBe("crime");
    expect(await verifyLaunch(t, toolConfig("crime")!)).toMatchObject({ sid: payload().sid, scn: { count: 2 } });
  });
  it("refuse un jeton modifié, destiné à un autre outil, ou expiré", async () => {
    setTools();
    const crime = toolConfig("crime")!;
    const t = await signLaunch(payload(), SECRET);
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload(), sid: "autre" })).toString("base64url");
    expect(await verifyLaunch(`${forged}.${sig}`, crime)).toBeNull();
    expect(await verifyLaunch(`${body}.${"0".repeat(64)}`, crime)).toBeNull();
    expect(await verifyLaunch(await signLaunch(payload({ aud: "win95" }), SECRET), crime)).toBeNull();
    expect(await verifyLaunch(await signLaunch(payload(), "x".repeat(40)), crime)).toBeNull();
    const old = payload({ exp: Math.floor(Date.now() / 1000) - 121 });
    expect(await verifyLaunch(await signLaunch(old, SECRET), crime)).toBeNull();
    expect(await verifyLaunch("pas-un-jeton", crime)).toBeNull();
  });
  it("laisse 2 minutes de marge après la fin pour un dernier envoi", async () => {
    setTools();
    const t = await signLaunch(payload({ exp: Math.floor(Date.now() / 1000) - 60 }), SECRET);
    expect(await verifyLaunch(t, toolConfig("crime")!)).not.toBeNull();
  });
});

describe("signature des résultats", () => {
  it("vérifie le corps exact et la fenêtre de 5 minutes", async () => {
    setTools();
    const crime = toolConfig("crime")!;
    const ts = String(Math.floor(Date.now() / 1000));
    const body = '{"seq":1,"score_ratio":0.5}';
    const sig = await resultSignature(SECRET, ts, body);
    expect(await verifyResultSignature(crime, ts, sig, body)).toBe(true);
    expect(await verifyResultSignature(crime, ts, sig, body.replace("0.5", "1"))).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 400);
    expect(await verifyResultSignature(crime, old, await resultSignature(SECRET, old, body), body)).toBe(false);
    expect(await verifyResultSignature(crime, "abc", sig, body)).toBe(false);
  });
});

describe("correction par la plateforme", () => {
  const scn = {
    intro: "Triez",
    items: [
      { id: "m1", kind: "mail", data: { subject: "Colis", isLegit: false, consequence: { payload: "cube" }, nested: [{ tell: "domaine", ok: 1 }] } },
      { id: "u1", kind: "url", data: { url: "https://www.impots.gouv.fr", safe_reason: "gouv" } },
      { id: "s1", kind: "sms", data: { text: "Code 1234" } },
    ],
  };
  it("retire du contenu public tout ce qui trahit la réponse", () => {
    const pub = JSON.stringify(publicScenario(scn));
    for (const k of ["isLegit", "consequence", "tell", "safe_reason"]) expect(pub).not.toContain(k);
    expect(pub).toContain("Colis");
    expect(pub).toContain('"ok":1');
  });
  it("note bonnes réponses, erreurs et oublis", () => {
    const g = gradeChoices(scn, { m1: "fraud", u1: "legit", s1: "legit" }, { m1: "fraud", u1: "fraud", zz: "legit", s1: "peut-être" });
    expect(g).toMatchObject({ raw: 1, max: 3, details: { answered: 2 } });
    expect(g.ratio).toBeCloseTo(1 / 3);
  });
  it("contrôle la cohérence scénario et corrigé", () => {
    expect(isScenario(scn)).toBe(true);
    expect(isScenario({ items: [{ id: "a", kind: "x" }, { id: "a", kind: "x" }] })).toBe(false);
    expect(checkKey(scn, { m1: "fraud", u1: "legit", s1: "legit" })).toEqual([]);
    expect(checkKey(scn, { m1: "fraud", u1: "oui" })).toHaveLength(2);
    expect(checkKey(scn, { m1: "fraud", u1: "legit", s1: "legit", x9: "fraud" })).toHaveLength(1);
  });
});
