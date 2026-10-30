import { globalSebKeys } from "./env";

/**
 * Vérification Safe Exam Browser.
 *
 * SEB envoie sur CHAQUE requête (pages et fetch) :
 *   X-SafeExamBrowser-RequestHash    = SHA256(URL absolue + Browser Exam Key)
 *   X-SafeExamBrowser-ConfigKeyHash  = SHA256(URL absolue + Config Key)
 * Spec : https://safeexambrowser.org/developer/seb-config-key.html
 *
 * La Browser Exam Key dépend de la version et de la plateforme de SEB
 * (une clé par couple version/OS autorisé). La Config Key ne dépend que de
 * la configuration .seb : c'est la plus pratique pour un parc hétérogène.
 * On accepte l'une OU l'autre, à partir de listes de clés par test.
 *
 * Contrairement au projet d'origine, on échoue en mode FERMÉ : si SEB est
 * exigé mais qu'aucune clé n'est configurée, l'accès est refusé (la simple
 * présence d'un en-tête ne prouve rien, n'importe qui peut l'ajouter).
 */

export type SebKeys = { bek: string[]; ck: string[] };

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function mergeKeys(perTest: Partial<SebKeys> | null | undefined): SebKeys {
  const g = globalSebKeys();
  const norm = (arr?: string[] | null) => (arr || []).map((k) => k.trim().toLowerCase()).filter(Boolean);
  return {
    bek: Array.from(new Set([...g.bek, ...norm(perTest?.bek)])),
    ck: Array.from(new Set([...g.ck, ...norm(perTest?.ck)])),
  };
}

export function sebRequired(testRequiresSeb: boolean): boolean {
  return testRequiresSeb || globalSebKeys().enforce;
}

export type SebResult = { ok: true } | { ok: false; reason: "not_seb" | "bad_key" | "no_keys_configured" };

export async function verifySeb(fullUrl: string, headers: Headers, keys: SebKeys): Promise<SebResult> {
  if (!keys.bek.length && !keys.ck.length) return { ok: false, reason: "no_keys_configured" };
  // L'URL hachée par SEB n'inclut pas le fragment.
  const url = fullUrl.split("#")[0];
  const reqHash = (headers.get("x-safeexambrowser-requesthash") || "").toLowerCase();
  const cfgHash = (headers.get("x-safeexambrowser-configkeyhash") || "").toLowerCase();
  if (!reqHash && !cfgHash) return { ok: false, reason: "not_seb" };

  for (const k of keys.bek) {
    if (reqHash && timingSafeEqualHex(await sha256Hex(url + k), reqHash)) return { ok: true };
  }
  for (const k of keys.ck) {
    if (cfgHash && timingSafeEqualHex(await sha256Hex(url + k), cfgHash)) return { ok: true };
  }
  return { ok: false, reason: "bad_key" };
}

export { sha256Hex };
