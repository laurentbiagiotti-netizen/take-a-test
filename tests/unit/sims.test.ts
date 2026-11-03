import { describe, expect, it } from "vitest";
import { gradeSim, validSim, rulesToProgram } from "@/lib/questions/sim";
import { SIM_TEMPLATES as T } from "@/lib/questions/sim-templates";
import { validateQuestion } from "@/lib/questions/kinds";
import { autoScore } from "@/lib/questions/grade-server";
import { decide } from "@/lib/questions/firewall";

describe("simulations", () => {
  it("modèles valides", () => {
    for (const t of Object.values(T)) { expect(validSim(t.options, t.correct)).toBeNull(); expect(validateQuestion("sim" as any, t.options, t.correct)).toBeNull(); }
  });
  it("appli photo : réglages, bio, suppressions, demandes", async () => {
    const k = T.privacy.correct;
    const good = { settings: { ...k.settings, bio: "Lycéenne à Lille 🎓" }, deleted: k.deleted, requests: k.requests };
    expect(await autoScore("sim", T.privacy.options, k, { state: good }, 4)).toBe(4);
    expect(gradeSim(T.privacy.options, k, { state: {} }, 4)).toBeLessThan(1.5);
    expect(gradeSim(T.privacy.options, k, { state: { ...good, deleted: [...k.deleted, "p4"] } }, 4)).toBeLessThan(4);
    expect(gradeSim(T.privacy.options, k, { state: { ...good, settings: { ...good.settings, bio: "06 12 34 56 78" } } }, 4)).toBeLessThan(4);
  });
  it("question secrète", () => {
    const st = { answers: { animal: " caramel ", ville: "QUIMPER", ecole: "Ecole Jules Ferry" }, choice: "b" };
    expect(gradeSim(T.osint.options, T.osint.correct, { state: st }, 4)).toBe(4);
    expect(gradeSim(T.osint.options, T.osint.correct, { state: { ...st, choice: "c" } }, 4)).toBe(3);
  });
  it("brassage : bon VLAN, un câble par port, pas de trunk", () => {
    const links = { "B101-1": 1, "B101-2": 13, "B102-1": 7, "B102-2": 8, "B103-1": 2, "ACC-1": 17, "ACC-2": 14 };
    expect(gradeSim(T.patch.options, null, { state: { links } }, 4)).toBe(4);
    expect(gradeSim(T.patch.options, null, { state: { links: { ...links, "B102-2": 7 } } }, 4)).toBeCloseTo(4 * 5 / 7, 1);
    expect(gradeSim(T.patch.options, null, { state: { links: { ...links, "ACC-1": 24 } } }, 4)).toBeLessThan(4);
  });
  it("pare-feu web : la règle « tout autoriser » laissée en haut coûte cher", () => {
    const good = [
      { action: "pass", proto: "tcp", src: "any", port: "80,443" }, { action: "pass", proto: "tcp", src: "10.0.99.0/24", port: "22" },
      { action: "pass", proto: "udp", src: "10.0.99.5", port: "161" },
    ];
    expect(gradeSim(T.fwweb.options, T.fwweb.correct, { state: { rules: good } }, 4)).toBe(4);
    expect(gradeSim(T.fwweb.options, T.fwweb.correct, { state: { rules: [...T.fwweb.options.rules, ...good] } }, 4)).toBeLessThan(2.5);
    expect(decide(rulesToProgram(good as any), { id: "x", src_ip: "8.8.8.8", dst_port: 22, protocol: "tcp" })).toBe("block");
  });
  it("capture réseau", () => {
    const st = { answers: { proto: "ftp", serveur: "203.0.113.80", user: "compta.ecole", pass: "Paie#Novembre26", fichier: "paie_novembre_2026.xlsx" }, choice: "b" };
    expect(gradeSim(T.pcap.options, T.pcap.correct, { state: st }, 4)).toBe(4);
    expect(T.pcap.options.packets.some((p: any) => p.info.includes("PASS Paie#Novembre26"))).toBe(true);
  });
});
