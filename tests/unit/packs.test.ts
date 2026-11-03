import { describe, expect, it } from "vitest";
import { PACKS } from "@/lib/questions/templates";
import { validateQuestion, grade } from "@/lib/questions/kinds";
import { autoScore, runSql } from "@/lib/questions/grade-server";

describe("packs d'exercices B1 et B3", () => {
  for (const k of ["b1", "b3"] as const) {
    it(`${k} : chaque exercice est valide`, () => {
      for (const q of PACKS[k].questions) expect([q.type, validateQuestion(q.type as any, q.options, q.correct)]).toEqual([q.type, null]);
    });
  }
  it("B3 SQL : la requête de référence trouve les connexions de nuit depuis l'étranger", async () => {
    const q = PACKS.b3.questions.find((x) => x.type === "sql")!;
    const [r] = await runSql(q.options.setup, [q.correct.expected_sql]);
    expect(r.rows.map((x) => x[0]).sort()).toEqual(["j.petit", "s.leroy"]);
    const alt = "select distinct compte from connexions where succes=1 and pays!='FR' and substr(heure,12,2) in ('00','01','02','03','04')";
    expect(await autoScore("sql", q.options, q.correct, { query: alt }, 2)).toBe(2);
  });
  it("B3 en-têtes : 5 champs notés", () => {
    const q = PACKS.b3.questions.find((x) => x.type === "headers")!;
    expect(grade("headers", 2, { fields: { origin_ip: "203.0.113.45", spf: "fail", dkim: "none", reply_to: "oui", verdict: "phishing" } }, q.correct)).toBe(2);
  });
});
