import { describe, expect, it } from "vitest";
import { compareValues, sortRows } from "@/components/admin/DataTable";

describe("tri des tableaux de l'équipe", () => {
  const rows = [
    { n: "Émile", s: 12 }, { n: "alice", s: null }, { n: "Bob", s: 3 }, { n: "candidat 10", s: 20 }, { n: "candidat 9", s: 3 },
  ];

  it("trie les nombres et garde l'ordre d'origine en cas d'égalité", () => {
    expect(sortRows(rows, (r) => r.s, "asc").map((r) => r.n)).toEqual(["Bob", "candidat 9", "Émile", "candidat 10", "alice"]);
  });

  it("laisse les valeurs vides en bas, même en ordre décroissant", () => {
    expect(sortRows(rows, (r) => r.s, "desc").map((r) => r.n)).toEqual(["candidat 10", "Émile", "Bob", "candidat 9", "alice"]);
  });

  it("trie le texte à la française : accents, casse et nombres", () => {
    expect(sortRows(rows, (r) => r.n, "asc").map((r) => r.n)).toEqual(["alice", "Bob", "candidat 9", "candidat 10", "Émile"]);
  });

  it("ne modifie pas le tableau d'origine", () => {
    const copy = [...rows];
    sortRows(rows, (r) => r.n, "desc");
    expect(rows).toEqual(copy);
  });

  it("compare des valeurs vides comme égales", () => {
    expect(compareValues(null, "")).toBe(0);
    expect(compareValues(null, 1)).toBeGreaterThan(0);
  });
});
