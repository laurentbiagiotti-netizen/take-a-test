import { rng } from "./seed";

/**
 * Type de question « netpuzzle » : le jeu « Net » de la collection de puzzles de
 * Simon Tatham (MIT), réécrit ici en TypeScript. Une grille de tuiles forme un
 * réseau en arbre relié au serveur central ; les tuiles sont tournées au hasard,
 * le candidat les remet dans le bon sens pour que tout soit relié, sans bout libre.
 * Tuile = masque de connexions : haut 1, droite 2, bas 4, gauche 8.
 */
export type NetOptions = { w?: number; h?: number };
export type NetGrid = { w: number; h: number; tiles: number[]; scramble: number[]; center: number };

const DIRS = [{ bit: 1, dx: 0, dy: -1, opp: 4 }, { bit: 2, dx: 1, dy: 0, opp: 8 }, { bit: 4, dx: 0, dy: 1, opp: 1 }, { bit: 8, dx: -1, dy: 0, opp: 2 }];

/** Rotation d'un quart de tour dans le sens des aiguilles d'une montre, k fois. */
export function rotate(mask: number, k: number): number {
  let m = mask & 15;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

export function makeGrid(seed: string, o: NetOptions = {}): NetGrid {
  const w = Math.min(9, Math.max(3, o.w || 5)), h = Math.min(9, Math.max(3, o.h || 5));
  const r = rng(seed);
  const n = w * h, center = Math.floor(h / 2) * w + Math.floor(w / 2);
  const tiles = new Array(n).fill(0);
  const seen = new Set([center]);
  const frontier: [number, number][] = [];
  const push = (i: number) => DIRS.forEach((_, d) => frontier.push([i, d]));
  push(center);
  // Arbre couvrant aléatoire (Prim), avec au plus 3 branches par tuile pour garder des formes lisibles
  while (seen.size < n && frontier.length) {
    const k = Math.floor(r() * frontier.length);
    const [i, d] = frontier.splice(k, 1)[0];
    const x = i % w, y = Math.floor(i / w), D = DIRS[d];
    const nx = x + D.dx, ny = y + D.dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const j = ny * w + nx;
    if (seen.has(j)) continue;
    if ([1, 2, 4, 8].filter((b) => tiles[i] & b).length >= 3) continue;
    tiles[i] |= D.bit; tiles[j] |= D.opp; seen.add(j); push(j);
  }
  // Chaque tuile (sauf la croix) part tournée de 1 à 3 quarts de tour
  const scramble = tiles.map((t) => (t === 15 ? 0 : 1 + Math.floor(r() * 3)));
  return { w, h, tiles, scramble, center };
}

/** Tuiles telles que le candidat les voit : rotation de départ plus ses rotations. */
export const shown = (g: NetGrid, rot: number[]) => g.tiles.map((t, i) => rotate(t, g.scramble[i] + (rot[i] || 0)));

/** Tuiles reliées au centre (par des connexions qui se correspondent des deux côtés). */
export function connected(g: NetGrid, cur: number[]): Set<number> {
  const ok = new Set([g.center]);
  const stack = [g.center];
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % g.w, y = Math.floor(i / g.w);
    for (const D of DIRS) {
      if (!(cur[i] & D.bit)) continue;
      const nx = x + D.dx, ny = y + D.dy;
      if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
      const j = ny * g.w + nx;
      if (cur[j] & D.opp && !ok.has(j)) { ok.add(j); stack.push(j); }
    }
  }
  return ok;
}

/** Résolu : toutes les tuiles reliées et aucune connexion dans le vide. */
export function solved(g: NetGrid, cur: number[]): boolean {
  if (connected(g, cur).size !== g.tiles.length) return false;
  return cur.every((m, i) => DIRS.every((D) => {
    if (!(m & D.bit)) return true;
    const x = i % g.w + D.dx, y = Math.floor(i / g.w) + D.dy;
    return x >= 0 && y >= 0 && x < g.w && y < g.h && !!(cur[y * g.w + x] & D.opp);
  }));
}

/** Barème : résolu = tous les points ; sinon la moitié au prorata des tuiles reliées au centre. */
export function gradeNet(o: NetOptions, seed: string, resp: any, points: number): number {
  const g = makeGrid(seed, o);
  const rot: number[] = Array.isArray(resp?.rot) && resp.rot.length === g.tiles.length ? resp.rot.map((x: any) => Number(x) || 0) : [];
  if (!rot.length) return 0;
  const cur = shown(g, rot);
  if (solved(g, cur)) return points;
  return Math.round(points * 0.5 * ((connected(g, cur).size - 1) / (g.tiles.length - 1)) * 100) / 100;
}
