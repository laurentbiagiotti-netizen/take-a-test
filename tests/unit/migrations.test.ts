import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXPECTED_MIGRATIONS } from "@/lib/migrations";

describe("migrations", () => {
  const ordre = readFileSync("supabase/migrations/ORDRE", "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  it("la liste attendue par le code est celle du fichier ORDRE", () => { expect(EXPECTED_MIGRATIONS).toEqual(ordre); });
  it("toute migration récente figure dans ORDRE, et tout fichier listé existe", () => {
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql") && f >= "2026-11-17");
    expect([...files].sort()).toEqual([...ordre].sort());
  });
});
