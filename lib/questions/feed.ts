/**
 * Type de question « feed » : un fil façon réseau social, chaque publication est à
 * classer « fiable », « douteuse » ou « fausse » d'après des indices observables
 * (source, adresse du site, date, ton, profil du compte). Mécaniques inspirées du projet
 * académique The Misinformation Game (CC BY 4.0) : profils consultables, réactions
 * (j'aime, partager, signaler) enregistrées pour le jury. Contenu et code écrits ici.
 */
export type Verdict = "fiable" | "douteux" | "faux";
export type Action = "like" | "share" | "report";
export type Profile = { bio?: string; created: string; followers: string; following?: string; posts?: { date: string; text: string }[] };
/** Faux site web ouvert quand on touche le lien d'une publication. */
export type Site = {
  kind: "officiel" | "media" | "ville" | "phishing" | "choc" | "boutique";
  brand: string; color: string; art?: string; title: string; text: string[];
  form?: string[]; cta?: string; date?: string; price?: [string, string];
};
export type Post = {
  id: string; author: string; handle: string; badge?: "officiel" | "media" | "nouveau" | null; age?: string; date: string; text: string;
  link?: { title: string; url: string; site?: Site } | null; image?: string | null; art?: string; stats?: string; profile?: Profile | null;
};
export type FeedOptions = { posts: Post[]; help?: boolean; ask_reason?: boolean };
/** Corrigé : ancien format { id: verdict } ou { verdicts, reasons } (indices attendus par publication). */
export type FeedKey = Record<string, Verdict> | { verdicts: Record<string, Verdict>; reasons?: Record<string, string[]> };

export const VERDICTS: [Verdict, string][] = [["fiable", "Fiable"], ["douteux", "Douteux, à vérifier"], ["faux", "Faux"]];
export const ACTIONS: [Action, string][] = [["like", "J'aime"], ["share", "Partager"], ["report", "Signaler"]];
export const REASONS: [string, string][] = [
  ["source_fiable", "Source officielle ou média reconnu"],
  ["lien_coherent", "Le lien va bien sur le site de l'auteur"],
  ["compte_recent", "Compte créé récemment, peu d'abonnés"],
  ["imitation", "Imite un compte ou un site connu"],
  ["lien_suspect", "Adresse du lien bizarre"],
  ["urgence", "Ton alarmiste, urgence, majuscules"],
  ["donnees", "Demande des données personnelles ou bancaires"],
  ["trop_beau", "Trop beau (ou trop choquant) pour être vrai"],
  ["sans_source", "Aucune source, « il paraît que »"],
  ["deja_vu", "Même contenu déjà publié pour autre chose"],
  ["vend", "Le compte cherche à vendre quelque chose"],
];

export function feedVerdicts(key: any): Record<string, Verdict> {
  return key && typeof key === "object" && key.verdicts && typeof key.verdicts === "object" ? key.verdicts : (key || {});
}

/** Barème des verdicts : bonne case = 1 ; « douteux » au lieu de « faux » (ou l'inverse) = 0,5 ; confondre fiable et faux = 0.
 *  Avec les indices demandés : 70 % verdicts, 30 % indices (bons indices cochés, moins la moitié des indices hors sujet). */
export function gradeFeed(o: FeedOptions, key: FeedKey | null, resp: any, points: number): number {
  const kv = feedVerdicts(key);
  const ids = (o.posts || []).map((p) => p.id).filter((id) => kv[id]);
  if (!ids.length) return 0;
  const a = resp?.verdicts && typeof resp.verdicts === "object" ? resp.verdicts : {};
  let s = 0;
  for (const id of ids) {
    const r = a[id], k = kv[id];
    if (r === k) s += 1;
    else if ((r === "douteux" && k === "faux") || (r === "faux" && k === "douteux")) s += 0.5;
  }
  let ratio = s / ids.length;
  const kr = (key as any)?.reasons as Record<string, string[]> | undefined;
  if (o.ask_reason && kr && Object.keys(kr).length) {
    const given = resp?.reasons && typeof resp.reasons === "object" ? resp.reasons : {};
    const rIds = ids.filter((id) => Array.isArray(kr[id]) && kr[id].length);
    let rs = 0;
    for (const id of rIds) {
      const exp = new Set(kr[id]);
      const t = new Set((Array.isArray(given[id]) ? given[id] : []).filter((x: any) => typeof x === "string"));
      const hit = [...t].filter((x) => exp.has(x)).length, wrong = t.size - hit;
      rs += Math.max(0, Math.min(1, (hit - 0.5 * wrong) / exp.size));
    }
    if (rIds.length) ratio = 0.7 * ratio + 0.3 * (rs / rIds.length);
  }
  return Math.round(points * ratio * 100) / 100;
}

/** Résumé pour le jury : profils consultés, réactions sur les publications fausses. */
export function feedSummary(o: FeedOptions, key: any, resp: any): string {
  const kv = feedVerdicts(key);
  const acts: Record<string, string[]> = resp?.actions || {};
  const shared = Object.entries(acts).filter(([id, a]) => a.includes("share") && kv[id] === "faux").length;
  const reported = Object.entries(acts).filter(([id, a]) => a.includes("report") && kv[id] === "faux").length;
  const all: string[] = Array.isArray(resp?.opened) ? resp.opened.filter((x: any) => typeof x === "string") : [];
  const opened = all.filter((x) => !x.startsWith("lien:")).length, links = all.filter((x) => x.startsWith("lien:")).length;
  const withProfile = (o.posts || []).filter((p) => p.profile).length, withLink = (o.posts || []).filter((p) => p.link).length;
  return `${opened}/${withProfile} profil(s) consulté(s) · ${links}/${withLink} lien(s) ouvert(s) · ${shared} publication(s) fausse(s) partagée(s) · ${reported} signalée(s)`;
}

export function validFeed(o: any, key: any): string | null {
  if (!Array.isArray(o?.posts) || o.posts.length < 2 || o.posts.length > 15) return "2 à 15 publications";
  const kv = feedVerdicts(key);
  for (const p of o.posts) {
    if (typeof p?.id !== "string" || typeof p?.text !== "string" || !p.text) return "Publication sans texte";
    if (!["fiable", "douteux", "faux"].includes(kv?.[p.id])) return `Verdict attendu manquant pour « ${p.author || p.id} »`;
    if (p.profile && (typeof p.profile.created !== "string" || typeof p.profile.followers !== "string")) return `Profil incomplet pour « ${p.author || p.id} » (created et followers)`;
  }
  const known = new Set(REASONS.map(([k]) => k));
  for (const [id, rs] of Object.entries((key as any)?.reasons || {})) {
    if (!Array.isArray(rs) || rs.some((r) => !known.has(r as string))) return `Indices inconnus pour « ${id} »`;
  }
  return null;
}
