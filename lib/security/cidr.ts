/** Test d'appartenance d'une IP à une liste de plages CIDR (IPv4 et IPv6). */
function v4(ip: string): bigint | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return BigInt(((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]);
}

function v6(ip: string): bigint | null {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return null;
  if (!/^[0-9a-f:]+$/.test(s) || (s.match(/::/g) || []).length > 1) return null;
  const [head, tail] = s.includes("::") ? s.split("::") : [s, null];
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const fill = tail === null ? 0 : 8 - h.length - t.length;
  if (fill < 0) return null;
  const parts = [...h, ...Array(fill).fill("0"), ...t];
  if (parts.length !== 8) return null;
  let n = 0n;
  for (const x of parts) { if (!/^[0-9a-f]{1,4}$/.test(x)) return null; n = (n << 16n) + BigInt(parseInt(x, 16)); }
  return n;
}

function norm(ip: string): { n: bigint; bits: number } | null {
  const m = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const a = v4(m ? m[1] : ip);
  if (a !== null) return { n: a, bits: 32 };
  const b = v6(ip);
  return b !== null ? { n: b, bits: 128 } : null;
}

export function ipInCidrs(ip: string | null | undefined, cidrs: string[]): boolean {
  if (!ip) return false;
  const a = norm(ip.trim());
  if (!a) return false;
  for (const c of cidrs) {
    const [base, lenStr] = c.trim().split("/");
    const b = norm(base);
    if (!b || b.bits !== a.bits) continue;
    const len = lenStr === undefined ? b.bits : Number(lenStr);
    if (!Number.isInteger(len) || len < 0 || len > b.bits) continue;
    const shift = BigInt(b.bits - len);
    if ((a.n >> shift) === (b.n >> shift)) return true;
  }
  return false;
}

export function validCidr(c: string): boolean {
  const [base, len] = c.trim().split("/");
  const b = norm(base);
  if (!b) return false;
  if (len === undefined) return true;
  const n = Number(len);
  return Number.isInteger(n) && n >= 0 && n <= b.bits;
}
