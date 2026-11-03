import { describe, it, expect } from "vitest";
import { autoScore, runBash } from "../../lib/questions/grade-server";
import { BASH_TEMPLATES, PACKS } from "../../lib/questions/templates";
import { validBash, norm } from "../../lib/questions/bash-task";

describe("scripts Bash", () => {
  for (const [name, t] of Object.entries(BASH_TEMPLATES)) {
    it(`${name} : modèle valide, la référence obtient tous les points`, async () => {
      expect(validBash(t.options, t.correct)).toBeNull();
      expect(await autoScore("bash", t.options, t.correct, { script: t.correct.solution }, 3)).toBe(3);
      expect(await autoScore("bash", t.options, t.correct, { script: "" }, 3)).toBe(0);
    }, 20000);
  }

  it("recopier le résultat à la main ne suffit pas (jeux cachés)", async () => {
    const t = BASH_TEMPLATES.ssh;
    const [ref] = await runBash([{ files: t.options.files, script: t.correct.solution }]);
    const hard = `cat > rapport.txt <<'FIN'\n${ref.files["/home/user/rapport.txt"]}FIN\necho ${ref.stdout.trim()}`;
    expect(await autoScore("bash", t.options, t.correct, { script: hard }, 3)).toBe(1);
  }, 20000);

  it("une autre écriture correcte est acceptée", async () => {
    const t = BASH_TEMPLATES.ssh;
    const alt = "#!/bin/bash\nf=logs/auth.log\ngrep 'Failed' $f | sed -E 's/.*from ([0-9.]+) port.*/\\1/' | sort | uniq -c | sort -nr > rapport.txt\ntotal=$(grep 'Failed' $f | wc -l)\necho $total";
    expect(await autoScore("bash", t.options, t.correct, { script: alt }, 3)).toBe(3);
    const r = BASH_TEMPLATES.rangement;
    const alt2 = "mkdir sauvegarde\nn=0\nfor f in app/config/*.conf; do cp \"$f\" sauvegarde/; n=$((n+1)); done\nfind app/cache -name '*.tmp' -delete\necho $n";
    expect(await autoScore("bash", r.options, r.correct, { script: alt2 }, 3)).toBe(3);
  }, 20000);

  it("une boucle infinie ne bloque pas le serveur", async () => {
    const t0 = Date.now();
    expect(await autoScore("bash", BASH_TEMPLATES.ssh.options, BASH_TEMPLATES.ssh.correct, { script: "while true; do :; done" }, 3)).toBe(0);
    expect(Date.now() - t0).toBeLessThan(8000);
  }, 20000);

  it("normalisation et packs", () => {
    expect(norm("   5 1.2.3.4\r\n\n")).toBe("5 1.2.3.4");
    expect(PACKS.b3.questions.filter((q) => q.type === "bash")).toHaveLength(2);
    expect(PACKS.m1.questions.filter((q) => q.type === "bash")).toHaveLength(1);
  });
});
