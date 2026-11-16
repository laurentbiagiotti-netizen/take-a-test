import { describe, it, expect } from "vitest";
import { buildExamFile, parseExamJson, examToCsv, parseExamCsv, toDraftQuestion } from "@/lib/admin/exam-file";

const drafts: any[] = [
  { type: "mcq_single", prompt: "=Quel port ?", options: [{ id: "a", text: "22" }, { id: "b", text: "80" }], correct: ["a"], points: 2, domain: "Réseau" },
  { type: "terminal", prompt: "Mission", options: null, correct: null, points: 5, terminal: { scenario: '{"files":{"/a":"x"}}', flag: "CYBER{x}" } },
  { type: "external", prompt: "Geo", options: null, correct: null, points: 3, external: { tool: "geoguess", label: "", time_limit_min: "10", scenario: '{"cas":1}', answer_key: "" } },
];

describe("fichier d'épreuve", () => {
  it("JSON aller-retour, secrets et identifiants exclus", () => {
    const f = buildExamFile({ id: "x", owner_id: "y", title: "B1", duration_minutes: 95, is_published: true }, drafts);
    expect(f.test).toEqual({ title: "B1", duration_minutes: 95 });
    const back = parseExamJson(JSON.stringify(f));
    expect(back.questions).toHaveLength(3);
    const d = back.questions.map(toDraftQuestion);
    expect(JSON.parse(d[1].terminal!.scenario)).toEqual({ files: { "/a": "x" } });
    expect(d[2].external!.time_limit_min).toBe("10");
  });
  it("CSV aller-retour avec formule neutralisée", () => {
    const qs = parseExamCsv(examToCsv(drafts));
    expect(qs[0].prompt).toBe("=Quel port ?");
    expect(qs[0].correct).toEqual(["a"]);
    expect(qs[1].terminal?.flag).toBe("CYBER{x}");
  });
  it("refuse un type inconnu ou un terminal sans files", () => {
    expect(() => parseExamJson(JSON.stringify([{ type: "zzz", prompt: "a" }]))).toThrow(/type inconnu/);
    expect(() => parseExamJson(JSON.stringify([{ type: "terminal", prompt: "a", terminal: { scenario: {} } }]))).toThrow(/files/);
  });
});
