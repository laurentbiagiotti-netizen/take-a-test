import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluateObjectives, initState, runShell, validateScenario, type Scenario, type ShellState } from "@/lib/terminal/shell";

const load = (n: string) => JSON.parse(readFileSync(path.resolve(__dirname, `../../supabase/seed/admission-2026/src/missions/${n}.json`), "utf8")).scenario as Scenario;
const play = (scn: Scenario, cmds: string[]) => {
  let st: ShellState = initState(scn);
  const outs: string[] = [];
  for (const c of cmds) { const r = runShell(scn, st, c); st = r.state; outs.push(r.output); }
  return { st, outs, done: evaluateObjectives(scn, st).filter((o) => o.done).map((o) => o.id) };
};

describe("mission terminal B3", () => {
  const scn = load("b3");
  it("scénario valide", () => expect(validateScenario(scn)).toBeNull());
  it("aucune mission n'est validée au départ", () => expect(play(scn, []).done).toEqual([]));
  it("on trouve le compte attaqué avec les commandes disponibles", () => {
    const { outs } = play(scn, ["grep Failed /var/log/auth.log | cut -d ' ' -f 9 | sort | uniq -c | sort -n"]);
    expect(outs[0].trim().split("\n").pop()).toMatch(/37 svc-backup/);
  });
  it("on repère l'archive la plus lourde", () => {
    const { outs } = play(scn, ["ls -l /var/log/app"]);
    expect(outs[0]).toContain("debug-2026-09.log.old");
  });
  it("les 4 missions sont réalisables", () => {
    const { done } = play(scn, [
      "ps aux", "kill 1450", "rm /var/log/app/debug-2026-09.log.old",
      "chmod 770 /srv/partage/compta", "echo svc-backup > ~/rapport.txt",
    ]);
    expect(done.sort()).toEqual(["acl", "auth", "cpu", "disk"]);
  });
  it("supprimer les journaux du jour ne valide pas la mission disque", () => {
    expect(play(scn, ["rm /var/log/app/app.log"]).done).not.toContain("disk");
  });
});

describe("mission terminal Mastère", () => {
  const scn = load("mastere");
  it("scénario valide", () => expect(validateScenario(scn)).toBeNull());
  it("l'IP et la persistance se trouvent par l'enquête", () => {
    const { outs } = play(scn, ["grep php /var/log/nginx/access.log", "crontab -l"]);
    expect(outs[0]).toContain("203.0.113.77");
    expect(outs[1]).toContain("/var/tmp/.cache/sync.sh");
  });
  it("les 4 missions sont réalisables", () => {
    const { done } = play(scn, [
      "mkdir ~/ioc", "echo 203.0.113.77 > ~/ioc/ip.txt", "rm /var/www/html/uploads/img_4471.php",
      "rm /var/tmp/.cache/sync.sh", "chmod 640 /var/www/html/config.php",
    ]);
    expect(done.sort()).toEqual(["config", "ip", "persist", "webshell"]);
  });
});
