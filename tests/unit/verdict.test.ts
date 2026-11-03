import { describe, expect, it } from "vitest";
import { fmt20, verdictFor } from "@/lib/exam/verdict";

describe("résultat sur 20", () => {
  const t = { pass: 10, fail: 8 };
  it("réussi, à statuer, échoué selon les seuils", () => {
    expect(verdictFor(10, t)).toBe("pass");
    expect(verdictFor(9.99, t)).toBe("review");
    expect(verdictFor(8, t)).toBe("review");
    expect(verdictFor(7.99, t)).toBe("fail");
    expect(verdictFor(null, t)).toBeNull();
  });
  it("à statuer si une réponse rédigée attend sa correction ou si un plancher manque", () => {
    expect(verdictFor(18, t, { needsManual: true })).toBe("review");
    expect(verdictFor(18, t, { belowFloors: true })).toBe("review");
    expect(verdictFor(5, t, { belowFloors: true })).toBe("fail");
  });
  it("affiche la note à la française", () => {
    expect(fmt20(12.5)).toBe("12,5/20");
    expect(fmt20(null)).toBe("-");
  });
});
