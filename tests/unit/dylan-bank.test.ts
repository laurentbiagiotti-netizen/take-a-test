import { describe, it, expect } from "vitest";
import bank from "../../public/banque/qcm-dylan.json";

describe("banque des QCM de Dylan", () => {
  for (const [k, lv] of Object.entries(bank as Record<string, any>)) {
    it(`${k} : 50 questions et leurs variantes, corrigés valides`, () => {
      const groups = new Map<string, string[]>();
      for (const q of lv.questions) {
        expect(["mcq_single", "mcq_multi"]).toContain(q.type);
        expect(q.options).toHaveLength(4);
        const ids = q.options.map((o: any) => o.id);
        expect(q.correct.length).toBeGreaterThan(0);
        for (const c of q.correct) expect(ids).toContain(c);
        expect(q.type === "mcq_multi").toBe(q.correct.length > 1);
        expect(lv.domains).toContain(q.domain);
        expect(q.domain).not.toContain("&");
        groups.set(q.variant_group, [...(groups.get(q.variant_group) || []), q.variant]);
      }
      expect(groups.size).toBe(50);
      for (const v of groups.values()) expect(v.sort()).toEqual(["A", "B"]);
    });
  }
});
