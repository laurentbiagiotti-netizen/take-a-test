import { describe, expect, it } from "vitest";
import { gradeSokoban, parseLevel, replay, step, isSolved } from "@/lib/questions/sokoban";
import { gradeRobot, run } from "@/lib/questions/robot";
import { checkOne, gradeAd } from "@/lib/questions/adsim";
import { gradeTickets, priority } from "@/lib/questions/tickets";
import { validateQuestion } from "@/lib/questions/kinds";
import { EXTRA_TEMPLATES as X, PACKS, SOKOBAN_LEVELS, ROBOT_LEVELS } from "@/lib/questions/templates";

const clone = (x: any) => JSON.parse(JSON.stringify(x));
function solve(map: string) {
  const s0 = parseLevel(map);
  const key = (s: any) => s.player + "|" + [...s.boxes].sort((a: number, b: number) => a - b).join(",");
  const seen = new Set([key(s0)]); let q: [any, string][] = [[s0, ""]];
  while (q.length) { const nq: [any, string][] = []; for (const [s, p] of q) for (const m of "udlr") { const n = step(s, m); if (n === s) continue; const k = key(n); if (seen.has(k)) continue; seen.add(k); if (isSolved(n)) return p + m; nq.push([n, p + m]); } q = nq; }
  return null;
}

describe("caisses à pousser", () => {
  it("chaque niveau a une solution dans l'objectif de coups", () => {
    for (const l of SOKOBAN_LEVELS) { const sol = solve(l.map); expect(sol).not.toBeNull(); expect(sol!.length).toBeLessThanOrEqual(l.par); }
  });
  it("le serveur rejoue les coups : réussi, hors objectif, raté", () => {
    const o = clone(X.sokoban.options);
    const sols = o.levels.map((l: any) => solve(l.map));
    expect(gradeSokoban(o, { moves: sols }, 3)).toBe(3);
    expect(gradeSokoban(o, { moves: [sols[0], "", ""] }, 3)).toBe(1);
    const long = "lr".repeat(10) + sols[0];
    expect(replay(o.levels[0].map, long).solved).toBe(true);
    expect(gradeSokoban(o, { moves: [long, "", ""] }, 3)).toBe(0.7);
  });
});

describe("robot", () => {
  it("les solutions attendues allument toutes les lampes", () => {
    const [a, b, c] = ROBOT_LEVELS;
    expect(run(a, { main: ["F", "F", "A", "F", "F", "A"], p1: [] }).solved).toBe(true);
    expect(run(b, { main: ["A", "P", "P", "P"], p1: ["F", "F", "F", "A", "R"] }).solved).toBe(true);
    expect(run(c, { main: ["A", "P", "P", "P"], p1: ["F", "R", "F", "L", "A"] }).solved).toBe(true);
    expect(run(b, { main: ["A", "F", "F", "F", "A"], p1: [] }).solved).toBe(false);
    expect(gradeRobot(clone(X.robot.options), { programs: [{ main: ["F", "F", "A", "F", "F", "A"], p1: [] }] }, 3)).toBe(1);
  });
  it("une routine qui s'appelle elle-même s'arrête", () => {
    const r = run(ROBOT_LEVELS[1], { main: ["P"], p1: ["F", "P"] });
    expect(r.overflow).toBe(true);
  });
});

describe("console AD", () => {
  it("note l'état final de l'annuaire", () => {
    const t = clone(X.adsim);
    const s = t.options.initial;
    expect(gradeAd(t.correct, { state: s }, 4)).toBeLessThan(2);
    s.users.push({ sam: "j.martin", name: "Julie Martin", ou: "ou-compta", enabled: true, groups: ["GG_Compta", "GG_VPN"], mustChange: true });
    const k = s.users.find((u: any) => u.sam === "k.martin"); k.enabled = false; k.ou = "ou-anciens";
    const st = s.users.find((u: any) => u.sam === "t.stagiaire"); st.groups = ["GG_Pedagogie"];
    s.gpos.find((g: any) => g.name.startsWith("Lecteur")).links = ["ou-compta"];
    expect(gradeAd(t.correct, { state: s }, 4)).toBe(4);
    expect(checkOne(s, { kind: "exists", sam: "J.MARTIN" })).toBe(true);
  });
});

describe("tickets", () => {
  it("matrice et barème", () => {
    expect(priority("haute", "haute")).toBe(1);
    expect(priority("basse", "basse")).toBe(5);
    const t = clone(X.tickets);
    expect(gradeTickets(t.options, t.correct, { tickets: t.correct }, 3)).toBe(3);
    expect(gradeTickets(t.options, t.correct, { tickets: {} }, 3)).toBe(0);
  });
});

describe("packs complétés", () => {
  it("tous les exercices des packs sont valides", () => {
    for (const k of ["b1", "b3"] as const) for (const q of PACKS[k].questions) {
      if (q.type === "terminal") continue;
      expect([q.type, validateQuestion(q.type as any, q.options, q.correct)]).toEqual([q.type, null]);
    }
  });
});

import { evaluateObjectives, initState, runShell, validateScenario } from "@/lib/terminal/shell";
import { B1_TERMINAL } from "@/lib/questions/templates";
describe("mission Linux B1", () => {
  it("scénario valide et faisable sans connaissance", () => {
    const scn: any = clone(B1_TERMINAL);
    expect(validateScenario(scn)).toBeNull();
    let st = initState(scn);
    const sh = (l: string) => { const r = runShell(scn, st, l); st = r.state; return r.output; };
    expect(sh("cat LISEZMOI.txt")).toContain("coffre");
    sh("cd coffre"); sh("cd etagere");
    expect(sh("ls")).not.toContain("boite_noire");
    expect(sh("ls -a")).toContain(".boite_noire");
    sh("cd .boite_noire");
    expect(sh("cat code.txt")).toContain("CYBER{l1nux_s4ns_p3ur}");
    sh("cd"); sh("mkdir rapport");
    expect(evaluateObjectives(scn, st).every((o) => o.done)).toBe(true);
  });
});

import { gradeFeed } from "@/lib/questions/feed";
import { FEED_TEMPLATE, CULTURE_B1 } from "@/lib/questions/templates";
describe("vrai ou fake", () => {
  it("barème avec demi-point entre douteux et faux", () => {
    const t = clone(FEED_TEMPLATE);
    expect(validateQuestion("feed" as any, t.options, t.correct)).toBeNull();
    expect(gradeFeed(t.options, t.correct, { verdicts: t.correct }, 3)).toBe(3);
    const v = { ...t.correct, f1: "douteux", f2: "faux" };
    expect(gradeFeed(t.options, t.correct, { verdicts: v }, 7)).toBe(5.5);
    expect(CULTURE_B1).toHaveLength(12);
  });
});

import { gradeEvtx } from "@/lib/questions/evtx";
import { EVTX_TEMPLATE } from "@/lib/questions/templates";
describe("journaux Windows (Mastère)", () => {
  it("les réponses attendues se trouvent bien dans les journaux", () => {
    const t = clone(EVTX_TEMPLATE);
    expect(validateQuestion("evtx" as any, t.options, t.correct)).toBeNull();
    const logs = t.options.logs as any[];
    expect(logs.some((e) => e.eventId === 4740 && e.time === "2026-10-27 07:58:12" && e.message.includes("PC-COMPTA-07"))).toBe(true);
    expect(logs.some((e) => e.eventId === 4624 && e.message.includes("Type d'ouverture de session : 10") && e.message.includes("admin.local") && e.message.includes("203.0.113.47"))).toBe(true);
    expect(logs.some((e) => e.eventId === 7045 && e.log === "Système" && e.message.includes("UpdaterSvc"))).toBe(true);
    const ans = { lock_time: "7:58:12", lock_pc: "pc-compta-07", rdp_user: "admin.local", rdp_ip: "203.0.113.47", new_user: "svc_backup2", service: "updatersvc" };
    expect(gradeEvtx(t.options, t.correct, { answers: ans }, 6)).toBe(6);
    expect(gradeEvtx(t.options, t.correct, { answers: { ...ans, rdp_ip: "10.20.4.37" } }, 6)).toBe(5);
    expect(PACKS.m1.questions.every((q) => validateQuestion(q.type as any, q.options, q.correct) === null)).toBe(true);
  });
});
