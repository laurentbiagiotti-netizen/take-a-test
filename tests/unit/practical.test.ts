import { describe, expect, it } from "vitest";
import { encodeForRecipe, runRecipe } from "@/lib/questions/decode";
import { decide, gradeFirewall, validProgram, type FwProgram } from "@/lib/questions/firewall";
import { autoScore, passwordOrder, runSql } from "@/lib/questions/grade-server";
import { validateQuestion, grade } from "@/lib/questions/kinds";
import { PRACTICAL_TEMPLATES as T } from "@/lib/questions/templates";

const clone = (x: any) => JSON.parse(JSON.stringify(x));

describe("décodage", () => {
  it("fabrique un message que la recette attendue décode", () => {
    const recipe = [{ op: "from_hex" as const }, { op: "xor" as const, arg: "k3y" }, { op: "from_base64" as const }, { op: "caesar" as const, arg: "-5" }];
    const enc = encodeForRecipe("CYBER{x0r_m4g1c}", recipe);
    expect(runRecipe(enc, recipe).text).toBe("CYBER{x0r_m4g1c}");
  });
  it("signale l'étape qui échoue", () => {
    expect(runRecipe("pas du base64 !!", [{ op: "from_base64" }]).failedAt).toBe(0);
  });
  it("le modèle est valide et noté comme une réponse courte", () => {
    const t = clone(T.decode);
    expect(validateQuestion("decode", t.options, t.correct)).toBeNull();
    expect(runRecipe(t.options.input, t.correct.recipe).text).toBe(t.correct.answers[0]);
    expect(grade("decode", 2, { text: t.correct.answers[0] }, t.correct)).toBe(2);
  });
});

describe("pare-feu en blocs", () => {
  const good: FwProgram = { default: "block", rules: [
    { cond: { field: "dst_port", op: "in_list", value: "80, 443" }, action: "allow" },
    { cond: { and: [{ field: "dst_port", op: "eq", value: "22" }, { field: "src_ip", op: "in_cidr", value: "10.0.0.0/8" }] }, action: "allow" },
  ] };
  it("la bonne solution a tous les points", () => {
    const t = clone(T.blocks);
    expect(validateQuestion("blocks", t.options, t.correct)).toBeNull();
    expect(gradeFirewall(good, t.correct.packets, 3)).toMatchObject({ score: 3, correct: 16 });
  });
  it("tout bloquer ou tout autoriser ne rapporte rien", () => {
    const t = clone(T.blocks);
    expect(gradeFirewall({ default: "block", rules: [] }, t.correct.packets, 3).score).toBe(0);
    expect(gradeFirewall({ default: "allow", rules: [] }, t.correct.packets, 3).score).toBe(0);
  });
  it("première règle qui correspond, réseaux CIDR", () => {
    expect(decide(good, { id: "x", src_ip: "11.0.0.1", dst_port: 22, protocol: "tcp" })).toBe("block");
    expect(decide(good, { id: "x", src_ip: "10.255.1.1", dst_port: 22, protocol: "tcp" })).toBe("allow");
  });
  it("refuse un programme mal formé", () => {
    expect(validProgram({ default: "allow", rules: [{ cond: { field: "rm -rf", op: "eq", value: "x" }, action: "allow" }] })).toBe(false);
  });
});

describe("SQL (serveur)", () => {
  it("note la requête de référence du modèle à 2 points", async () => {
    const t = clone(T.sql);
    expect(validateQuestion("sql", t.options, t.correct)).toBeNull();
    expect(await autoScore("sql", t.options, t.correct, { query: "select distinct login from connexions where succes=1 and heure like '% 02:%' or (succes=1 and heure like '% 03:%')" }, 2)).toBe(2);
    expect(await autoScore("sql", t.options, t.correct, { query: "SELECT login FROM connexions" }, 2)).toBe(0);
  });
  it("coupe une requête infinie au bout de 2 secondes", async () => {
    const t0 = Date.now();
    const [r] = await runSql("CREATE TABLE x(a);", ["WITH RECURSIVE c(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM c) SELECT count(*) FROM c"], 1500);
    expect(r.error).toMatch(/trop longue/);
    expect(Date.now() - t0).toBeLessThan(4000);
  }, 10000);
  it("mode injection : contournement de l'authentification", async () => {
    const o = { mode: "injection", setup: "CREATE TABLE comptes(login, mdp); INSERT INTO comptes VALUES ('admin','Xk9!pq'),('eve','soleil');", template: "SELECT login FROM comptes WHERE login = '{input}' AND mdp = 'inconnu'" };
    const k = { must_contain: "admin" };
    expect(validateQuestion("sql", o, k)).toBeNull();
    expect(await autoScore("sql", o, k, { query: "admin' --" }, 2)).toBe(2);
    expect(await autoScore("sql", o, k, { query: "admin" }, 2)).toBe(0);
  });
});

describe("mots de passe (zxcvbn)", () => {
  it("classe azerty123 et P@ssw0rd2024 parmi les plus faibles, la phrase de passe plus haut", async () => {
    const t = clone(T.password);
    expect(validateQuestion("password", t.options, null)).toBeNull();
    const order = await passwordOrder(t.options.items);
    expect(order.slice(0, 2).sort()).toEqual(["p1", "p2"]);
    expect(order.indexOf("p4")).toBeGreaterThan(order.indexOf("p2"));
    expect(await autoScore("password", t.options, null, { order }, 2)).toBe(2);
  });
  it("création : politique et robustesse", async () => {
    const o = { mode: "create", policy: { min_length: 12, upper: true, digit: true, symbol: true, min_score: 3, forbid: ["cybersup"] } };
    expect(await autoScore("password", o, null, { text: "Cybersup2026!!" }, 1)).toBe(0);
    expect(await autoScore("password", o, null, { text: "Password1234!" }, 1)).toBe(0);
    expect(await autoScore("password", o, null, { text: "Tortue-Velo-Nuage-47" }, 1)).toBe(1);
  });
});
