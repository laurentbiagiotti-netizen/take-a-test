/**
 * Opérations de décodage (type de question « decode », inspiré de CyberChef).
 * Partagées par la page candidat (aperçu en direct) et l'éditeur admin
 * (fabrication du message chiffré à partir du flag). Tout se fait sur des octets.
 */
export type DecodeOp = "from_base64" | "to_base64" | "from_hex" | "to_hex" | "rot13" | "caesar" | "xor" | "reverse" | "url_decode" | "url_encode";
export type RecipeStep = { op: DecodeOp; arg?: string };

export const DECODE_OPS: { op: DecodeOp; label: string; arg?: string; hint: string }[] = [
  { op: "from_base64", label: "Depuis Base64", hint: "Texte avec A-Z, a-z, 0-9, +, / et souvent = à la fin" },
  { op: "to_base64", label: "Vers Base64", hint: "Encode en Base64" },
  { op: "from_hex", label: "Depuis hexadécimal", hint: "Paires de chiffres 0-9 et lettres a-f" },
  { op: "to_hex", label: "Vers hexadécimal", hint: "Affiche chaque octet en hexadécimal" },
  { op: "rot13", label: "ROT13", hint: "Décale chaque lettre de 13 (s'annule en l'appliquant deux fois)" },
  { op: "caesar", label: "César", arg: "Décalage", hint: "Décale chaque lettre du nombre indiqué (négatif pour revenir)" },
  { op: "xor", label: "XOR", arg: "Clé", hint: "XOR octet par octet avec la clé (texte), répétée" },
  { op: "reverse", label: "Inverser", hint: "Lit le texte à l'envers" },
  { op: "url_decode", label: "Décodage URL", hint: "Remplace les %20, %3D…" },
  { op: "url_encode", label: "Encodage URL", hint: "Encode les caractères spéciaux en %XX" },
];
export const OP_LABEL = Object.fromEntries(DECODE_OPS.map((o) => [o.op, o.label])) as Record<DecodeOp, string>;

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: false });
const toBytes = (s: string) => enc.encode(s);

function b64decode(s: string): Uint8Array {
  const clean = s.replace(/[\s]/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error("Ce n'est pas du Base64 valide");
  const pad = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function b64encode(b: Uint8Array): string {
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
function shift(b: Uint8Array, n: number): Uint8Array {
  const k = ((n % 26) + 26) % 26;
  return b.map((c) => (c >= 65 && c <= 90 ? ((c - 65 + k) % 26) + 65 : c >= 97 && c <= 122 ? ((c - 97 + k) % 26) + 97 : c));
}

export function applyStep(b: Uint8Array, s: RecipeStep): Uint8Array {
  switch (s.op) {
    case "from_base64": return b64decode(dec.decode(b));
    case "to_base64": return toBytes(b64encode(b));
    case "from_hex": {
      const h = dec.decode(b).replace(/[\s:]|0x/gi, "");
      if (!/^([0-9a-f]{2})*$/i.test(h)) throw new Error("Ce n'est pas de l'hexadécimal valide");
      return Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));
    }
    case "to_hex": return toBytes(Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(""));
    case "rot13": return shift(b, 13);
    case "caesar": {
      const n = parseInt(s.arg || "0", 10);
      if (!Number.isFinite(n)) throw new Error("Décalage invalide");
      return shift(b, n);
    }
    case "xor": {
      const key = toBytes(s.arg || "");
      if (!key.length) throw new Error("Indiquez une clé");
      return b.map((x, i) => x ^ key[i % key.length]);
    }
    case "reverse": return toBytes(Array.from(dec.decode(b)).reverse().join(""));
    case "url_decode": try { return toBytes(decodeURIComponent(dec.decode(b))); } catch { throw new Error("Encodage URL invalide"); }
    case "url_encode": return toBytes(encodeURIComponent(dec.decode(b)));
  }
  throw new Error("Opération inconnue");
}

/** Applique une recette ; renvoie le texte obtenu ou l'erreur de l'étape fautive. */
export function runRecipe(input: string, recipe: RecipeStep[]): { text: string; printable: boolean; error?: string; failedAt?: number } {
  let b: Uint8Array = toBytes(input);
  for (let i = 0; i < recipe.length; i++) {
    try { b = applyStep(b, recipe[i]); } catch (e: any) { return { text: "", printable: true, error: e?.message || "Erreur", failedAt: i }; }
  }
  const printable = b.every((x) => x === 9 || x === 10 || x === 13 || (x >= 32 && x !== 127));
  return { text: printable ? dec.decode(b) : Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(" "), printable };
}

/** Inverse d'une étape, pour fabriquer le message chiffré à partir du flag (éditeur admin). */
const INVERSE: Record<DecodeOp, DecodeOp> = {
  from_base64: "to_base64", to_base64: "from_base64", from_hex: "to_hex", to_hex: "from_hex",
  rot13: "rot13", caesar: "caesar", xor: "xor", reverse: "reverse", url_decode: "url_encode", url_encode: "url_decode",
};
export function encodeForRecipe(plain: string, decodeRecipe: RecipeStep[]): string {
  const steps = [...decodeRecipe].reverse().map((s) => ({
    op: INVERSE[s.op], arg: s.op === "caesar" ? String(-parseInt(s.arg || "0", 10)) : s.arg,
  }));
  const r = runRecipe(plain, steps);
  if (r.error) throw new Error(r.error);
  if (!r.printable) throw new Error("La recette donne des octets illisibles : terminez l'encodage par Base64 ou hexadécimal");
  return r.text;
}

export function validRecipe(x: unknown, max = 20): x is RecipeStep[] {
  return Array.isArray(x) && x.length <= max && x.every((s: any) => s && OP_LABEL[s.op as DecodeOp] && (s.arg === undefined || (typeof s.arg === "string" && s.arg.length <= 100)));
}
