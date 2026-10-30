/** Vérifie le type réel d'une image par ses octets magiques (pas le MIME déclaré). */
export async function readImage(file: FormDataEntryValue | null, maxBytes: number):
  Promise<{ bytes: Uint8Array; type: "image/jpeg" | "image/png" | "image/webp"; ext: string } | null> {
  if (!file || typeof file === "string") return null;
  if (file.size === 0 || file.size > maxBytes) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { bytes, type: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { bytes, type: "image/png", ext: "png" };
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP")
    return { bytes, type: "image/webp", ext: "webp" };
  return null;
}
