/**
 * Type de question « feed » : un fil façon réseau social, chaque publication est à
 * classer « fiable », « douteuse » ou « fausse » d'après des indices observables
 * (source, adresse du site, date, ton, compte récent). Idée inspirée du projet
 * académique The Misinformation Game (CC BY 4.0) ; contenu et code écrits ici.
 */
export type Verdict = "fiable" | "douteux" | "faux";
export type Post = { id: string; author: string; handle: string; badge?: "officiel" | "media" | "nouveau" | null; age?: string; date: string; text: string; link?: { title: string; url: string } | null; stats?: string };
export type FeedOptions = { posts: Post[]; help?: boolean; ask_reason?: boolean };

export const VERDICTS: [Verdict, string][] = [["fiable", "Fiable"], ["douteux", "Douteux, à vérifier"], ["faux", "Faux"]];

/** Barème : bonne case = 1 ; « douteux » au lieu de « faux » (ou l'inverse) = 0,5 ; confondre fiable et faux = 0. */
export function gradeFeed(o: FeedOptions, key: Record<string, Verdict> | null, resp: any, points: number): number {
  const ids = (o.posts || []).map((p) => p.id).filter((id) => key?.[id]);
  if (!ids.length) return 0;
  const a = resp?.verdicts && typeof resp.verdicts === "object" ? resp.verdicts : {};
  let s = 0;
  for (const id of ids) {
    const r = a[id], k = key![id];
    if (r === k) s += 1;
    else if ((r === "douteux" && k === "faux") || (r === "faux" && k === "douteux")) s += 0.5;
  }
  return Math.round(points * s / ids.length * 100) / 100;
}

export function validFeed(o: any, key: any): string | null {
  if (!Array.isArray(o?.posts) || o.posts.length < 2 || o.posts.length > 15) return "2 à 15 publications";
  for (const p of o.posts) {
    if (typeof p?.id !== "string" || typeof p?.text !== "string" || !p.text) return "Publication sans texte";
    if (!["fiable", "douteux", "faux"].includes(key?.[p.id])) return `Verdict attendu manquant pour « ${p.author || p.id} »`;
  }
  return null;
}
