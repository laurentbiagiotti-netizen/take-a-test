export type CalTest = { id: string; title: string; formation: string | null; campus: string | null; room: string | null; start: number; end: number };
const norm = (s?: string | null) => (s || "").trim().toLowerCase();

/** Début et fin d'une épreuve datée (fermeture, sinon ouverture + durée). */
export function span(t: { opens_at: string; closes_at?: string | null; duration_minutes?: number | null }) {
  const start = +new Date(t.opens_at);
  return { start, end: t.closes_at ? +new Date(t.closes_at) : start + (t.duration_minutes || 60) * 60000 };
}

/** Conflits : deux épreuves qui se chevauchent pour la même promo, ou dans la même salle du même campus. */
export function conflicts<T extends CalTest>(list: T[]) {
  const out = new Map<string, string[]>();
  const add = (a: T, msg: string) => out.set(a.id, [...(out.get(a.id) || []), msg]);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.start >= b.end || b.start >= a.end) continue;
    if (a.formation && norm(a.formation) === norm(b.formation)) { add(a, `Même promo que « ${b.title} »`); add(b, `Même promo que « ${a.title} »`); }
    if (a.room && norm(a.room) === norm(b.room) && norm(a.campus) === norm(b.campus)) { add(a, `Même salle que « ${b.title} »`); add(b, `Même salle que « ${a.title} »`); }
  }
  return out;
}
