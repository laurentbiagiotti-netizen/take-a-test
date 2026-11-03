import WIN95 from "./win95-demo.json";

/**
 * Exercices dans les outils pour l'épreuve d'essai : Crime GeoGuess (une
 * enquête facile) et Cybersup OS (quatre éléments à trier). Les sessions
 * d'essai ne touchent jamais la base : elles vivent en mémoire une heure,
 * reconnaissables à leur nonce « demo. ».
 */
export const DEMO_WIN95 = WIN95 as { scenario: { intro?: string; items: { id: string; kind: string; data: unknown }[] }; answer_key: Record<string, "fraud" | "legit"> };
export const DEMO_TIME_S: Record<string, number> = { crime: 6 * 60, win95: 4 * 60 };
export const isDemoNonce = (n: unknown) => typeof n === "string" && n.startsWith("demo.");

type DemoSession = { tool: string; nonce: string; ratio: number; completed: boolean; exp: number };
const g = globalThis as unknown as { __cxDemoSessions?: Map<string, DemoSession> };
const store = (g.__cxDemoSessions ??= new Map());

export function demoOpen(sid: string, tool: string, nonce: string, ttlS: number) {
  const now = Date.now();
  if (store.size > 5000) for (const [k, v] of store) if (v.exp < now) store.delete(k);
  store.set(sid, { tool, nonce, ratio: 0, completed: false, exp: now + Math.max(ttlS, 3600) * 1000 });
}

export function demoGet(sid: unknown, nonce?: string): DemoSession | null {
  if (typeof sid !== "string") return null;
  const s = store.get(sid);
  if (!s || s.exp < Date.now() || (nonce !== undefined && s.nonce !== nonce)) return null;
  return s;
}

export function demoRecord(sid: string, nonce: string, ratio: number, completed: boolean): boolean {
  const s = demoGet(sid, nonce);
  if (!s) return false;
  s.ratio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  s.completed = s.completed || completed;
  return true;
}
