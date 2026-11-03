import { describe, expect, it } from "vitest";
import { evaluateObjectives, initState, runShell, validateScenario, type ShellState } from "@/lib/terminal/shell";
import { MISSIONS } from "@/lib/questions/missions";
import { PACKS } from "@/lib/questions/templates";

const play = (key: string, cmds: string[]) => {
  const m = MISSIONS.find((x) => x.key === key)!;
  let st: ShellState = initState(m.scenario);
  const outs: string[] = [];
  for (const c of cmds) { const r = runShell(m.scenario, st, c); st = r.state; outs.push(r.output); }
  return { done: evaluateObjectives(m.scenario, st), outs };
};
const all = (r: ReturnType<typeof play>) => r.done.filter((o) => !o.done).map((o) => o.id);

describe("missions de terminal", () => {
  it("scénarios valides et présents dans les packs", () => {
    for (const m of MISSIONS) expect(validateScenario(m.scenario), m.key).toBeNull();
    expect([...PACKS.b1.questions, ...PACKS.b1x.questions].filter((q) => q.type === "terminal")).toHaveLength(2);
    expect([...PACKS.b3.questions, ...PACKS.b3x.questions].filter((q) => q.type === "terminal")).toHaveLength(4);
    expect(PACKS.m1.questions.filter((q) => q.type === "terminal")).toHaveLength(1);
    expect([...PACKS.b1.questions, ...PACKS.b3.questions, ...PACKS.m1.questions].some((q) => q.type === "decode")).toBe(false);
  });

  it("B1 rangement : jokers et piège du .pdf.exe", () => {
    const piege = play("rangement", ["mkdir Images", "mkdir Documents", "mv Telechargements/*.pdf* Documents/"]);
    expect(piege.done.find((o) => o.id === "virus")!.done).toBe(false);
    const r = play("rangement", ["cat LISEZMOI.txt", "mkdir Images", "mkdir Documents", "cd Telechargements", "mv *.jpg ../Images/", "mv *.pdf ../Documents/", "rm facture_EDF.pdf.exe", "cd", "echo Camille > fait_par.txt"]);
    expect(all(r)).toEqual([]);
  });

  it("B3 PC lent : tout arrêter n'est pas la solution", () => {
    const trop = play("pc-lent", ["kill 812", "kill 977", "kill 1337"]);
    expect(trop.done.find((o) => o.id === "garder")!.done).toBe(false);
    const r = play("pc-lent", ["ps aux", "kill 1337", "ls -a", "rm .demarrage/lancer_minage.sh", "echo minage_crypto > rapport.txt"]);
    expect(all(r)).toEqual([]);
  });

  it("B3 site en panne", () => {
    const r = play("site-panne", ["cat /var/log/apache2/error.log", "mkdir sauvegardes", "cp /etc/apache2/sites-enabled/ecole.conf sauvegardes/",
      "sudo sed -i 's/DocumentRot/DocumentRoot/' /etc/apache2/sites-enabled/ecole.conf", "sudo chmod 640 /var/www/ecole/config.php", "ss -tlnp", "sudo kill 2231"]);
    expect(all(r)).toEqual([]);
    const sansSudo = play("site-panne", ["kill 2231", "chmod 640 /var/www/ecole/config.php"]);
    expect(sansSudo.outs.join(" ")).toMatch(/non permise|Permission/);
  });

  it("B3 serveur de fichiers", () => {
    const r = play("partage", ["mkdir -p /srv/partage/compta/julie", "cp /srv/modeles/bienvenue.txt /srv/partage/compta/julie/", "chmod 700 /srv/partage/compta/julie",
      "grep -ril \"mot de passe\" /srv/partage", "mkdir quarantaine", "mv /srv/partage/commun/wifi_invites.txt /srv/partage/direction/acces_banque.txt quarantaine/", "rm /srv/partage/temp/*.tmp"]);
    expect(r.outs[3]).toContain("acces_banque.txt");
    expect(all(r)).toEqual([]);
  });

  it("Mastère serveur compromis", () => {
    const r = play("compromis", ["grep -rl system /var/www/html", "mkdir preuves", "sudo mv /var/www/html/uploads/avatar.php preuves/", "sha256sum preuves/avatar.php > preuves/empreintes.txt",
      "grep avatar.php /var/log/apache2/access.log | cut -d ' ' -f 1 | sort -u > preuves/ip_attaquant.txt", "ps aux", "sudo kill 4242", "sudo rm -rf /tmp/.x",
      "sudo sed -i '/pirate@kali/d' /home/deploy/.ssh/authorized_keys"]);
    expect(all(r)).toEqual([]);
    const detruit = play("compromis", ["sudo rm /var/www/html/uploads/avatar.php"]);
    expect(detruit.done.find((o) => o.id === "webshell")!.done).toBe(false);
  });
});

describe("mission services (B3)", () => {
  it("diagnostic, nettoyage, relance, activation", () => {
    const avant = play("sauvegarde", ["sudo systemctl restart sauvegarde-nuit"]);
    expect(avant.outs[0]).toMatch(/failed/);
    const r = play("sauvegarde", ["cat TICKET-2077.txt", "systemctl status sauvegarde-nuit", "journalctl -u sauvegarde-nuit -n 5", "df -h", "sudo du -sh /var/log/*",
      "sudo rm /var/log/ancien/*.gz", "df -h", "sudo systemctl restart sauvegarde-nuit", "systemctl status sauvegarde-nuit", "sudo systemctl enable sauvegarde-nuit"]);
    expect(r.outs[3]).toMatch(/100%|9\d%/);
    expect(r.outs[6]).toMatch(/\s[1-3]\d%\s\/var/);
    expect(r.outs[8]).toMatch(/active \(running\)/);
    expect(all(r)).toEqual([]);
    const brutal = play("sauvegarde", ["sudo rm /var/backups/sauvegarde-2026-10-31.tar.gz", "sudo rm /var/backups/sauvegarde-2026-11-01.tar.gz"]);
    expect(brutal.done.find((o) => o.id === "garder")!.done).toBe(false);
  });
});
