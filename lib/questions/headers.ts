/**
 * Type de question « headers » : analyse des en-têtes d'un mail suspect, à la
 * façon de Microsoft Message Header Analyzer (MIT). Le découpage des en-têtes,
 * des sauts « Received » et des résultats SPF / DKIM / DMARC est réécrit ici ;
 * il sert à l'affichage en tableau et à proposer la correction à l'admin.
 */
export type HeaderField = "origin_ip" | "spf" | "dkim" | "dmarc" | "reply_to" | "verdict";
export type HeadersOptions = { raw: string; view?: "table" | "raw"; ask?: HeaderField[] };
export type Hop = { n: number; from: string; by: string; ip: string | null; date: string | null; delay_s: number | null };

export const HEADER_QUESTIONS: Record<HeaderField, { label: string; choices?: [string, string][] }> = {
  origin_ip: { label: "Adresse IP du serveur qui a réellement envoyé le mail (premier saut)" },
  spf: { label: "Résultat du contrôle SPF", choices: [["pass", "pass (réussi)"], ["fail", "fail (échec)"], ["softfail", "softfail (échec léger)"], ["neutral", "neutral"], ["none", "none (absent)"]] },
  dkim: { label: "Résultat du contrôle DKIM", choices: [["pass", "pass (signature valide)"], ["fail", "fail (signature invalide)"], ["none", "none (pas de signature)"]] },
  dmarc: { label: "Résultat du contrôle DMARC", choices: [["pass", "pass"], ["fail", "fail"], ["none", "none"]] },
  reply_to: { label: "La réponse (Reply-To) part-elle vers un autre domaine que l'expéditeur affiché ?", choices: [["oui", "Oui"], ["non", "Non"]] },
  verdict: { label: "Votre conclusion", choices: [["phishing", "Mail frauduleux (phishing)"], ["legitime", "Mail légitime"]] },
};

/** En-têtes dépliés (les lignes qui commencent par un espace prolongent la précédente). */
export function parseHeaders(raw: string): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  for (const line of String(raw || "").replace(/\r/g, "").split("\n")) {
    if (!line.trim()) { if (out.length) break; else continue; }
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1].value += " " + line.trim();
    else { const k = line.indexOf(":"); if (k > 0) out.push({ name: line.slice(0, k).trim(), value: line.slice(k + 1).trim() }); }
  }
  return out;
}

const get = (h: { name: string; value: string }[], n: string) => h.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value || "";
const domainOf = (s: string) => (s.match(/@([A-Za-z0-9.-]+)/)?.[1] || "").toLowerCase();
const isPrivate = (ip: string) => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(ip);

/** Sauts du plus ancien (expéditeur) au plus récent (boîte du destinataire). */
export function hops(raw: string): Hop[] {
  const rec = parseHeaders(raw).filter((x) => x.name.toLowerCase() === "received").map((x) => x.value).reverse();
  let prev: number | null = null;
  return rec.map((v, i) => {
    const from = v.match(/from\s+(\S+)/i)?.[1] || "";
    const by = v.match(/by\s+(\S+)/i)?.[1] || "";
    const ip = v.match(/\[(\d{1,3}(?:\.\d{1,3}){3})\]/)?.[1] || v.match(/\((?:[^()]*?)(\d{1,3}(?:\.\d{1,3}){3})\)/)?.[1] || null;
    const dateStr = v.includes(";") ? v.slice(v.lastIndexOf(";") + 1).trim() : null;
    const t = dateStr ? Date.parse(dateStr) : NaN;
    const delay = Number.isFinite(t) && prev !== null ? Math.round((t - prev) / 1000) : null;
    if (Number.isFinite(t)) prev = t;
    return { n: i + 1, from, by, ip, date: dateStr, delay_s: delay };
  });
}

export function summary(raw: string) {
  const h = parseHeaders(raw);
  const auth = h.filter((x) => /^(authentication-results|arc-authentication-results)$/i.test(x.name)).map((x) => x.value).join(" ; ");
  const res = (k: string) => (auth.match(new RegExp(`\\b${k}=(\\w+)`, "i"))?.[1] || "none").toLowerCase();
  return {
    from: get(h, "From"), replyTo: get(h, "Reply-To"), returnPath: get(h, "Return-Path"),
    to: get(h, "To"), subject: get(h, "Subject"), date: get(h, "Date"), messageId: get(h, "Message-ID"),
    auth, spf: res("spf"), dkim: res("dkim"), dmarc: res("dmarc"),
  };
}

/** Correction proposée automatiquement à l'admin (il peut la modifier). */
export function suggestKey(raw: string): Record<HeaderField, string> {
  const s = summary(raw);
  const origin = hops(raw).find((x) => x.ip && !isPrivate(x.ip))?.ip || "";
  const rt = domainOf(s.replyTo), fr = domainOf(s.from);
  return {
    origin_ip: origin, spf: s.spf, dkim: s.dkim, dmarc: s.dmarc,
    reply_to: rt && fr && rt !== fr ? "oui" : "non",
    verdict: s.spf !== "pass" || s.dkim !== "pass" || (rt && rt !== fr) ? "phishing" : "legitime",
  };
}

export function validHeadersQuestion(o: any, key: any): string | null {
  if (typeof o?.raw !== "string" || !o.raw.trim() || o.raw.length > 30000) return "En-têtes bruts requis";
  if (!parseHeaders(o.raw).length) return "Aucun en-tête reconnu (format « Nom: valeur »)";
  const ask: string[] = o.ask || [];
  if (!ask.length || ask.some((f) => !(f in HEADER_QUESTIONS))) return "Choisissez au moins une question";
  if (!key || ask.some((f) => typeof key[f] !== "string" || !key[f].trim())) return "Réponse attendue manquante pour une question";
  return null;
}
