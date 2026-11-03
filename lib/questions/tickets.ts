/**
 * Type de question « tickets » : file de tickets de support à qualifier, façon GLPI
 * (l'outil connu des BTS SIO). Pour chaque ticket : impact, urgence et groupe
 * d'attribution ; la priorité se déduit de la matrice impact × urgence (ITIL).
 */
export type Level3 = "haute" | "moyenne" | "basse";
export type Ticket = { id: string; title: string; from: string; text: string };
export type TicketsOptions = { tickets: Ticket[]; groups: string[]; help?: boolean };
export type TicketAnswer = { impact?: Level3; urgence?: Level3; groupe?: string };

export const LEVELS: [Level3, string][] = [["haute", "Haute"], ["moyenne", "Moyenne"], ["basse", "Basse"]];

/** Matrice de priorité (comme dans GLPI) : 1 = très haute, 5 = très basse. */
export function priority(impact?: Level3, urgence?: Level3): number | null {
  if (!impact || !urgence) return null;
  const v = { haute: 3, moyenne: 2, basse: 1 } as const;
  const s = v[impact] + v[urgence];
  return s >= 6 ? 1 : s === 5 ? 2 : s === 4 ? 3 : s === 3 ? 4 : 5;
}
export const PRIORITY_LABEL: Record<number, string> = { 1: "Très haute", 2: "Haute", 3: "Moyenne", 4: "Basse", 5: "Très basse" };

/** Note : chaque ticket vaut 3 critères (impact, urgence, groupe) ; une priorité juste malgré un critère
 * mal placé rattrape la moitié de ce critère (le raisonnement d'ensemble est bon). */
export function gradeTickets(o: TicketsOptions, key: Record<string, TicketAnswer> | null, resp: any, points: number): number {
  const ids = (o.tickets || []).map((t) => t.id).filter((id) => key?.[id]);
  if (!ids.length) return 0;
  const a: Record<string, TicketAnswer> = resp?.tickets && typeof resp.tickets === "object" ? resp.tickets : {};
  let got = 0;
  for (const id of ids) {
    const k = key![id], r = a[id] || {};
    const crit = [r.impact === k.impact, r.urgence === k.urgence, r.groupe === k.groupe];
    let s = crit.filter(Boolean).length;
    if (!(crit[0] && crit[1]) && priority(r.impact, r.urgence) === priority(k.impact, k.urgence)) s += 0.5;
    got += Math.min(3, s) / 3;
  }
  return Math.round(points * got / ids.length * 100) / 100;
}

export function validTickets(o: any, key: any): string | null {
  if (!Array.isArray(o?.tickets) || o.tickets.length < 1 || o.tickets.length > 15) return "1 à 15 tickets";
  if (!Array.isArray(o.groups) || o.groups.length < 2) return "Au moins 2 groupes d'attribution";
  for (const t of o.tickets) {
    const k = key?.[t.id];
    if (!k || !["haute", "moyenne", "basse"].includes(k.impact) || !["haute", "moyenne", "basse"].includes(k.urgence) || !o.groups.includes(k.groupe))
      return `Ticket « ${t.title || t.id} » : corrigé incomplet`;
  }
  return null;
}
