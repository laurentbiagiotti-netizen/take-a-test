/**
 * Limiteur en mémoire (meilleur effort, par instance) pour les routes
 * publiques sans compte, comme la démo. Les routes sensibles utilisent la
 * base, partagée entre instances.
 */
const buckets = new Map<string, { n: number; reset: number }>();

export function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  b.n++;
  return b.n <= limit;
}
