import { describe, expect, it } from "vitest";
import { grade, validateQuestion } from "@/lib/questions/kinds";

describe("correction côté serveur (miroir JS)", () => {
  it("QCM : tout ou rien", () => {
    expect(grade("mcq_multi", 1, { selected: ["b", "c", "d"] }, ["b", "c", "d"])).toBe(1);
    expect(grade("mcq_multi", 1, { selected: ["b", "c"] }, ["b", "c", "d"])).toBe(0);
    expect(grade("mcq_multi", 1, { selected: ["a", "b", "c", "d"] }, ["b", "c", "d"])).toBe(0);
  });
  it("QCM : un doublon dans la réponse ne trompe pas la correction", () => {
    expect(grade("mcq_multi", 1, { selected: ["b", "b", "b"] }, ["b", "c", "d"])).toBe(0);
  });
  it("réponse absente ou malformée : 0 sans planter", () => {
    expect(grade("mcq_single", 1, null, ["a"])).toBe(0);
    expect(grade("mcq_single", 1, { selected: "a" }, ["a"])).toBe(0);
    expect(grade("matching", 2, { pairs: 5 }, { a: "x" })).toBe(0);
  });
  it("remise en ordre et association : crédit partiel", () => {
    expect(grade("ordering", 2, { order: ["a", "b", "d", "c"] }, ["a", "b", "c", "d"])).toBe(1);
    expect(grade("matching", 3, { pairs: { a: "1", b: "2", c: "9" } }, { a: "1", b: "2", c: "3" })).toBe(2);
  });
  it("repérage : les mauvaises cases annulent les bonnes", () => {
    expect(grade("hotspot", 2, { selected: ["s1", "s9"] }, ["s1", "s2"])).toBe(0);
    expect(grade("hotspot", 2, { selected: ["s1"] }, ["s1", "s2"])).toBe(1);
  });
  it("réponse courte : casse et espaces ignorés par défaut", () => {
    expect(grade("short_answer", 1, { text: "  198.51.100.23 " }, { answers: ["198.51.100.23"] })).toBe(1);
    expect(grade("short_answer", 1, { text: "flag" }, { answers: ["FLAG"], case_sensitive: true })).toBe(0);
  });
  it("une remise en ordre incomplète ou un repérage sans cible sont refusés à l'enregistrement", () => {
    const steps = [{ id: "a", text: "A" }, { id: "b", text: "B" }];
    expect(validateQuestion("ordering", steps, ["a"])).not.toBeNull();
    expect(validateQuestion("ordering", steps, ["b", "a"])).toBeNull();
    expect(validateQuestion("hotspot", { layout: "log", segments: [{ id: "1", text: "x" }, { id: "2", text: "y" }] }, [])).not.toBeNull();
  });
});
