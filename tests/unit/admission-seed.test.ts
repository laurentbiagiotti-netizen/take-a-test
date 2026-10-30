import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { grade } from "@/lib/questions/kinds";

const dir = path.resolve(__dirname, "../../supabase/seed/admission-2026");
const load = (n: string) => JSON.parse(readFileSync(path.join(dir, `${n}.json`), "utf8"));

describe.each(["b1", "b3", "mastere"])("QCM d'admission %s", (name) => {
  const t = load(name);
  it("une minute et un point par question, seuil à 50 %", () => {
    expect(t.duration_minutes).toBe(t.questions.length);
    expect(t.pass_mark).toBe(Math.ceil(t.questions.length / 2));
  });
  it("chaque question a 4 réponses distinctes et une clé valide", () => {
    for (const q of t.questions) {
      const ids = q.options.map((o: any) => o.id);
      expect(new Set(q.options.map((o: any) => o.text.trim())).size).toBe(4);
      expect(q.correct.length).toBeGreaterThan(0);
      q.correct.forEach((c: string) => expect(ids).toContain(c));
      expect(q.type).toBe(q.correct.length > 1 ? "mcq_multi" : "mcq_single");
      expect(q.explanation.length).toBeGreaterThan(10);
      expect(grade(q.type, 1, { selected: q.correct }, q.correct)).toBe(1);
    }
  });
  it("pas d'énoncé en double", () => {
    const p = t.questions.map((q: any) => q.prompt);
    expect(new Set(p).size).toBe(p.length);
  });
  it("la bonne réponse ne se repère pas à sa longueur", () => {
    const single = t.questions.filter((q: any) => q.correct.length === 1);
    const giveaway = single.filter((q: any) => {
      const lens = q.options.map((o: any) => o.text.length);
      const c = lens[q.options.findIndex((o: any) => o.id === q.correct[0])];
      const others = lens.filter((_: number, i: number) => q.options[i].id !== q.correct[0]);
      return c > 1.4 * Math.max(...others);
    });
    expect(giveaway.length / single.length).toBeLessThan(0.2);
  });
});
