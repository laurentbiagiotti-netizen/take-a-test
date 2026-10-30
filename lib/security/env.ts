/**
 * Configuration serveur. APP_URL est la seule source de vérité pour l'origine
 * publique : on ne fait jamais confiance aux en-têtes Host / X-Forwarded-*
 * fournis par le client (risque d'injection d'hôte et de contournement SEB).
 */
export function appUrl(): string {
  const raw = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) throw new Error("APP_URL doit être défini (ex. https://exam.cybersup.ai)");
  return raw.replace(/\/+$/, "");
}

export function appHost(): string {
  return new URL(appUrl()).host;
}

export function supabaseHost(): string {
  return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost").host;
}

/** Clés SEB globales (en plus des clés propres à chaque test). */
export function globalSebKeys(): { bek: string[]; ck: string[]; enforce: boolean } {
  const split = (v?: string) => (v || "").split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return {
    bek: split(process.env.SEB_BROWSER_EXAM_KEY),
    ck: split(process.env.SEB_CONFIG_KEY),
    enforce: process.env.SEB_ENFORCE === "true",
  };
}

/** Nombre de proxys de confiance devant l'appli (pour lire l'IP client). */
export function trustedProxyHops(): number {
  const n = parseInt(process.env.TRUSTED_PROXY_HOPS || "1", 10);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}
