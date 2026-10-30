import { NextRequest } from "next/server";
import { appUrl, trustedProxyHops } from "./env";

/**
 * IP client : on prend l'adresse ajoutée par le dernier proxy de confiance
 * (en partant de la droite de X-Forwarded-For), pas la première valeur, que
 * le client peut forger.
 */
export function clientIp(req: Request | NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const hops = trustedProxyHops();
    const idx = Math.max(0, parts.length - hops);
    return parts[idx] || parts[parts.length - 1] || null;
  }
  return req.headers.get("x-real-ip");
}

export function userAgent(req: Request | NextRequest): string {
  return (req.headers.get("user-agent") || "").slice(0, 500);
}

/** URL absolue telle que le navigateur l'a demandée, reconstruite depuis APP_URL. */
export function publicUrl(req: Request | NextRequest): string {
  const u = new URL(req.url);
  return `${appUrl()}${u.pathname}${u.search}`;
}

/**
 * Protection CSRF des routes POST : l'Origin (ou à défaut le Referer) doit
 * être exactement notre application.
 */
export function sameOrigin(req: Request | NextRequest): boolean {
  const expected = appUrl();
  const origin = req.headers.get("origin");
  if (origin) return origin === expected;
  const referer = req.headers.get("referer");
  return !!referer && (referer === expected || referer.startsWith(expected + "/"));
}

export { safeNextPath } from "./redirect";
