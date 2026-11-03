import { Address4 } from "ip-address";
import { int, pick, rng } from "./seed";

/**
 * Type de question « subnet » : calcul de sous-réseaux IPv4 (bibliothèque ip-address, MIT).
 *  - mode « basic » : pour une adresse et un préfixe tirés au hasard, trouver réseau, broadcast, hôtes…
 *  - mode « vlsm »  : découper un bloc pour plusieurs services ; toute réponse valide est acceptée
 */
export type SubnetField = "network" | "broadcast" | "first" | "last" | "hosts" | "mask";
export type SubnetOptions =
  | { mode: "basic"; prefixes?: number[]; ask?: SubnetField[]; help?: boolean }
  | { mode: "vlsm"; services?: number; help?: boolean };

export const FIELD_LABEL: Record<SubnetField, string> = {
  network: "Adresse du réseau", broadcast: "Adresse de broadcast", first: "Première adresse utilisable",
  last: "Dernière adresse utilisable", hosts: "Nombre d'hôtes utilisables", mask: "Masque (notation décimale)",
};
const ALL: SubnetField[] = ["network", "broadcast", "first", "last", "hosts", "mask"];

const toInt = (ip: string) => ip.split(".").reduce((a, x) => ((a << 8) >>> 0) + Number(x), 0) >>> 0;
const toIp = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
const maskOf = (p: number) => (p === 0 ? 0 : (~0 << (32 - p)) >>> 0);

export function basicProblem(seed: string, o: Extract<SubnetOptions, { mode: "basic" }>) {
  const r = rng(seed);
  const prefixes = o.prefixes?.length ? o.prefixes : [24, 25, 26, 27, 28];
  const prefix = pick(r, prefixes);
  const base = pick(r, ["10", "172", "192"] as const);
  const ip = base === "10" ? `10.${int(r, 0, 255)}.${int(r, 0, 255)}.${int(r, 1, 254)}`
    : base === "172" ? `172.${int(r, 16, 31)}.${int(r, 0, 255)}.${int(r, 1, 254)}`
    : `192.168.${int(r, 0, 255)}.${int(r, 1, 254)}`;
  return { ip, prefix, ask: (o.ask?.length ? o.ask : ALL).filter((f) => ALL.includes(f)) };
}

export function solveBasic(ip: string, prefix: number): Record<SubnetField, string> {
  const a = new Address4(`${ip}/${prefix}`);
  const net = a.startAddress().address, bc = a.endAddress().address;
  const n = toInt(net), b = toInt(bc);
  const hosts = prefix >= 31 ? (prefix === 31 ? 2 : 1) : 2 ** (32 - prefix) - 2;
  return {
    network: net, broadcast: bc,
    first: prefix >= 31 ? net : toIp(n + 1), last: prefix >= 31 ? bc : toIp(b - 1),
    hosts: String(hosts), mask: toIp(maskOf(prefix)),
  };
}

const NAMES = ["Administration", "Pédagogie", "Wi-Fi invités", "Serveurs", "Vidéosurveillance", "Laboratoire"];
export function vlsmProblem(seed: string, o: Extract<SubnetOptions, { mode: "vlsm" }>) {
  const r = rng(seed);
  const n = Math.min(5, Math.max(2, o.services || 3));
  const names = [...NAMES];
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  names.length = n;
  const third = int(r, 0, 250);
  // Besoins tirés pour tenir dans un /24 (somme des blocs ≤ 256)
  const sizes = [int(r, 60, 110), int(r, 25, 55), int(r, 10, 28), int(r, 4, 12), int(r, 2, 5)].slice(0, n);
  return { block: `192.168.${third}.0/24`, services: names.map((name, i) => ({ id: `s${i + 1}`, name, hosts: sizes[i] })) };
}

/** Préfixe minimal pour h hôtes utilisables. */
export const minPrefix = (h: number) => { let p = 30; while (p > 0 && 2 ** (32 - p) - 2 < h) p--; return p; };

function parseCidr(s: string): { n: number; p: number } | null {
  const t = String(s || "").trim();
  const m = t.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (!m || !Address4.isValid(m[1])) return null;
  const p = Number(m[2]);
  if (p < 0 || p > 32) return null;
  return { n: toInt(m[1]), p };
}

/** Note du VLSM : chaque service compte s'il a un sous-réseau aligné, de la bonne taille, dans le bloc et sans chevauchement. */
export function checkVlsm(block: string, services: { id: string; hosts: number }[], answers: Record<string, string>) {
  const B = parseCidr(block)!;
  const bStart = (B.n & maskOf(B.p)) >>> 0, bEnd = bStart + 2 ** (32 - B.p) - 1;
  const parsed = services.map((s) => ({ s, c: parseCidr(answers?.[s.id] || "") }));
  const ok: Record<string, boolean> = {};
  for (const { s, c } of parsed) {
    if (!c) { ok[s.id] = false; continue; }
    const start = c.n, end = c.n + 2 ** (32 - c.p) - 1;
    const aligned = ((c.n & maskOf(c.p)) >>> 0) === c.n;
    const inside = start >= bStart && end <= bEnd;
    const size = c.p === minPrefix(s.hosts);
    const overlap = parsed.some((o) => o.s.id !== s.id && o.c && !(o.c.n + 2 ** (32 - o.c.p) - 1 < start || o.c.n > end));
    ok[s.id] = aligned && inside && size && !overlap;
  }
  return ok;
}

const norm = (x: unknown) => String(x ?? "").trim().replace(/\s+/g, "");
export function gradeSubnet(o: SubnetOptions, seed: string, resp: any, points: number): number {
  if (o.mode === "vlsm") {
    const pb = vlsmProblem(seed, o);
    const ok = checkVlsm(pb.block, pb.services, resp?.subnets || {});
    const good = Object.values(ok).filter(Boolean).length;
    return Math.round(points * good / pb.services.length * 100) / 100;
  }
  const pb = basicProblem(seed, o);
  const sol = solveBasic(pb.ip, pb.prefix);
  const good = pb.ask.filter((f) => norm(resp?.fields?.[f]) === sol[f]).length;
  return pb.ask.length ? Math.round(points * good / pb.ask.length * 100) / 100 : 0;
}

export function validSubnetOptions(o: any): string | null {
  if (o?.mode === "basic") {
    if (o.prefixes && (!Array.isArray(o.prefixes) || o.prefixes.some((p: any) => !Number.isInteger(p) || p < 8 || p > 30))) return "Préfixes entre /8 et /30";
    if (o.ask && (!Array.isArray(o.ask) || !o.ask.length || o.ask.some((f: any) => !ALL.includes(f)))) return "Au moins une valeur à demander";
    return null;
  }
  if (o?.mode === "vlsm") return Number.isInteger(o.services ?? 3) && (o.services ?? 3) >= 2 && (o.services ?? 3) <= 5 ? null : "2 à 5 services";
  return "Mode « basic » ou « vlsm » attendu";
}
