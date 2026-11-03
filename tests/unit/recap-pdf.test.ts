import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { recapFilename, renderRecap, type RecapData } from "@/lib/pdf/recap";

export const SAMPLE: RecapData = {
  candidate: "Élodie Durand", email: "elodie.durand@exemple.fr", ref: "HS-48213", test: "Test d'admission Bachelor 3 Cybersécurité",
  formation: "Bachelor 3 Cybersécurité", attemptId: "3f2a9c1e-0000-4000-8000-000000000000",
  started: "03/11/2026 14:02", ended: "03/11/2026 15:11", duration: "69 min 12 s", endReason: "Copie rendue par le candidat", extraMinutes: 15,
  score20: 13.13, points: 42, max: 64, verdict: "pass", verdictLabel: "Test réussi",
  thresholds: "Test réussi à partir de 10/20, échoué sous 8/20, « À statuer » entre les deux",
  override: null, needsManual: false, belowFloors: ["Scripting et programmation"],
  domains: [
    { name: "Réseaux", score: 8, max: 10, ratio: 0.8, floor: 0.3, below: false },
    { name: "Scripting et programmation", score: 2, max: 10, ratio: 0.2, floor: 0.3, below: true },
    { name: "Détection du phishing", score: 5.33, max: 6, ratio: 0.89, floor: null, below: false },
  ],
  surveillance: [{ label: "changements de fenêtre", count: 2, serious: true }, { label: "aucun visage", count: 1, serious: false }],
  violations: 2, suspicion: null, receipt: "A1B2C3D4E5F6", ip: "203.0.113.7",
  questions: [
    { n: 1, prompt: "Combien d'adresses d'hôtes utilisables contient le réseau 192.168.10.0/26 ?", meta: "QCM une réponse · Réseaux", points: 1, max: 1, status: "full",
      options: [{ text: "64", correct: false, chosen: false }, { text: "62", correct: true, chosen: true }, { text: "30", correct: false, chosen: false }, { text: "126", correct: false, chosen: false }],
      explanation: "Un /26 laisse 6 bits d'hôte : 64 adresses moins réseau et broadcast." },
    { n: 2, prompt: "Cochez les protocoles qui utilisent principalement UDP :", meta: "QCM plusieurs réponses · Réseaux", points: 0, max: 1, status: "zero",
      options: [{ text: "SMTP", correct: false, chosen: true }, { text: "SSH", correct: false, chosen: false }, { text: "DHCP", correct: true, chosen: false }, { text: "DNS (requêtes)", correct: true, chosen: true }] },
    { n: 3, prompt: "Quelle commande affiche le dossier courant ?", meta: "Réponse courte · Systèmes", points: 1, max: 1, status: "full", answer: "pwd", expected: "pwd" },
    { n: 4, prompt: "Détection du phishing (boîte mail)", meta: "Exercice dans un outil · Détection du phishing", points: 1.67, max: 2, status: "partial",
      extra: ["Cybersup OS · terminé · 5 / 6 dans l'outil", "m1 (mail) : frauduleux, juste", "m2 (mail) : frauduleux, faux"] },
    { n: 5, prompt: "Question jamais vue", meta: "QCM une réponse · Logique", points: 0, max: 1, status: "none", options: [{ text: "A", correct: true, chosen: false }, { text: "B", correct: false, chosen: false }] },
  ],
  timeline: Array.from({ length: 40 }, (_, i) => ({ time: `14:${String(2 + i).padStart(2, "0")}:10`, label: i % 7 === 3 ? "changement de fenêtre" : "réponse enregistrée", serious: i % 7 === 3, detail: i % 7 === 3 ? "mod+tab" : "" })),
};

describe("fiche de correction PDF", () => {
  it("produit un PDF de plusieurs pages, avec nom de fichier propre", async () => {
    const pdf = await renderRecap(SAMPLE);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20000);
    if (process.env.RECAP_OUT) writeFileSync(process.env.RECAP_OUT, pdf);
    expect(recapFilename("Élodie Durand", "Test B3 : Cybersécurité")).toBe("fiche-test-b3-cybersecurite-elodie-durand.pdf");
  });
  it("accepte une décision forcée et une copie à corriger", async () => {
    const pdf = await renderRecap({ ...SAMPLE, verdict: "review", verdictLabel: "À statuer", needsManual: true,
      override: { label: "À statuer", reason: "Panne réseau pendant l'enquête", by: "Laurent", auto: "Test réussi" } });
    expect(pdf.length).toBeGreaterThan(20000);
  });
});
