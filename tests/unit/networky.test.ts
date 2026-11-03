import { describe, expect, it } from "vitest";
import { hops, suggestKey, summary } from "@/lib/questions/headers";
import { basicProblem, checkVlsm, gradeSubnet, minPrefix, solveBasic, vlsmProblem } from "@/lib/questions/subnet";
import { connected, gradeNet, makeGrid, rotate, shown, solved } from "@/lib/questions/netpuzzle";
import { grade, validateQuestion } from "@/lib/questions/kinds";
import { PRACTICAL_TEMPLATES as T } from "@/lib/questions/templates";
import { autoScore } from "@/lib/questions/grade-server";

const clone = (x: any) => JSON.parse(JSON.stringify(x));

describe("en-têtes de mail", () => {
  const raw = clone(T.headers).options.raw;
  it("trouve les sauts dans l'ordre et l'IP d'origine", () => {
    const h = hops(raw);
    expect(h.map((x) => x.ip)).toEqual(["203.0.113.45", "198.51.100.77", "192.0.2.25"]);
    expect(h[1].delay_s).toBe(45);
    expect(suggestKey(raw)).toMatchObject({ origin_ip: "203.0.113.45", spf: "fail", dkim: "none", dmarc: "fail", reply_to: "oui", verdict: "phishing" });
    expect(summary(raw).replyTo).toContain("verif-compte-urgent");
  });
  it("modèle valide, note au prorata des champs", () => {
    const t = clone(T.headers);
    expect(validateQuestion("headers", t.options, t.correct)).toBeNull();
    expect(grade("headers", 2, { fields: { origin_ip: " 203.0.113.45 ", spf: "FAIL", reply_to: "oui", verdict: "legitime" } }, t.correct)).toBe(1.5);
  });
});

describe("sous-réseaux", () => {
  it("calcule un /27", () => {
    expect(solveBasic("172.16.45.130", 27)).toEqual({ network: "172.16.45.128", broadcast: "172.16.45.159", first: "172.16.45.129", last: "172.16.45.158", hosts: "30", mask: "255.255.255.224" });
  });
  it("même tirage pour la même tentative, différent pour une autre", () => {
    const o = { mode: "basic" as const };
    expect(basicProblem("a:q", o)).toEqual(basicProblem("a:q", o));
    const many = new Set(Array.from({ length: 20 }, (_, i) => basicProblem(`att${i}:q`, o).ip));
    expect(many.size).toBeGreaterThan(15);
  });
  it("note la bonne réponse et le VLSM valide", async () => {
    const o = clone(T.subnet).options;
    const pb = basicProblem("x:y", o), sol = solveBasic(pb.ip, pb.prefix);
    expect(await autoScore("subnet", o, null, { fields: { network: sol.network, broadcast: sol.broadcast, hosts: sol.hosts } }, 2, "x:y")).toBe(2);
    const v = { mode: "vlsm" as const, services: 3 };
    const p = vlsmProblem("s:q", v);
    const base = p.block.split("/")[0].split(".").slice(0, 3).join(".");
    let cur = 0; const ans: Record<string, string> = {};
    for (const s of [...p.services].sort((a, b) => b.hosts - a.hosts)) { const pr = minPrefix(s.hosts); ans[s.id] = `${base}.${cur}/${pr}`; cur += 2 ** (32 - pr); }
    expect(Object.values(checkVlsm(p.block, p.services, ans)).every(Boolean)).toBe(true);
    expect(gradeSubnet(v, "s:q", { subnets: ans }, 3)).toBe(3);
    const bad = { ...ans, [p.services[1].id]: ans[p.services[0].id] };
    expect(gradeSubnet(v, "s:q", { subnets: bad }, 3)).toBeLessThan(3);
  });
});

describe("puzzle réseau", () => {
  it("la grille d'origine est résolue, la grille mélangée ne l'est pas", () => {
    const g = makeGrid("a:b", { w: 5, h: 5 });
    expect(solved(g, g.tiles)).toBe(true);
    expect(solved(g, shown(g, []))).toBe(false);
    const undo = g.scramble.map((s) => (4 - s) % 4);
    expect(solved(g, shown(g, undo))).toBe(true);
    expect(gradeNet({ w: 5, h: 5 }, "a:b", { rot: undo }, 2)).toBe(2);
    expect(gradeNet({ w: 5, h: 5 }, "a:b", { rot: new Array(25).fill(0) }, 2)).toBeLessThan(1);
    expect(connected(g, g.tiles).size).toBe(25);
    expect(rotate(1, 1)).toBe(2);
    expect(rotate(8, 1)).toBe(1);
  });
});
