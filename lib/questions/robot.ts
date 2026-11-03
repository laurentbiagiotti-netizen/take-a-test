/**
 * Type de question « robot » : programmer un robot qui doit allumer toutes les
 * lampes, avec avancer, tourner, allumer et une procédure P1 réutilisable.
 * Idée reprise des clones open source de Lightbot (haan/Lightbot, MIT), sans
 * leur code ni leur nom. Le serveur exécute le programme pour noter.
 * Plan : # vide (le robot ne peut pas y aller), . sol, L lampe ; départ et direction à part.
 */
export type RobotCmd = "F" | "L" | "R" | "A" | "P";
export type RobotLevel = { map: string; start: [number, number]; dir: 0 | 1 | 2 | 3; main: number; p1: number; par?: number };
export type RobotOptions = { levels: RobotLevel[]; help?: boolean };
export type RobotProgram = { main: RobotCmd[]; p1: RobotCmd[] };

export const CMD_LABEL: Record<RobotCmd, string> = { F: "Avancer", L: "Tourner à gauche", R: "Tourner à droite", A: "Allumer", P: "Appeler P1" };
const D: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // haut, droite, bas, gauche

export function parseMap(map: string) {
  const rows = map.replace(/\r/g, "").split("\n").filter((r) => r.length);
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const cell = (x: number, y: number) => (y >= 0 && y < h && x >= 0 && x < w ? rows[y][x] || "#" : "#");
  const lamps: string[] = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === "L") lamps.push(`${x},${y}`); }));
  return { w, h, cell, lamps };
}

export type Trace = { x: number; y: number; dir: number; lit: string[]; cmd?: RobotCmd };

/** Exécute le programme ; renvoie la suite des états (pour l'animation) et le résultat. */
export function run(level: RobotLevel, prog: RobotProgram, maxSteps = 400) {
  const m = parseMap(level.map);
  let x = level.start[0], y = level.start[1], dir: number = level.dir;
  const lit = new Set<string>();
  const trace: Trace[] = [{ x, y, dir, lit: [] }];
  const main = (prog.main || []).slice(0, level.main), p1 = (prog.p1 || []).slice(0, level.p1);
  let steps = 0, overflow = false;
  const exec = (list: RobotCmd[], depth: number) => {
    for (const c of list) {
      if (steps >= maxSteps || depth > 40) { overflow = true; return; }
      if (lit.size === m.lamps.length && m.lamps.length) return;
      steps++;
      if (c === "F") { const nx = x + D[dir][0], ny = y + D[dir][1]; if (m.cell(nx, ny) !== "#") { x = nx; y = ny; } }
      else if (c === "L") dir = (dir + 3) % 4;
      else if (c === "R") dir = (dir + 1) % 4;
      else if (c === "A") { if (m.cell(x, y) === "L") lit.add(`${x},${y}`); }
      else if (c === "P") { exec(p1, depth + 1); continue; }
      trace.push({ x, y, dir, lit: [...lit], cmd: c });
    }
  };
  exec(main, 0);
  return { trace, solved: m.lamps.length > 0 && lit.size === m.lamps.length, lit: lit.size, lamps: m.lamps.length, size: main.length + p1.length, overflow };
}

/** Barème par niveau : toutes les lampes = 100 % ; sinon 0. Le nombre d'instructions est gardé pour le jury. */
export function gradeRobot(o: RobotOptions, resp: any, points: number): number {
  const lv = o.levels || [];
  if (!lv.length) return 0;
  const progs: RobotProgram[] = Array.isArray(resp?.programs) ? resp.programs : [];
  const ok = lv.filter((l, i) => progs[i] && run(l, sanitize(progs[i])).solved).length;
  return Math.round(points * ok / lv.length * 100) / 100;
}

const VALID = new Set(["F", "L", "R", "A", "P"]);
export const sanitize = (p: any): RobotProgram => ({
  main: (Array.isArray(p?.main) ? p.main : []).filter((c: any) => VALID.has(c)).slice(0, 30),
  p1: (Array.isArray(p?.p1) ? p.p1 : []).filter((c: any) => VALID.has(c)).slice(0, 30),
});

export function validRobot(o: any): string | null {
  if (!Array.isArray(o?.levels) || !o.levels.length || o.levels.length > 6) return "1 à 6 niveaux";
  for (const [i, l] of o.levels.entries()) {
    if (typeof l?.map !== "string" || !l.map.includes("L")) return `Niveau ${i + 1} : au moins une lampe (L)`;
    const m = parseMap(l.map);
    if (!Array.isArray(l.start) || m.cell(l.start[0], l.start[1]) === "#") return `Niveau ${i + 1} : départ hors du plan`;
    if (![0, 1, 2, 3].includes(l.dir)) return `Niveau ${i + 1} : direction 0 à 3`;
    if (!Number.isInteger(l.main) || l.main < 1 || l.main > 30 || !Number.isInteger(l.p1) || l.p1 < 0 || l.p1 > 30) return `Niveau ${i + 1} : nombre de cases du programme`;
  }
  return null;
}
