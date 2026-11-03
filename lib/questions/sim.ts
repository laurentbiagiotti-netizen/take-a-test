/**
 * Type de question « sim » : mini-applications réalistes, notées par le serveur sur leur état final.
 * options.kind choisit l'application :
 *   privacy  réglages de confidentialité d'une appli photo (B1)
 *   osint    question secrète devinable depuis un profil public (B1)
 *   patch    baie de brassage : prises du bureau vers les ports du switch selon les VLAN (B3)
 *   fwweb    pare-feu en interface web façon pfSense (B3)
 *   pcap     capture réseau façon Wireshark (B3)
 * La réponse du candidat est toujours { state: {...} }.
 */
import { gradeFirewall, type FwPacket, type FwProgram, type FwCond } from "./firewall";

export type SimKind = "privacy" | "osint" | "patch" | "fwweb" | "pcap";
export const SIM_KINDS: [SimKind, string][] = [
  ["privacy", "Réglages de confidentialité (appli photo)"], ["osint", "Question secrète devinable"],
  ["patch", "Baie de brassage et VLAN"], ["fwweb", "Pare-feu en interface web"], ["pcap", "Capture réseau"],
];

export const normTxt = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const round = (x: number) => Math.round(x * 100) / 100;
const obj = (x: any) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});

/* ---------- privacy : réglages + publications à supprimer + demandes d'abonnement ---------- */
export type PrivacyKey = { settings: Record<string, string | boolean>; deleted: string[]; kept?: string[]; requests: Record<string, "accept" | "refuse">; bio_forbid?: string[] };
function gradePrivacy(key: PrivacyKey, st: any, points: number) {
  const s = obj(st.settings), del: string[] = Array.isArray(st.deleted) ? st.deleted : [], req = obj(st.requests);
  const items: boolean[] = [
    ...Object.entries(key.settings || {}).map(([k, v]) => s[k] === v),
    ...(key.deleted || []).map((id) => del.includes(id)),
    ...(key.kept || []).map((id) => !del.includes(id)),
    ...Object.entries(key.requests || {}).map(([id, v]) => req[id] === v),
  ];
  if (key.bio_forbid?.length) {
    const bio = normTxt(s.bio ?? "\u0000");
    items.push(typeof s.bio === "string" && key.bio_forbid.every((w) => !bio.includes(normTxt(w))));
  }
  return items.length ? round(points * items.filter(Boolean).length / items.length) : 0;
}

/* ---------- osint / pcap : réponses texte ---------- */
export type FieldsKey = { answers: Record<string, string | string[]>; choice?: string };
function gradeFields(key: FieldsKey, st: any, points: number) {
  const a = obj(st.answers);
  const items = Object.entries(key.answers || {}).map(([id, exp]) => ([] as string[]).concat(exp).some((e) => normTxt(e) === normTxt(a[id])));
  if (key.choice !== undefined) items.push(st.choice === key.choice);
  return items.length ? round(points * items.filter(Boolean).length / items.length) : 0;
}

/* ---------- patch : brassage ---------- */
export type PatchOptions = { kind: "patch"; plugs: { id: string; label: string; device: string; vlan: number }[]; ports: { n: number; vlan: number | "trunk" }[]; vlans: { id: number; name: string; color: string }[] };
function gradePatch(o: PatchOptions, st: any, points: number) {
  const links: Record<string, number> = obj(st.links);
  const used = new Map<number, number>();
  for (const p of Object.values(links)) used.set(Number(p), (used.get(Number(p)) || 0) + 1);
  const ok = (o.plugs || []).filter((pl) => {
    const n = Number(links[pl.id]);
    const port = (o.ports || []).find((x) => x.n === n);
    return port && port.vlan === pl.vlan && used.get(n) === 1;
  }).length;
  return o.plugs?.length ? round(points * ok / o.plugs.length) : 0;
}

/* ---------- fwweb : règles façon pfSense, testées sur des paquets cachés ---------- */
export type FwWebRule = { action: "pass" | "block"; proto: "any" | "tcp" | "udp"; src: string; port: string; descr?: string };
export function rulesToProgram(rules: FwWebRule[]): FwProgram {
  const conds = (r: FwWebRule): FwCond | null => {
    const parts: FwCond[] = [];
    if (r.proto && r.proto !== "any") parts.push({ field: "protocol", op: "eq", value: r.proto });
    const src = String(r.src || "any").trim();
    if (src && src.toLowerCase() !== "any") parts.push({ field: "src_ip", op: "in_cidr", value: src });
    const port = String(r.port || "any").trim();
    if (port && port.toLowerCase() !== "any") parts.push({ field: "dst_port", op: "in_list", value: port });
    if (!parts.length) return null;
    return parts.reduce((a, b) => ({ and: [a, b] }));
  };
  return {
    default: "block",
    rules: (rules || []).slice(0, 30).map((r) => {
      const c = conds(r);
      return { cond: c ?? { not: { field: "protocol", op: "eq", value: "__jamais__" } }, action: r.action === "pass" ? "allow" : "block" };
    }),
  };
}
function gradeFwWeb(key: { packets: FwPacket[] }, st: any, points: number) {
  const rules: FwWebRule[] = Array.isArray(st.rules) ? st.rules.filter((r: any) => r && typeof r === "object") : [];
  return gradeFirewall(rulesToProgram(rules), key?.packets || [], points).score;
}

export function gradeSim(o: any, key: any, resp: any, points: number): number {
  const st = obj(resp?.state);
  switch (o?.kind as SimKind) {
    case "privacy": return gradePrivacy(key || {}, st, points);
    case "osint": case "pcap": return gradeFields(key || {}, st, points);
    case "patch": return gradePatch(o, st, points);
    case "fwweb": return gradeFwWeb(key || {}, st, points);
  }
  return 0;
}

export function validSim(o: any, key: any): string | null {
  if (!o || !SIM_KINDS.some(([k]) => k === o.kind)) return "kind inconnu (privacy, osint, patch, fwweb ou pcap)";
  if (o.kind === "privacy" && !key?.settings) return "Corrigé : settings attendu";
  if ((o.kind === "osint" || o.kind === "pcap") && (!key?.answers || !Object.keys(key.answers).length)) return "Corrigé : answers attendu";
  if (o.kind === "patch" && (!Array.isArray(o.plugs) || !Array.isArray(o.ports) || !o.plugs.length)) return "plugs et ports attendus";
  if (o.kind === "fwweb" && (!Array.isArray(key?.packets) || !key.packets.length)) return "Corrigé : packets attendu";
  if (o.kind === "pcap" && (!Array.isArray(o.packets) || !o.packets.length)) return "packets attendu";
  return null;
}
