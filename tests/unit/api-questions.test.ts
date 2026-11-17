import { describe, it, expect } from "vitest";
import { build } from "@/lib/api/questions";

describe("API questions : tous les champs sont gardés", () => {
  it("domaine, explication, variante, temps, QCM par id ou index", () => {
    const b: any = build("t", [
      { type: "mcq_single", prompt: "Port SSH ?", points: 1, domain: "Réseau", explanation: "SSH écoute sur 22", variant_group: "ssh", time_limit_s: 45,
        options: [{ id: "a", text: "22" }, { id: "b", text: "80" }], correct: ["a"] },
      { type: "mcq_multi", prompt: "Chiffrés ?", options: [{ text: "HTTPS" }, { text: "Telnet" }, { text: "SSH" }], correct: [0, 2], domain: "Réseau" },
      { type: "short_answer", prompt: "Commande ?", options: {}, correct: { answers: ["ls"], case_sensitive: false }, domain: "Linux" },
      { type: "long_text", prompt: "Expliquez", explanation: "attendu : …" },
      { type: "external", prompt: "Géoloc", external: { tool: "geoguess", time_limit_s: 600, scenario: { cas: 1 } } },
    ], 3);
    expect(b.error).toBeUndefined();
    expect(b.rows[0]).toMatchObject({ domain: "Réseau", explanation: "SSH écoute sur 22", variant_group: "ssh", time_limit_s: 45, position: 3 });
    expect(b.keyRows[0].correct).toEqual(["a"]);
    expect(b.keyRows[1].correct).toEqual(["a", "c"]);
    expect(b.keyRows[2].correct).toEqual({ answers: ["ls"], case_sensitive: false });
    expect(b.extRows[0]).toMatchObject({ tool: "geoguess", time_limit_s: 600 });
    expect(b.rows[3].explanation).toBe("attendu : …");
  });
  it("erreurs lisibles", () => {
    expect((build("t", [{ type: "mcq_single", prompt: "x", options: [{ text: "a" }, { text: "b" }], correct: ["z"] }], 0) as any).error).toMatch(/bonne réponse/);
    expect((build("t", [{ type: "zzz", prompt: "x" }], 0) as any).error).toMatch(/invalide/);
  });
});
