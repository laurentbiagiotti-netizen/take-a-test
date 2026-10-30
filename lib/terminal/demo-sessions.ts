import type { ShellState } from "./shell";

/**
 * États des machines de la démo publique, en mémoire (pas de base, pas de
 * compte). Limité en nombre et en durée ; perdu au redémarrage, sans gravité.
 */
const TTL = 2 * 60 * 60 * 1000;
const MAX = 1000;
const store = new Map<string, { state: ShellState; at: number }>();

export function getDemoState(id: string): ShellState | null {
  const e = store.get(id);
  if (!e || Date.now() - e.at > TTL) { store.delete(id); return null; }
  return e.state;
}

const MAX_STATE_BYTES = 1_500_000;

/** Renvoie false si l'état dépasse la taille autorisée (il n'est pas gardé). */
export function setDemoState(id: string, state: ShellState): boolean {
  if (JSON.stringify(state).length > MAX_STATE_BYTES) return false;
  if (store.size >= MAX) {
    const now = Date.now();
    for (const [k, v] of store) if (now - v.at > TTL) store.delete(k);
    if (store.size >= MAX) store.delete(store.keys().next().value!);
  }
  store.set(id, { state, at: Date.now() });
  return true;
}

export function resetDemoState(id: string) { store.delete(id); }
