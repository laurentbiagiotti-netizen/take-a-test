/**
 * Type de question « sokoban » : pousser les caisses sur les cibles, inspiré de
 * PuzzleScript (MIT) et du Sokoban classique, réécrit ici pour que le serveur
 * rejoue les coups du candidat (la note ne dépend jamais du navigateur).
 * Notation des niveaux : # mur, espace sol, . cible, $ caisse, * caisse sur cible,
 * @ joueur, + joueur sur cible.
 */
export type SokoLevel = { map: string; par: number };
export type SokoOptions = { levels: SokoLevel[]; help?: boolean };
export type SokoState = { w: number; h: number; walls: Set<number>; goals: Set<number>; boxes: Set<number>; player: number };
export type SokoResp = { moves: string[]; undos?: number; restarts?: number; ms?: number };

export const DIR: Record<string, [number, number]> = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

export function parseLevel(map: string): SokoState {
  const rows = map.replace(/\r/g, "").split("\n").filter((r, i, a) => r.trim() || (i > 0 && i < a.length - 1));
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const s: SokoState = { w, h, walls: new Set(), goals: new Set(), boxes: new Set(), player: -1 };
  rows.forEach((r, y) => [...r.padEnd(w)].forEach((c, x) => {
    const i = y * w + x;
    if (c === "#") s.walls.add(i);
    if (c === "." || c === "*" || c === "+") s.goals.add(i);
    if (c === "$" || c === "*") s.boxes.add(i);
    if (c === "@" || c === "+") s.player = i;
  }));
  return s;
}

/** Un pas ; renvoie le nouvel état (ou le même si le mouvement est impossible). */
export function step(s: SokoState, m: string): SokoState {
  const d = DIR[m]; if (!d) return s;
  const x = s.player % s.w, y = Math.floor(s.player / s.w);
  const nx = x + d[0], ny = y + d[1];
  if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) return s;
  const n = ny * s.w + nx;
  if (s.walls.has(n)) return s;
  if (s.boxes.has(n)) {
    const bx = nx + d[0], by = ny + d[1];
    if (bx < 0 || by < 0 || bx >= s.w || by >= s.h) return s;
    const b = by * s.w + bx;
    if (s.walls.has(b) || s.boxes.has(b)) return s;
    const boxes = new Set(s.boxes); boxes.delete(n); boxes.add(b);
    return { ...s, boxes, player: n };
  }
  return { ...s, player: n };
}

export const isSolved = (s: SokoState) => s.boxes.size > 0 && [...s.boxes].every((b) => s.goals.has(b));

export function replay(map: string, moves: string): { state: SokoState; solved: boolean; count: number } {
  let s = parseLevel(map); let count = 0;
  for (const m of String(moves || "").slice(0, 2000)) {
    if (isSolved(s)) break;
    const n = step(s, m);
    if (n !== s) count++;
    s = n;
  }
  return { state: s, solved: isSolved(s), count };
}

/** Barème par niveau : résolu dans la limite de coups = 100 %, résolu au-delà = 70 %, sinon 0. */
export function gradeSokoban(o: SokoOptions, resp: SokoResp | null, points: number): number {
  const lv = o.levels || [];
  if (!lv.length || !resp) return 0;
  let total = 0;
  lv.forEach((l, i) => {
    const r = replay(l.map, resp.moves?.[i] || "");
    if (r.solved) total += r.count <= l.par ? 1 : 0.7;
  });
  return Math.round(points * total / lv.length * 100) / 100;
}

export function validSokoban(o: any): string | null {
  if (!Array.isArray(o?.levels) || !o.levels.length || o.levels.length > 6) return "1 à 6 niveaux";
  for (const [i, l] of o.levels.entries()) {
    if (typeof l?.map !== "string" || l.map.length > 2000) return `Niveau ${i + 1} : plan manquant`;
    const s = parseLevel(l.map);
    if (s.player < 0) return `Niveau ${i + 1} : placez le joueur (@)`;
    if (!s.boxes.size || s.boxes.size > s.goals.size) return `Niveau ${i + 1} : il faut au moins une caisse et autant de cibles que de caisses`;
    if (!Number.isInteger(l.par) || l.par < 1 || l.par > 500) return `Niveau ${i + 1} : nombre de coups visé entre 1 et 500`;
  }
  return null;
}
