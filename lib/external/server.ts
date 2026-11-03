import { hmacHex } from "@/lib/security/secretbox";
import { timingSafeEqual } from "@/lib/security/tokens";
import { TOOLS, type ToolInfo } from "./tools";

/**
 * Côté serveur uniquement : adresses et secrets des outils, jetons de
 * lancement et vérification des résultats signés.
 *
 * Variables d'environnement, par outil (ID en majuscules) :
 *   EXTERNAL_<ID>_URL     adresse publique de l'outil (sinon celle par défaut)
 *   EXTERNAL_<ID>_SECRET  secret partagé, 32 caractères au moins
 * Un outil sans secret est désactivé.
 */
export type ToolConfig = ToolInfo & { url: string; origin: string; secret: string };

export function toolConfig(id: string): ToolConfig | null {
  const info = TOOLS[id];
  if (!info) return null;
  const key = id.toUpperCase();
  const secret = process.env[`EXTERNAL_${key}_SECRET`] || "";
  if (secret.length < 32) return null;
  const url = (process.env[`EXTERNAL_${key}_URL`] || info.defaultUrl).replace(/\/+$/, "");
  let origin: string;
  try { origin = new URL(url).origin; } catch { return null; }
  return { ...info, url, origin, secret };
}

/** Origines des outils actifs (cadre de l'épreuve et appels du navigateur). */
export function toolOrigins(): string[] {
  return Object.keys(TOOLS).map((id) => toolConfig(id)?.origin).filter((o): o is string => !!o);
}

export type LaunchPayload = {
  v: 1;
  /** Outil destinataire : un jeton fait pour un outil est refusé par les autres. */
  aud: string;
  /** Session d'exercice et nonce qui la lie au jeton. */
  sid: string;
  n: string;
  iat: number;
  /** Fin de l'exercice (secondes Unix) : au-delà, le jeton ne vaut plus rien. */
  exp: number;
  /** Adresse de la plateforme : résultat (outil qui note) ou contenu (plateforme qui note). */
  api: string;
  /** Scénario, pour les outils qui notent eux-mêmes. */
  scn?: unknown;
};

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");

export async function signLaunch(p: LaunchPayload, secret: string): Promise<string> {
  const body = b64url(JSON.stringify(p));
  return `${body}.${await hmacHex(secret, `launch.${body}`)}`;
}

/** Vérifie la signature, l'outil et l'expiration ; renvoie la charge ou null. */
export async function verifyLaunch(token: string, tool: ToolConfig, now = Date.now()): Promise<LaunchPayload | null> {
  if (typeof token !== "string" || token.length > 20000) return null;
  const m = /^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.exec(token);
  if (!m) return null;
  if (!timingSafeEqual(await hmacHex(tool.secret, `launch.${m[1]}`), m[2])) return null;
  let p: LaunchPayload;
  try { p = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8")); } catch { return null; }
  if (p?.v !== 1 || p.aud !== tool.id || typeof p.sid !== "string" || typeof p.n !== "string") return null;
  // 2 minutes de marge, comme côté base, pour un dernier envoi en vol.
  if (typeof p.exp !== "number" || now / 1000 > p.exp + 120) return null;
  return p;
}

/** Lit l'outil visé par un jeton sans le vérifier (pour choisir le secret). */
export function peekAudience(token: string): string | null {
  try {
    const p = JSON.parse(Buffer.from(String(token).split(".")[0], "base64url").toString("utf8"));
    return typeof p?.aud === "string" ? p.aud : null;
  } catch { return null; }
}

/**
 * Signature d'un résultat envoyé par le serveur d'un outil :
 *   X-Cx-Tool: crime
 *   X-Cx-Timestamp: <secondes Unix>
 *   X-Cx-Signature: hex(HMAC-SHA256(secret, "result.<timestamp>.<corps brut>"))
 */
export async function resultSignature(secret: string, ts: string, body: string): Promise<string> {
  return hmacHex(secret, `result.${ts}.${body}`);
}

export async function verifyResultSignature(tool: ToolConfig, ts: string, sig: string, body: string, now = Date.now()): Promise<boolean> {
  if (!/^\d{10}$/.test(ts) || !/^[a-f0-9]{64}$/.test(sig)) return false;
  if (Math.abs(now / 1000 - Number(ts)) > 300) return false;
  return timingSafeEqual(await resultSignature(tool.secret, ts, body), sig);
}
