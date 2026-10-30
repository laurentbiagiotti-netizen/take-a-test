"use client";
import { useEffect, useRef, useState } from "react";
import Terminal, { type Objective } from "@/components/Terminal";
import QuestionBody, { type PublicQ } from "@/components/questions/QuestionBody";

/**
 * Épreuve d'essai publique : vérifie le poste du candidat (caméra, plein
 * écran, écran unique, Safe Exam Browser) puis propose une mini-épreuve
 * avec QCM et défis en terminal Linux. Rien n'est enregistré.
 */
type Check = { id: string; label: string; state: "todo" | "ok" | "ko" | "info"; detail?: string };

export default function DemoExam({ questions, terminal }: {
  questions: PublicQ[];
  terminal: { prompt: string; motd: string | null; objectives: Objective[] };
}) {
  const [checks, setChecks] = useState<Check[]>([
    { id: "camera", label: "Caméra", state: "todo" },
    { id: "fullscreen", label: "Plein écran", state: "todo" },
    { id: "screens", label: "Un seul écran", state: "todo" },
    { id: "seb", label: "Safe Exam Browser", state: "todo" },
  ]);
  const [stage, setStage] = useState<"checks" | "exam" | "done">("checks");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flag, setFlag] = useState("");
  const [objectives, setObjectives] = useState<Objective[]>(terminal.objectives);
  const [result, setResult] = useState<{ results: { id: string; score: number; points: number }[]; flag: boolean } | null>(null);
  const [left, setLeft] = useState(25 * 60);
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

  const run = async (command: string) => {
    const r = await fetch("/api/demo/terminal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command }) });
    const j = await r.json().catch(() => ({}));
    if (j.objectives) setObjectives(j.objectives);
    return r.ok ? j : { error: j.output || "Commande refusée." };
  };

  const finish = async () => {
    const r = await fetch("/api/demo/grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, flag }) });
    setResult(await r.json());
    setStage("done");
    window.scrollTo({ top: 0 });
  };

  const termDone = objectives.filter((o) => o.done).length;
  const score = result ? result.results.reduce((s, r) => s + r.score, 0) + termDone + (result.flag ? 1 : 0) : 0;
  const total = result ? result.results.reduce((s, r) => s + r.points, 0) + objectives.length + 1 : 0;
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
              <p className="text-muted mt-2 max-w-2xl">Vérifiez votre poste puis entraînez-vous : une mission sur un serveur Linux compromis, un QCM, une remise en ordre, une association, un mail de phishing, du code vulnérable et une analyse de données. Rien n&apos;est enregistré.</p>
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
              <h2 className="h2">Mission terminal : serveur compromis</h2>
              <p className="text-sm text-muted max-w-3xl">Une vraie machine (simulée) : lisez <code className="text-fg">~/MISSION.txt</code>, enquêtez et réparez. Les missions se cochent toutes seules quand l&apos;état de la machine est correct. Tapez <code className="text-fg">help</code> pour les commandes.</p>
              <Terminal run={run} initialPrompt={terminal.prompt} motd={terminal.motd} initialObjectives={terminal.objectives} height={380} />
              <label className="block text-sm text-muted max-w-md">Bonus : flag caché sur la machine
                <input className="input mt-1 font-mono" placeholder="CYBER{...}" value={flag} maxLength={200} onChange={(e) => setFlag(e.target.value)} />
              </label>
            </section>

            {questions.map((q, i) => (
              <section key={q.id} className="card">
                <div className="text-xs text-muted">Question {i + 1} · {HINT[q.type]} · {q.points} pt{q.points > 1 ? "s" : ""}</div>
                <div className="font-medium mt-1 whitespace-pre-wrap">{q.prompt}</div>
                <div className="mt-4">
                  <QuestionBody q={q} value={answers[q.id]} onChange={(r) => setAnswers((a) => ({ ...a, [q.id]: r }))} />
                </div>
              </section>
            ))}
            <button className="btn" onClick={finish}>Terminer et voir mon score</button>
          </>
        )}

        {stage === "done" && result && (
          <section className="space-y-4">
            <div className="card">
              <h1 className="h1">Essai terminé</h1>
              <div className="font-display text-5xl text-accent mt-4">{Math.round(score * 100) / 100}<span className="text-faint text-2xl"> / {total}</span></div>
              <p className="text-muted mt-3">Le vrai examen fonctionne de la même façon, avec en plus la caméra, le plein écran verrouillé et le chrono tenu par le serveur.</p>
            </div>
            <div className="card text-sm space-y-2">
              <div className="flex justify-between"><span>Missions terminal</span><span className={termDone === objectives.length ? "text-ok" : "text-warn"}>{termDone} / {objectives.length}</span></div>
              <div className="flex justify-between"><span>Flag bonus</span><span className={result.flag ? "text-ok" : "text-danger"}>{result.flag ? "trouvé" : "non trouvé"}</span></div>
              {result.results.map((r) => {
                const q = questions.find((x) => x.id === r.id)!;
                return (
                  <div key={r.id} className="flex justify-between border-t border-line pt-2">
                    <span className="truncate pr-4">{q.prompt}</span>
                    <span className={r.score === r.points ? "text-ok" : r.score > 0 ? "text-warn" : "text-danger"}>{r.score} / {r.points}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => { setStage("exam"); setResult(null); setLeft(25 * 60); }}>Revenir à l&apos;épreuve</button>
              <a className="btn" href="/login">Accéder à mes examens</a>
            </div>
          </section>
        )}
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-faint">Cybersup, l&apos;école qui protège votre avenir</footer>
    </div>
  );
}

const HINT: Record<string, string> = {
  mcq_single: "QCM", mcq_multi: "QCM", ordering: "Remettre dans l'ordre", matching: "Associer",
  hotspot: "Repérer", short_answer: "Analyse de données", long_text: "Réponse rédigée",
};
