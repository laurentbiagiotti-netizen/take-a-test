/** Aléa cryptographique (jamais Math.random pour un secret). */
export function randomHex(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I

/** Code lisible XXXX-XXXX-XXXX (32^12 ≈ 1,2e18 combinaisons), tirage sans biais. */
export function genCode(groups = 3): string {
  const out: string[] = [];
  const buf = new Uint8Array(1);
  for (let g = 0; g < groups; g++) {
    let part = "";
    while (part.length < 4) {
      crypto.getRandomValues(buf);
      // 256 = 8 × 32 : pas de biais de modulo
      part += ALPHA[buf[0] % ALPHA.length];
    }
    out.push(part);
  }
  return out.join("-");
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Nom du cookie de session d'examen (un par test, limité aux routes /api/exam/<id>). */
export function examCookieName(testId: string): string {
  return `cx_exam_${testId.replace(/[^a-f0-9]/gi, "")}`;
}
