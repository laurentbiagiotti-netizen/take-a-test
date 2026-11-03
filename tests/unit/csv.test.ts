import { describe, expect, it } from "vitest";
import { COLUMNS, parseBank, toBankRow } from "@/lib/excel/bank";
import { parseCsv, toCsv } from "@/lib/excel/csv";

describe("banque de questions en CSV", () => {
  const qs = [
    { type: "mcq_single", prompt: "Qu'affiche ce code ?\nprint(\"a;b\")", options: [{ id: "a", text: "a;b" }, { id: "b", text: "=SOMME(A1)" }, { id: "c", text: "-1" }], correct: ["a"], points: 1, domain: "Algorithmique", explanation: "Le « ; » est dans la chaîne." },
    { type: "mcq_multi", prompt: "Cochez UDP", options: [{ id: "a", text: "DNS" }, { id: "b", text: "SSH" }, { id: "c", text: "DHCP" }], correct: ["a", "c"], points: 2, domain: "Réseaux", explanation: null },
    { type: "short_answer", prompt: "Commande du dossier courant ?", options: { placeholder: "" }, correct: { answers: ["pwd"], case_sensitive: false }, points: 1, domain: "Systèmes", explanation: null },
  ];

  it("exporte puis réimporte à l'identique (retours à la ligne, « ; », formules neutralisées)", () => {
    const rows = qs.map((q) => toBankRow(q, "Bachelor 1 Cybersécurité")).filter(Boolean) as (string | number)[][];
    const csv = toCsv([[...COLUMNS], ...rows]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("'=SOMME(A1)");
    const back = parseBank(parseCsv(csv), { formation: "Bachelor 1 Cybersécurité" });
    expect(back.map((r) => r.errors)).toEqual([[], [], []]);
    expect(back[0].question?.prompt).toBe(qs[0].prompt);
    expect((back[0].question?.options as any[]).map((o) => o.text)).toEqual(["a;b", "=SOMME(A1)", "-1"]);
    expect(back[1].question?.type).toBe("mcq_multi");
    expect(back[1].question?.points).toBe(2);
    expect(back[2].question?.type).toBe("short_answer");
  });

  it("lit un CSV séparé par des virgules", () => {
    const rows = parseCsv('Question,Type,Réponse A,Réponse B,Bonne(s) réponse(s)\r\n"Vrai ou faux, la RAM est volatile ?",Vrai_Faux,,,A\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("Vrai ou faux, la RAM est volatile ?");
  });
});
