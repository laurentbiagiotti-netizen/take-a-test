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

import { readExamCsv } from "@/lib/admin/exam-file";
describe("import CSV tolérant", () => {
  it("modèle Excel : Question, Type, Réponse A…, Bonne(s) réponse(s), Thème, séparateur ;", () => {
    const csv = "﻿Question;Type;Réponse A;Réponse B;Réponse C;Bonne(s) réponse(s);Thème;Points;Colonne perso\n" +
      "Port SSH ?;QCM_unique;22;80;443;A;Réseau;2;x\n" +
      "Chiffrés ?;QCM_multiple;HTTPS;Telnet;SSH;A,C;Réseau;;\n" +
      "Le ciel est bleu;Vrai_Faux;;;;Vrai;;;\n" +
      "Expliquez XSS;Ouverte;;;;;Web;4;\n" +
      "Commande pour lister ?;Reponse_courte;;;;ls | ls -l;Linux;;\n" +
      "Mauvaise;QCM_unique;oui;non;;D;;;\n";
    const x = readExamCsv(csv);
    expect(x.questions.map((q) => q.type)).toEqual(["mcq_single", "mcq_multi", "mcq_single", "long_text", "short_answer"]);
    expect(x.questions[0].correct).toEqual(["a"]);
    expect(x.questions[1].correct).toEqual(["a", "c"]);
    expect(x.questions[0].domain).toBe("Réseau");
    expect(x.questions[4].correct).toEqual({ answers: ["ls", "ls -l"], case_sensitive: false });
    expect(x.skipped).toEqual([{ line: 7, error: expect.stringMatching(/sans proposition/) }]);
    expect(x.ignoredColumns).toEqual(["Colonne perso"]);
  });
  it("en-têtes avec accents et majuscules, virgule", () => {
    const x = readExamCsv('Énoncé,TYPE,Domaine,Explication\n"Qu\'est-ce qu\'un pare-feu ?",question ouverte,Réseau,ok\n');
    expect(x.questions[0]).toMatchObject({ type: "long_text", domain: "Réseau", explanation: "ok" });
  });
});

import { normLevel, fileToBank, bankToDraft } from "@/lib/admin/bank";
import { cleanName } from "@/lib/exam/names";
describe("banque et noms", () => {
  it("niveaux", () => {
    expect(normLevel("Bachelor 3 Cybersécurité")).toBe("B3");
    expect(normLevel("Mastère 1 IA et Data")).toBe("M1");
    expect(normLevel("b1")).toBe("B1");
    expect(normLevel("Mastère DPO")).toBe("Tous");
  });
  it("CSV avec colonne Niveau vers la banque, puis vers l'éditeur", () => {
    const x = readExamCsv("Niveau;Thème;Question;Réponse A;Réponse B;Bonne réponse\nBachelor 1;Réseau;Port SSH ?;22;80;A\n");
    const row = fileToBank(x.questions[0], "Tous", "f.csv");
    expect(row).toMatchObject({ level: "B1", domain: "Réseau", type: "mcq_single", correct: ["a"] });
    expect(bankToDraft(row)).toMatchObject({ prompt: "Port SSH ?", domain: "Réseau", correct: ["a"] });
  });
  it("prénom et nom", () => {
    expect(cleanName("  Inès  ")).toBe("Inès");
    expect(cleanName("Jean-Pierre O’Neil")).toBe("Jean-Pierre O'Neil");
    expect(cleanName("x@y.fr")).toBeNull();
    expect(cleanName("")).toBeNull();
  });
});
