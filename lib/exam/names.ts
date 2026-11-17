/** Prénom ou nom : lettres (accents compris), espaces, tirets, apostrophes ; 1 à 80 caractères. */
export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFC").replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
  if (!s || s.length > 80 || !/^[\p{L}][\p{L}\p{M} '.-]*$/u.test(s)) return null;
  return s;
}
