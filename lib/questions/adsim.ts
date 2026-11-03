/**
 * Type de question « adsim » : console simplifiée « Utilisateurs et ordinateurs
 * Active Directory » (aucun simulateur AD open source n'existe pour le navigateur).
 * Arbre d'OU, utilisateurs, groupes et GPO liées aux OU. Le candidat réalise des
 * demandes ; on corrige d'après l'état final de l'annuaire.
 */
export type AdOu = { id: string; name: string; parent: string | null };
export type AdUser = { sam: string; name: string; ou: string; enabled: boolean; groups: string[]; mustChange?: boolean };
export type AdGroup = { name: string; ou: string };
export type AdGpo = { name: string; links: string[] };
export type AdState = { domain: string; ous: AdOu[]; users: AdUser[]; groups: AdGroup[]; gpos: AdGpo[] };
export type AdCheck =
  | { kind: "user_in_ou"; sam: string; ou: string }
  | { kind: "in_group"; sam: string; group: string }
  | { kind: "not_in_group"; sam: string; group: string }
  | { kind: "disabled"; sam: string }
  | { kind: "enabled"; sam: string }
  | { kind: "exists"; sam: string }
  | { kind: "must_change"; sam: string }
  | { kind: "gpo_linked"; gpo: string; ou: string }
  | { kind: "gpo_not_linked"; gpo: string; ou: string };
export type AdOptions = { initial: AdState; tasks: string[]; help?: boolean };

const U = (s: AdState, sam: string) => s.users.find((u) => u.sam.toLowerCase() === sam.toLowerCase());

export function checkOne(s: AdState, c: AdCheck): boolean {
  switch (c.kind) {
    case "exists": return !!U(s, c.sam);
    case "user_in_ou": return U(s, c.sam)?.ou === c.ou;
    case "in_group": return !!U(s, c.sam)?.groups.includes(c.group);
    case "not_in_group": { const u = U(s, c.sam); return !!u && !u.groups.includes(c.group); }
    case "disabled": return U(s, c.sam)?.enabled === false;
    case "enabled": return U(s, c.sam)?.enabled === true;
    case "must_change": return U(s, c.sam)?.mustChange === true;
    case "gpo_linked": return !!s.gpos.find((g) => g.name === c.gpo)?.links.includes(c.ou);
    case "gpo_not_linked": { const g = s.gpos.find((x) => x.name === c.gpo); return !!g && !g.links.includes(c.ou); }
  }
  return false;
}

/** Note : part des vérifications réussies. */
export function gradeAd(key: { checks: AdCheck[] } | null, resp: any, points: number): number {
  const checks = key?.checks || [];
  const s: AdState | null = validState(resp?.state) ? resp.state : null;
  if (!checks.length || !s) return 0;
  return Math.round(points * checks.filter((c) => checkOne(s, c)).length / checks.length * 100) / 100;
}

export function validState(s: any): s is AdState {
  return !!s && Array.isArray(s.ous) && Array.isArray(s.users) && Array.isArray(s.groups) && Array.isArray(s.gpos)
    && s.ous.length <= 60 && s.users.length <= 200 && s.groups.length <= 100 && s.gpos.length <= 40
    && s.users.every((u: any) => typeof u?.sam === "string" && u.sam.length <= 64 && Array.isArray(u.groups) && u.groups.length <= 50);
}

export function validAd(o: any, key: any): string | null {
  if (!validState(o?.initial)) return "Annuaire de départ invalide";
  if (!Array.isArray(o.tasks) || !o.tasks.length) return "Au moins une demande à réaliser";
  if (!Array.isArray(key?.checks) || !key.checks.length) return "Au moins une vérification pour la correction";
  return null;
}

export const ouPath = (s: AdState, id: string): string => {
  const parts: string[] = []; let cur = s.ous.find((o) => o.id === id);
  while (cur) { parts.unshift(cur.name); cur = s.ous.find((o) => o.id === cur!.parent); }
  return parts.join(" › ");
};
