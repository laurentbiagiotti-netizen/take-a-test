import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { grade } from "@/lib/questions/kinds";
import { validateScenario } from "@/lib/terminal/shell";

const dir = path.resolve(__dirname, "../../supabase/seed/admission-2026");
const load = (n: string) => JSON.parse(readFileSync(path.join(dir, `${n}.json`), "utf8"));

describe.each(["b1", "b3", "mastere"])("QCM d'admission %s", (name) => {
  const t = load(name);
  const qcm = t.questions.filter((q: any) => q.type !== "terminal");
  const mission = t.questions.find((q: any) => q.type === "terminal");
  const groups = new Map<string, any[]>();
  for (const q of qcm) groups.set(q.variant_group, [...(groups.get(q.variant_group) || []), q]);

  it("deux variantes par question, de même type et même domaine", () => {
    for (const [g, list] of groups) {
      expect(g).toBeTruthy();
      expect(list).toHaveLength(2);
      expect(list[0].type).toBe(list[1].type);
      expect(list[0].domain).toBe(list[1].domain);
      expect(list[0].correct.length).toBe(list[1].correct.length);
    }
  });

  it("durée, total et seuil cohérents avec ce que voit un candidat", () => {
    const drawnPoints = groups.size + (mission?.points || 0);
    expect(t.duration_minutes).toBe(groups.size + (mission ? 8 : 0));
    expect(t.pass_mark).toBe(Math.ceil(drawnPoints / 2));
    expect(Object.values(t.domain_floors).every((f: any) => f > 0 && f < 1)).toBe(true);
  });

  it("chaque question a 4 réponses distinctes et une clé valide", () => {
    for (const q of qcm) {
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
    const p = qcm.map((q: any) => q.prompt);
    expect(new Set(p).size).toBe(p.length);
  });

  it("la bonne réponse ne se repère pas à sa longueur", () => {
    const single = qcm.filter((q: any) => q.correct.length === 1);
    const giveaway = single.filter((q: any) => {
      const lens = q.options.map((o: any) => o.text.length);
      const c = lens[q.options.findIndex((o: any) => o.id === q.correct[0])];
      const others = lens.filter((_: number, i: number) => q.options[i].id !== q.correct[0]);
      return c > 1.4 * Math.max(...others);
    });
    expect(giveaway.length / single.length).toBeLessThan(0.2);
  });

  it("pas de tiret cadratin ni d'esperluette dans les textes", () => {
    const txt = JSON.stringify(qcm.map((q: any) => [q.prompt, q.options, q.explanation, q.domain])) + t.description;
    expect(txt).not.toMatch(/—/);
    expect(txt.replace(/&&/g, "")).not.toMatch(/ & /);
  });

  if (mission) it("mission terminal valide", () => expect(validateScenario(mission.scenario)).toBeNull());
});
