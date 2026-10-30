/**
 * Chiffrement AES-256-GCM des secrets stockés en base (secret de signature
 * des clés d'API). Clé maîtresse : API_SECRETS_KEY (32 octets en hex ou base64),
 * jamais en base : une fuite de la base seule ne livre pas les secrets.
 */
function masterKeyBytes(): Uint8Array<ArrayBuffer> {
  const raw = process.env.API_SECRETS_KEY || "";
  const bytes = new Uint8Array(new ArrayBuffer(32 * 0 + (/^[0-9a-f]{64}$/i.test(raw) ? 32 : Buffer.from(raw, "base64").length)));
  bytes.set(/^[0-9a-f]{64}$/i.test(raw) ? raw.match(/../g)!.map((h) => parseInt(h, 16)) : Buffer.from(raw, "base64"));
  if (bytes.length !== 32) throw new Error("API_SECRETS_KEY doit faire 32 octets (64 caractères hex)");
  return bytes;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", masterKeyBytes(), "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** `aad` lie le secret chiffré à son contexte (ex. préfixe de la clé) : impossible de l'échanger avec une autre ligne. */
export async function seal(plain: string, aad = ""): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) }, await key(), new TextEncoder().encode(plain)));
  return `v1.${Buffer.from(iv).toString("base64")}.${Buffer.from(ct).toString("base64")}`;
}

export async function open(sealed: string, aad = ""): Promise<string> {
  const [v, ivB, ctB] = sealed.split(".");
  if (v !== "v1" || !ivB || !ctB) throw new Error("secret scellé invalide");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(ivB, "base64"), additionalData: new TextEncoder().encode(aad) }, await key(), Buffer.from(ctB, "base64"));
  return new TextDecoder().decode(pt);
}

export async function hmacHex(secret: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
  return Buffer.from(sig).toString("hex");
}
