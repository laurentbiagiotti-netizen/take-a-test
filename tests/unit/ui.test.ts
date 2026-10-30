import { describe, expect, it } from "vitest";
import { splitPrompt } from "@/components/questions/QuestionPrompt";
import { faceReady, formatClock, isAnswered } from "@/lib/exam/client";

describe("énoncés sur plusieurs lignes", () => {
  it("une ligne : pas de bloc", () => {
    expect(splitPrompt("Combien de bits dans un octet ?")).toEqual({ intro: "Combien de bits dans un octet ?", block: null, outro: null });
  });
  it("code seul après la consigne", () => {
    const r = splitPrompt("Qu'affiche ce code Python ?\nx = 5\nif x > 3:\n    print(\"A\")");
    expect(r.block).toBe("x = 5\nif x > 3:\n    print(\"A\")");
    expect(r.outro).toBeNull();
  });
  it("la question finale reste en texte", () => {
    const r = splitPrompt("Un routeur possède ces routes :\n10.0.0.0/8 via R1\n0.0.0.0/0 via R4\nPar où part un paquet à destination de 10.1.2.45 ?");
    expect(r.block).toBe("10.0.0.0/8 via R1\n0.0.0.0/0 via R4");
    expect(r.outro).toBe("Par où part un paquet à destination de 10.1.2.45 ?");
  });
  it("une ligne de code finissant par « : » reste dans le bloc", () => {
    const r = splitPrompt("Que fait ce script ?\nfor p in ports:\n    print(p)\nelse:");
    expect(r.outro).toBeNull();
  });
});

describe("petites règles d'affichage", () => {
  it("chrono", () => {
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(59)).toBe("00:59");
    expect(formatClock(-4)).toBe("00:00");
  });
  it("réponse donnée ou non", () => {
    expect(isAnswered({ selected: [] })).toBe(false);
    expect(isAnswered({ selected: ["a"] })).toBe(true);
    expect(isAnswered({ text: "  " })).toBe(false);
  });
  it("départ autorisé avec un seul visage", () => {
    expect(faceReady(true, { faces: 1, brightness: 120, anomaly: null, ready: true })).toBe(true);
    expect(faceReady(true, { faces: 2, brightness: 120, anomaly: null, ready: true })).toBe(false);
    expect(faceReady(false, { faces: 1, brightness: 120, anomaly: null, ready: true })).toBe(false);
  });
});

import { mergeBoxes } from "@/lib/proctor/camera-monitor";
describe("fusion des détections caméra", () => {
  const b = (x: number, y: number, w: number, score = 0.9) => ({ x, y, w, h: w, score });
  it("un même visage vu par les deux détecteurs compte une fois", () => {
    expect(mergeBoxes([b(100, 100, 200), b(110, 105, 190, 0.6)])).toHaveLength(1);
  });
  it("une petite personne au fond est conservée", () => {
    expect(mergeBoxes([b(100, 100, 300), b(900, 80, 40, 0.4)])).toHaveLength(2);
  });
  it("les détections minuscules (bruit) sont ignorées", () => {
    expect(mergeBoxes([b(100, 100, 300), b(900, 80, 8, 0.4)])).toHaveLength(1);
  });
});
