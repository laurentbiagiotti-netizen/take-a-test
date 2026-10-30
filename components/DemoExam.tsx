"use client";
import { useEffect, useRef, useState } from "react";
import Terminal from "@/components/Terminal";

/**
 * Épreuve d'essai publique : vérifie le poste du candidat (caméra, plein
 * écran, écran unique, Safe Exam Browser) puis propose une mini-épreuve
 * avec QCM et défis en terminal Linux. Rien n'est enregistré.
 */
type Check = { id: string; label: string; state: "todo" | "ok" | "ko" | "info"; detail?: string };

const QCM = [
  { id: "q1", prompt: "Quelle commande affiche aussi les fichiers cachés d'un dossier ?", options: ["ls -l", "ls -a", "ls -h", "ls -r"], good: 1 },
  { id: "q2", prompt: "Que fait la commande « grep » ?", options: ["Elle compresse un fichier", "Elle cherche un motif dans du texte", "Elle change les droits d'un fichier", "Elle affiche l'espace disque"], good: 1 },
  { id: "q3", prompt: "Le base64 est-il un chiffrement ?", options: ["Oui, il protège les données", "Non, c'est un simple encodage réversible"], good: 1 },
];

export default function DemoExam({ challenges, terminal }: {
  challenges: { id: string; title: string; hint: string }[];
  terminal: { cwd: string; prompt: string; motd: string | null };
}) {
  const [checks, setChecks] = useState<Check[]>([
    { id: "camera", label: "Caméra", state: "todo" },
    { id: "fullscreen", label: "Plein écran", state: "todo" },
    { id: "screens", label: "Un seul écran", state: "todo" },
    { id: "seb", label: "Safe Exam Browser", state: "todo" },
  ]);
  const [stage, setStage] = useState<"checks" | "exam" | "done">("checks");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flags, setFlags] = useState<Record<string, string>>({});
  const [found, setFound] = useState<Record<string, boolean | null>>({});
  const [left, setLeft] = useState(15 * 60);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const set = (id: string, state: Check["state"], detail?: string) =>
    setChecks((c) => c.map((x) => x.id === id ? { ...x, state, detail } : x));

  useEffect(() => {
    const extended = (window.screen as any).isExtended;
    set("screens", extended === true ? "ko" : extended === false ? "ok" : "info",
      extended === true ? "Écran secondaire détecté : débranchez-le le jour de l'épreuve." : extended === false ? undefined : "Non vérifiable avec ce navigateur.");
    const seb = /SEB\//.test(navigator.userAgent);
    set("seb", seb ? "ok" : "info", seb ? "Safe Exam Browser détecté." : "Navigateur classique : certains examens exigent Safe Exam Browser (fichier .seb fourni par l'école).");
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (stage !== "exam") return;
    const i = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(i);
  }, [stage]);

  const testCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => {}); }
      set("camera", "ok", "Image reçue : vérifiez que votre visage est bien éclairé.");
    } catch { set("camera", "ko", "Accès refusé ou caméra absente. Autorisez la caméra dans votre navigateur."); }
  };

  const testFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      set("fullscreen", "ok", "Plein écran disponible.");
      setTimeout(() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }, 1500);
    } catch { set("fullscreen", "ko", "Le plein écran est bloqué par ce navigateur."); }
  };

  const checkFlag = async (id: string) => {
    const r = await fetch("/api/demo/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge: id, flag: flags[id] || "" }) });
    const j = await r.json().catch(() => ({}));
    setFound((f) => ({ ...f, [id]: !!j.ok }));
  };

  const run = async (command: string, cwd: string) => {
    const r = await fetch("/api/demo/terminal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command, cwd }) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { error: j.output || "Commande refusée." };
  };

  const score = QCM.filter((q) => answers[q.id] === q.good).length + Object.values(found).filter(Boolean).length;
  const total = QCM.length + challenges.length;
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");

  const Icon = ({ s }: { s: Check["state"] }) => (
    <span className={`badge ${s === "ok" ? "badge-ok" : s === "ko" ? "badge-danger" : s === "info" ? "badge-warn" : "badge-muted"}`}>
      {s === "ok" ? "OK" : s === "ko" ? "Problème" : s === "info" ? "À noter" : "À tester"}
    </span>
  );

  return (
    <div className="min-h-screen relative">
      <header className="border-b border-line">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="py-5"><img src="/cybersup-logo-blanc.svg" alt="Cybersup" className="h-6 w-auto" /></a>
          <div className="flex items-center gap-4 text-sm">
            <span className="badge-warn">Épreuve d&apos;essai</span>
            {stage === "exam" && <span className="font-mono text-lg">{mm}:{ss}</span>}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {stage === "checks" && (
          <>
            <div>
              <h1 className="h1"><span className="text-accent">Démo</span> de l&apos;épreuve</h1>
              <p className="text-muted mt-2 max-w-2xl">Vérifiez votre poste puis entraînez-vous sur une mini-épreuve : QCM et défis en terminal Linux. Rien n&apos;est enregistré.</p>
            </div>
            <section className="grid md:grid-cols-2 gap-4">
              <div className="card space-y-3">
                <div className="h2">1. Vérification du poste</div>
                {checks.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-3 border-t border-line pt-3 first:border-0 first:pt-0">
                    <div>
                      <div className="text-sm font-medium">{c.label}</div>
                      {c.detail && <div className="text-xs text-muted mt-0.5">{c.detail}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.id === "camera" && <button className="btn-secondary !py-1 text-xs" onClick={testCamera}>Tester</button>}
                      {c.id === "fullscreen" && <button className="btn-secondary !py-1 text-xs" onClick={testFullscreen}>Tester</button>}
                      <Icon s={c.state} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="h2">Aperçu caméra</div>
                <video ref={videoRef} className="mt-3 w-full aspect-video rounded-md bg-[#05070d] border border-line object-cover" muted playsInline />
              </div>
            </section>
            <div className="card text-sm text-muted space-y-1">
              <div className="h2 text-fg mb-2">Le jour de l&apos;épreuve</div>
              <p>Plein écran obligatoire, caméra allumée, un seul écran. Copier, coller et changer de fenêtre sont bloqués et comptés comme infractions.</p>
              <p>Le chrono est tenu par le serveur : fermer la page ne l&apos;arrête pas. Un seul appareil à la fois.</p>
            </div>
            <button className="btn" onClick={() => setStage("exam")}>2. Commencer l&apos;épreuve d&apos;essai</button>
          </>
        )}

        {stage === "exam" && (
          <>
            <section className="space-y-4">
              <h2 className="h2">QCM</h2>
              {QCM.map((q, i) => (
                <div key={q.id} className="card">
                  <div className="text-xs text-muted">Question {i + 1} · une seule réponse</div>
                  <div className="font-medium mt-1">{q.prompt}</div>
                  <div className="mt-3 space-y-2">
                    {q.options.map((o, k) => (
                      <label key={k} className={`flex gap-2 items-center p-2 rounded-md border cursor-pointer ${answers[q.id] === k ? "border-accent bg-surface-2" : "border-line"}`}>
                        <input type="radio" name={q.id} checked={answers[q.id] === k} onChange={() => setAnswers((a) => ({ ...a, [q.id]: k }))} />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-4">
              <h2 className="h2">Défis terminal</h2>
              <p className="text-sm text-muted">Un intrus est passé sur ce serveur. Explorez-le avec les commandes Linux (tapez <code className="text-fg">help</code>) et retrouvez les flags au format <code className="text-fg">CYBER{"{...}"}</code>.</p>
              <Terminal run={run} initialCwd={terminal.cwd} initialPrompt={terminal.prompt} motd={terminal.motd} height={340} />
              <div className="grid md:grid-cols-3 gap-3">
                {challenges.map((c) => (
                  <div key={c.id} className="card space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{c.title}</div>
                      {found[c.id] === true && <span className="badge-ok">Trouvé</span>}
                      {found[c.id] === false && <span className="badge-danger">Raté</span>}
                    </div>
                    <details className="text-xs text-muted"><summary className="cursor-pointer">Indice</summary><p className="mt-1">{c.hint}</p></details>
                    <div className="flex gap-2">
                      <input className="input font-mono text-xs" placeholder="CYBER{...}" value={flags[c.id] || ""} maxLength={200}
                        onChange={(e) => setFlags((f) => ({ ...f, [c.id]: e.target.value }))} disabled={found[c.id] === true} />
                      <button className="btn-secondary !px-3 text-xs" onClick={() => checkFlag(c.id)} disabled={found[c.id] === true}>Valider</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <button className="btn" onClick={() => setStage("done")}>Terminer l&apos;essai</button>
          </>
        )}

        {stage === "done" && (
          <section className="card max-w-xl">
            <h1 className="h1">Essai terminé</h1>
            <div className="font-display text-5xl text-accent mt-4">{score}<span className="text-faint text-2xl"> / {total}</span></div>
            <p className="text-muted mt-3">Le vrai examen fonctionne de la même façon, avec en plus la caméra, le plein écran verrouillé et le chrono serveur.</p>
            <div className="mt-6 flex gap-3">
              <button className="btn-secondary" onClick={() => { setStage("exam"); setLeft(15 * 60); }}>Recommencer</button>
              <a className="btn" href="/login">Accéder à mes examens</a>
            </div>
          </section>
        )}
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-faint">Cybersup, l&apos;école qui protège votre avenir</footer>
    </div>
  );
}
