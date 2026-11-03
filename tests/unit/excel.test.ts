import { describe, expect, it } from "vitest";
import { COLUMNS, parseBank, themeKey, toBankRow } from "@/lib/excel/bank";
import { bankWorkbook, readSheet, tableWorkbook } from "@/lib/excel/xlsx";

const H = [...COLUMNS];
const row = (o: Record<string, string | number>) => H.map((h) => String(o[h] ?? ""));

describe("import Excel au format de Dylan", () => {
  it("lit les quatre types et regroupe les thèmes proches", () => {
    const rows = parseBank([H,
      row({ Question: "Combien d'hôtes dans un /26 ?", Type: "QCM_unique", "Réponse A": "64", "Réponse B": "62", "Réponse C": "30", "Réponse D": "126", "Bonne(s) réponse(s)": "B", "Thème": "Réseaux", "Formation visée": "Bachelor 3 Cybersécurité", Points: 1, "Temps (secondes)": 60, Explication: "2^6 - 2" }),
      row({ Question: "Protocoles en UDP ?", Type: "QCM_multiple", "Réponse A": "SMTP", "Réponse B": "SSH", "Réponse C": "DHCP", "Réponse D": "DNS", "Bonne(s) réponse(s)": "C;D", "Thème": "réseau" }),
      row({ Question: "ls liste un dossier.", Type: "Vrai_Faux", "Bonne(s) réponse(s)": "Vrai", "Thème": "RESEAUX" }),
      row({ Question: "Dossier courant ?", Type: "Reponse_courte", "Bonne(s) réponse(s)": "pwd; /bin/pwd", "Thème": "Systèmes", Points: "2,5" }),
    ], { formation: "Bachelor 3 Cybersécurité" });
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);
    const [a, b, c, d] = rows.map((r) => r.question!);
    expect(a).toMatchObject({ type: "mcq_single", correct: ["b"], time_limit_s: 60, explanation: "2^6 - 2", domain: "Réseaux" });
    expect(b).toMatchObject({ type: "mcq_multi", correct: ["c", "d"], domain: "Réseaux" });
    expect(c).toMatchObject({ type: "mcq_single", correct: ["vrai"], trueFalse: true, domain: "Réseaux" });
    expect(d).toMatchObject({ type: "short_answer", correct: { answers: ["pwd", "/bin/pwd"], case_sensitive: false }, points: 2.5 });
    expect(themeKey("Réseaux")).toBe(themeKey("RESEAU"));
  });

  it("signale les erreurs ligne par ligne, sans rien importer de faux", () => {
    const rows = parseBank([H,
      row({ Question: "", Type: "QCM_unique" }),
      row({ Question: "Q ouverte", Type: "Ouverte" }),
      row({ Question: "Q1", Type: "QCM_unique", "Réponse A": "x", "Réponse B": "y", "Bonne(s) réponse(s)": "A;B" }),
      row({ Question: "Q2", Type: "QCM_unique", "Réponse A": "x", "Réponse B": "y", "Bonne(s) réponse(s)": "C" }),
      row({ Question: "Q3", Type: "Vrai_Faux", "Bonne(s) réponse(s)": "Peut-être" }),
      row({ Question: "Q4", Type: "Mystère" }),
      row({ Question: "Q5", Type: "QCM_unique", "Réponse A": "x", "Réponse B": "y", "Bonne(s) réponse(s)": "A", Points: 0, "Temps (secondes)": 2 }),
      row({ Question: "Déjà là", Type: "Reponse_courte", "Bonne(s) réponse(s)": "a" }),
      row({ Question: "Q6", Type: "Reponse_courte", "Bonne(s) réponse(s)": "a" }),
      row({ Question: "q6", Type: "Reponse_courte", "Bonne(s) réponse(s)": "a" }),
      row({ Question: "Q7", Type: "Reponse_courte", "Bonne(s) réponse(s)": "a", "Formation visée": "Licence pro" }),
    ], { existing: ["déjà là"] });
    const errs = rows.map((r) => r.errors.join(" | "));
    expect(errs[0]).toMatch(/vide/);
    expect(errs[1]).toMatch(/ouverte/);
    expect(errs[2]).toMatch(/plusieurs bonnes/);
    expect(errs[3]).toMatch(/C sans proposition/);
    expect(errs[4]).toMatch(/Vrai ou Faux/);
    expect(errs[5]).toMatch(/Type inconnu/);
    expect(errs[6]).toMatch(/Points invalides.*|Temps invalide/);
    expect(errs[7]).toMatch(/déjà présente/);
    expect(errs[8]).toBe("");
    expect(errs[9]).toMatch(/Doublon/);
    expect(errs[10]).toMatch(/Formation inconnue/);
    expect(rows.filter((r) => r.question).length).toBe(1);
  });

  it("garde les questions communes et celles de la formation de l'épreuve", () => {
    const rows = parseBank([H,
      row({ Question: "B3", Type: "Reponse_courte", "Bonne(s) réponse(s)": "a", "Formation visée": "Bachelor 3 Cybersécurité" }),
      row({ Question: "M1", Type: "Reponse_courte", "Bonne(s) réponse(s)": "a", "Formation visée": "Mastère 1 Cybersécurité" }),
      row({ Question: "Commune", Type: "Reponse_courte", "Bonne(s) réponse(s)": "a" }),
    ], { formation: "Bachelor 3 Cybersécurité" });
    expect(rows.map((r) => r.prompt)).toEqual(["B3", "Commune"]);
  });

  it("aller-retour : export de la banque puis réimport à l'identique", async () => {
    const qs = [
      { type: "mcq_multi", prompt: "UDP ?", options: [{ id: "a", text: "SMTP" }, { id: "b", text: "DNS" }, { id: "c", text: "DHCP" }], correct: ["b", "c"], points: 2, domain: "Réseaux", time_limit_s: 45, explanation: "voir cours" },
      { type: "mcq_single", prompt: "Vrai ?", options: [{ id: "vrai", text: "Vrai" }, { id: "faux", text: "Faux" }], correct: ["faux"], points: 1, domain: "Logique" },
      { type: "short_answer", prompt: "Port SSH ?", options: {}, correct: { answers: ["22"], case_sensitive: false }, points: 1, domain: "Réseaux" },
      { type: "terminal", prompt: "Mission", options: null, correct: null, points: 4 },
    ];
    const rows = qs.map((q) => toBankRow(q)).filter(Boolean) as (string | number)[][];
    expect(rows).toHaveLength(3);
    const buf = await bankWorkbook(rows, false);
    const sheet = await readSheet(buf);
    const back = parseBank(sheet);
    expect(back.map((r) => r.errors)).toEqual([[], [], []]);
    expect(back[0].question).toMatchObject({ type: "mcq_multi", correct: ["b", "c"], points: 2, time_limit_s: 45, explanation: "voir cours" });
    expect(back[1].question).toMatchObject({ trueFalse: true, correct: ["faux"] });
    expect(back[2].question).toMatchObject({ correct: { answers: ["22"] } });
  });

  it("le modèle contient les exemples et se réimporte sans erreur", async () => {
    const sheet = await readSheet(await bankWorkbook([], true));
    expect(sheet[0]).toEqual([...COLUMNS]);
    expect(parseBank(sheet).every((r) => r.errors.length === 0)).toBe(true);
  });

  it("neutralise les formules dans les exports", async () => {
    const sheet = await readSheet(await tableWorkbook("R", [{ header: "Nom" }], [["=HYPERLINK(\"x\")"], ["Alice"]]));
    expect(sheet[1][0]).toBe("'=HYPERLINK(\"x\")");
  });
});
