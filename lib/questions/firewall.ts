/**
 * Type de question « blocks » : le candidat programme un pare-feu avec des
 * blocs (Blockly). Le programme est un arbre JSON déclaratif (jamais du code
 * exécuté) : on l'évalue sur des paquets de test cachés, côté serveur.
 */
export type FwField = "src_ip" | "dst_port" | "protocol" | "country" | "hour";
export type FwOp = "eq" | "ne" | "in_cidr" | "not_in_cidr" | "lt" | "gt" | "in_list";
export type FwAction = "allow" | "block";
export type FwCond = { and: [FwCond, FwCond] } | { or: [FwCond, FwCond] } | { not: FwCond } | { field: FwField; op: FwOp; value: string };
export type FwProgram = { default: FwAction; rules: { cond: FwCond | null; action: FwAction }[] };
export type FwPacket = { id: string; src_ip: string; dst_port: number; protocol: string; country?: string; hour?: number; label?: string; expected?: FwAction };

export const FW_FIELDS: [FwField, string][] = [
  ["src_ip", "IP source"], ["dst_port", "port de destination"], ["protocol", "protocole"], ["country", "pays d'origine"], ["hour", "heure (0-23)"],
];
export const FW_OPS: [FwOp, string][] = [
  ["eq", "="], ["ne", "≠"], ["in_cidr", "dans le réseau"], ["not_in_cidr", "hors du réseau"], ["lt", "<"], ["gt", ">"], ["in_list", "dans la liste"],
];

function ip4(s: string): number | null {
  const m = String(s).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
function inCidr(ip: string, cidr: string): boolean {
  const [net, bitsRaw] = String(cidr).trim().split("/");
  const a = ip4(ip), n = ip4(net), bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
  if (a === null || n === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((n & mask) >>> 0);
}

function test(c: FwCond | null, p: FwPacket, depth = 0): boolean {
  if (!c || depth > 30) return true;
  if ("and" in c) return test(c.and[0], p, depth + 1) && test(c.and[1], p, depth + 1);
  if ("or" in c) return test(c.or[0], p, depth + 1) || test(c.or[1], p, depth + 1);
  if ("not" in c) return !test(c.not, p, depth + 1);
  const raw = (p as any)[c.field];
  const v = String(c.value ?? "").trim();
  const str = String(raw ?? "").toLowerCase(), val = v.toLowerCase();
  switch (c.op) {
    case "eq": return str === val;
    case "ne": return str !== val;
    case "lt": return Number(raw) < Number(v);
    case "gt": return Number(raw) > Number(v);
    case "in_list": return val.split(/[,;\s]+/).filter(Boolean).includes(str);
    case "in_cidr": return c.field === "src_ip" && v.split(/[,;\s]+/).filter(Boolean).some((x) => inCidr(String(raw), x));
    case "not_in_cidr": return c.field === "src_ip" && !v.split(/[,;\s]+/).filter(Boolean).some((x) => inCidr(String(raw), x));
  }
  return false;
}

/** Première règle qui correspond, sinon la politique par défaut. */
export function decide(prog: FwProgram, p: FwPacket): FwAction {
  for (const r of prog.rules || []) if (r.cond && test(r.cond, p)) return r.action;
  return prog.default === "block" ? "block" : "allow";
}

/** Barème : sous 50 % de bonnes décisions, 0 ; puis au prorata jusqu'à 100 % (bloquer tout ne rapporte rien). */
export function gradeFirewall(prog: FwProgram | null, packets: FwPacket[], points: number): { score: number; correct: number; total: number } {
  const total = packets.length;
  if (!prog || !total) return { score: 0, correct: 0, total };
  const correct = packets.filter((p) => decide(prog, p) === p.expected).length;
  const ratio = Math.max(0, (2 * correct) / total - 1);
  return { score: Math.round(points * ratio * 100) / 100, correct, total };
}

const FIELDS = new Set(FW_FIELDS.map((f) => f[0]));
const OPS = new Set(FW_OPS.map((o) => o[0]));
function validCond(c: any, depth = 0): boolean {
  if (c === null) return true;
  if (!c || typeof c !== "object" || depth > 30) return false;
  if ("and" in c || "or" in c) { const x = c.and || c.or; return Array.isArray(x) && x.length === 2 && x.every((y: any) => validCond(y, depth + 1)); }
  if ("not" in c) return validCond(c.not, depth + 1);
  return FIELDS.has(c.field) && OPS.has(c.op) && typeof c.value === "string" && c.value.length <= 200;
}
export function validProgram(x: any): x is FwProgram {
  return !!x && (x.default === "allow" || x.default === "block") && Array.isArray(x.rules) && x.rules.length <= 50
    && x.rules.every((r: any) => r && (r.action === "allow" || r.action === "block") && validCond(r.cond));
}
export function validPackets(x: any, withExpected: boolean): x is FwPacket[] {
  return Array.isArray(x) && x.length >= 1 && x.length <= 200 && x.every((p: any) => p && typeof p.id === "string"
    && ip4(p.src_ip) !== null && Number.isInteger(p.dst_port) && typeof p.protocol === "string"
    && (!withExpected || p.expected === "allow" || p.expected === "block"));
}
