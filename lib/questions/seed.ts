/**
 * Hasard reproductible : chaque candidat reçoit ses propres valeurs (adresse IP,
 * grille de puzzle), tirées à partir de sa tentative et de la question. Le serveur
 * refait le même tirage pour corriger : rien de secret ne transite par le navigateur.
 */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/** Générateur mulberry32 : renvoie un flottant dans [0, 1). */
export function rng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];
export const int = (r: () => number, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
export const seedOf = (attemptId: string, questionId: string) => `${attemptId}:${questionId}`;
