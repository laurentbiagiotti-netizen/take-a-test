import { describe, expect, it } from "vitest";
import { evaluateObjectives, initState, runShell, validateScenario, type ShellState } from "@/lib/terminal/shell";
import { DEMO_FLAG, DEMO_SCENARIO } from "@/lib/terminal/demo";

const run = (cmds: string[]) => {
  let st: ShellState = initState(DEMO_SCENARIO);
  const outs: string[] = [];
  for (const c of cmds) { const r = runShell(DEMO_SCENARIO, st, c); st = r.state; outs.push(r.output); }
  return { st, outs };
};

describe("terminal simulé : scénario de démo", () => {
  it("le scénario est valide", () => {
    expect(validateScenario(DEMO_SCENARIO)).toBeNull();
  });
  it("les 4 missions peuvent être réussies", () => {
    const { st } = run([
      "kill 1337", "rm /tmp/.x/update.sh", "mkdir -p ~/rapport",
      "echo 198.51.100.23 > ~/rapport/ip.txt", "chmod 600 ~/.ssh/id_rsa",
    ]);
    expect(evaluateObjectives(DEMO_SCENARIO, st).every((o) => o.done)).toBe(true);
  });
  it("le flag bonus se décode", () => {
    const { outs } = run(["cat /opt/backup/.cache | base64 -d"]);
    expect(outs[0].trim()).toBe(DEMO_FLAG);
  });
  it("les dossiers interdits restent fermés", () => {
    const { outs } = run(["cat /root/notes.txt", "ls /root"]);
    expect(outs[0]).toMatch(/[Pp]ermission/);
    expect(outs[1]).toMatch(/[Pp]ermission/);
  });
  it("une boucle de sed qui gonfle le texte est stoppée sans faire tomber le serveur", () => {
    const big = "sed 's/a/aaaaaaaaaa/g'";
    const { outs } = run(["echo aaaaaaaaaa > /tmp/x", `cat /tmp/x | ${Array(12).fill(big).join(" | ")}`]);
    expect(outs[1].length).toBeLessThan(300_000);
  });
  it("aucune commande réelle : les caractères de contrôle sont filtrés", () => {
    const { outs } = run(["echo \u0007ok"]);
    expect(outs[0]).toBe("ok");
  });
});
