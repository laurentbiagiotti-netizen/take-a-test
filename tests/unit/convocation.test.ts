import { describe, expect, it } from "vitest";
import { convocation, importCandidates } from "@/lib/exam/convocation";

describe("import des candidats", () => {
  it("simple liste d'adresses, sans doublon", () => {
    const r = importCandidates("alice@ex.fr, BOB@ex.fr\nalice@ex.fr\npas-une-adresse");
    expect(r.rows.map((x) => x.email)).toEqual(["alice@ex.fr", "bob@ex.fr"]);
  });
  it("export HubSpot (virgules, Record ID, prénom et nom)", () => {
    const csv = 'Record ID,First Name,Last Name,Email,Tiers-temps\n1201,Alice,Martin,Alice@Ex.fr,15\n1202,Bob,"Durand, Jr",bob@ex.fr,\n1203,Sans,Mail,,0';
    const r = importCandidates(csv);
    expect(r.rows).toEqual([
      { email: "alice@ex.fr", full_name: "Alice Martin", extra_minutes: 15, external_ref: "1201" },
      { email: "bob@ex.fr", full_name: "Bob Durand, Jr", extra_minutes: 0, external_ref: "1202" },
    ]);
    expect(r.skipped).toBe(1);
  });
  it("export tableur français (points-virgules)", () => {
    const r = importCandidates("E-mail;Prénom;Nom;Tiers-temps (min)\nc@ex.fr;Chloé;Bernard;20");
    expect(r.rows[0]).toMatchObject({ email: "c@ex.fr", full_name: "Chloé Bernard", extra_minutes: 20 });
  });
  it("tiers-temps borné", () => {
    expect(importCandidates("email;tiers-temps\na@ex.fr;9999").rows[0].extra_minutes).toBe(600);
  });
});

describe("convocation", () => {
  const base = { email: "a@ex.fr", fullName: "Alice Martin", code: "AB12-CD34", testTitle: "Admission B1", durationMinutes: 55, origin: "https://exam.cybersup.ai", testId: "t1" };
  it("contient le lien, le code et la démo", () => {
    const c = convocation(base);
    expect(c.subject).toBe("Convocation : Admission B1");
    expect(c.body).toContain("Bonjour Alice,");
    expect(c.body).toContain("https://exam.cybersup.ai/test/t1");
    expect(c.body).toContain("AB12-CD34");
    expect(c.body).toContain("https://exam.cybersup.ai/demo");
    expect(c.body).not.toMatch(/—|&/);
  });
  it("annonce le tiers-temps", () => {
    expect(convocation({ ...base, extraMinutes: 15 }).body).toContain("Durée : 70 minutes (dont 15 minutes de temps supplémentaire accordé)");
  });
});
