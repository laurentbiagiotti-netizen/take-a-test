"use client";
import { useEffect, useState } from "react";
import Terminal, { type Objective } from "@/components/Terminal";
import QuestionBody, { type PublicQ } from "@/components/questions/QuestionBody";
import QuestionPrompt from "@/components/questions/QuestionPrompt";
import { ANOMALY_LABEL, startCameraMonitor, type CameraAnomaly, type CameraStatus } from "@/lib/proctor/camera-monitor";
import { faceReady, formatClock, fullscreenSupported, useAutoCamera } from "@/lib/exam/client";

/**
 * Épreuve d'essai publique : vérifie le poste (caméra avec détection de
 * visage, plein écran, écran unique, Safe Exam Browser), puis propose une
 * mini-épreuve question par question, en plein écran, caméra analysée.
 * Rien n'est enregistré.
 */
type Check = { id: string; label: string; state: "todo" | "ok" | "ko" | "info"; detail?: string };

/** Accès au serveur de la démo ; remplaçable (version GitHub Pages, sans serveur). */
export type DemoApi = {
  run: (command: string) => Promise<{ ok: boolean; data: any }>;
  grade: (answers: Record<string, any>, flag: string) => Promise<any>;
};

const serverApi: DemoApi = {
  run: async (command) => {
    const r = await fetch("/api/demo/terminal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command }) });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  },
  grade: async (answers, flag) => {
    const r = await fetch("/api/demo/grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, flag }) });
    return r.json();
  },
};

const HINT: Record<string, string> = {
  mcq_single: "QCM", mcq_multi: "QCM", ordering: "Remettre dans l'ordre", matching: "Associer",
  hotspot: "Repérer", short_answer: "Analyse de données", long_text: "Réponse rédigée",
};

export default function DemoExam({ questions, terminal, api = serverApi, staticSite = false, logoSrc = "/cybersup-logo-blanc.svg", modelUrl = "/models" }: {
  questions: PublicQ[];
  terminal: { prompt: string; motd: string | null; objectives: Objective[] };
  api?: DemoApi;
  staticSite?: boolean;
  logoSrc?: string;
  modelUrl?: string;
}) {
  const [checks, setChecks] = useState<Check[]>([
    { id: "camera", label: "Caméra et visage", state: "todo" },
    { id: "fullscreen", label: "Plein écran", state: "todo" },
    { id: "screens", label: "Un seul écran", state: "todo" },
    { id: "seb", label: "Safe Exam Browser", state: "todo" },
  ]);
  const [stage, setStage] = useState<"checks" | "exam" | "done">("checks");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flag, setFlag] = useState("");
  const [objectives, setObjectives] = useState<Objective[]>(terminal.objectives);
  const [result, setResult] = useState<{ results: { id: string; score: number; points: number }[]; flag: boolean } | null>(null);
  const [left, setLeft] = useState(25 * 60);
  const [cam, setCam] = useState<CameraStatus | null>(null);
  const [confirmNext, setConfirmNext] = useState(false);
  const [camAlerts, setCamAlerts] = useState<string[]>([]);
  const [anomalies, setAnomalies] = useState<{ kind: CameraAnomaly; at: string }[]>([]);
  const [isFull, setIsFull] = useState(true);
  const [fullExits, setFullExits] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [canFull, setCanFull] = useState(true);
  const camera = useAutoCamera(() => {
    setCam(null);
    setCamAlerts((a) => [...a, `${new Date().toLocaleTimeString("fr-FR")} · caméra coupée`]);
  });
  const camOn = camera.state === "live", camDenied = camera.state === "denied";
  const inSeb = typeof navigator !== "undefined" && /SEB\//.test(navigator.userAgent);
  const total = questions.length + 1;

  const set = (id: string, state: Check["state"], detail?: string) =>
    setChecks((c) => c.map((x) => x.id === id ? { ...x, state, detail } : x));

  useEffect(() => {
    const extended = (window.screen as any).isExtended;
    set("screens", extended === true ? "ko" : extended === false ? "ok" : "info",
      extended === true ? "Écran secondaire détecté : débranchez-le le jour de l'épreuve." : extended === false ? undefined : "Non vérifiable avec ce navigateur.");
    set("seb", inSeb ? "ok" : "info", inSeb ? "Safe Exam Browser détecté." : "Navigateur classique : certains examens exigent Safe Exam Browser (fichier .seb fourni par l'école).");
    const fs = inSeb || fullscreenSupported();
    setCanFull(fs);
    set("fullscreen", fs ? "info" : "ko", inSeb ? "Géré par Safe Exam Browser." : fs ? "Obligatoire : il s'active au démarrage, l'épreuve ne commence pas sans lui."
      : "Ce navigateur ne permet pas le plein écran (téléphone ou tablette) : passez l'épreuve sur un ordinateur.");
  }, []);

  useEffect(() => {
    if (camera.state === "pending") set("camera", "info", "Ouverture de la caméra : autorisez l'accès quand le navigateur le demande.");
    else if (camera.state === "denied") set("camera", "ko", "Caméra refusée ou coupée : autorisez-la (icône dans la barre d'adresse) puis réessayez, ou commencez sans, ce sera signalé.");
    else set("camera", "info", "Caméra active : analyse du visage en cours…");
  }, [camera.state]);

  // Chrono d'essai
  useEffect(() => {
    if (stage !== "exam") return;
    const i = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(i);
  }, [stage]);

  // Analyse caméra en continu
  useEffect(() => {
    if (!camOn || !camera.videoRef.current) return;
    return startCameraMonitor({
      video: camera.videoRef.current, modelUrl,
      onStatus: (s) => {
        setCam(s);
        if (stage === "checks" && s.faces !== null) {
          set("camera", s.faces === 1 ? "ok" : "ko",
            s.faces === 1 ? "Un visage détecté : parfait." : s.faces === 0 ? "Aucun visage détecté : placez-vous face à la caméra, bien éclairé." : `${s.faces} visages détectés : vous devez être seul(e) dans le champ.`);
        }
      },
      onAnomaly: (kind) => {
        if (stage !== "exam") return;
        setAnomalies((a) => [...a, { kind, at: new Date().toLocaleTimeString("fr-FR") }]);
        setBanner(`Anomalie caméra : ${ANOMALY_LABEL[kind]}. Dans un vrai examen, le surveillant en est informé avec une photo.`);
      },
    });
  }, [camOn, stage, modelUrl, camera.videoRef]);

  // Plein écran : épreuve masquée tant que le candidat n'y est pas
  // Tout clic ou touche hors plein écran le redemande
  useEffect(() => {
    if (stage !== "exam" || inSeb) return;
    const onFs = () => {
      const full = !!document.fullscreenElement;
      setIsFull(full);
      if (!full) setFullExits((n) => n + 1);
    };
    const refull = () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().then(() => setIsFull(true)).catch(() => {});
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("pointerdown", refull, true);
    document.addEventListener("keydown", refull, true);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("pointerdown", refull, true);
      document.removeEventListener("keydown", refull, true);
    };
  }, [stage]);

  const goFull = async () => {
    if (inSeb) return true;
    try { await document.documentElement.requestFullscreen(); setIsFull(true); return true; }
    catch { setBanner("Le navigateur a refusé le plein écran : cliquez à nouveau."); return false; }
  };

  const faceOk = faceReady(camOn, cam);

  const begin = async () => {
    setBanner(null);
    if (!canFull) { setBanner("Ce navigateur ne permet pas le plein écran : passez l'épreuve sur un ordinateur."); return; }
    if (!faceOk && !camDenied) { setBanner("Patientez : la caméra doit détecter un seul visage avant de commencer."); return; }
    if (!(await goFull()) || (!inSeb && !document.fullscreenElement)) {
      setBanner("Le plein écran est obligatoire : l'épreuve ne peut pas commencer sans lui.");
      return;
    }
    setStage("exam"); setStep(0); window.scrollTo({ top: 0 });
    if (camDenied) {
      setCamAlerts((a) => [...a, `${new Date().toLocaleTimeString("fr-FR")} · caméra refusée`]);
      setBanner("Caméra non autorisée : l'épreuve continue. Dans un vrai examen, c'est signalé au surveillant.");
    } else setBanner(null);
  };

  const validate = () => {
    setConfirmNext(false);
    if (step < total - 1) { setStep((s) => s + 1); window.scrollTo({ top: 0 }); }
    else finish();
  };

  const run = async (command: string) => {
    const { ok, data: j } = await api.run(command);
    if (j.objectives) setObjectives(j.objectives);
    return ok ? j : { error: j.output || "Commande refusée." };
  };

  const finish = async () => {
    setResult(await api.grade(answers, flag));
    setStage("done");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    window.scrollTo({ top: 0 });
  };

  const termDone = objectives.filter((o) => o.done).length;
  const score = result ? result.results.reduce((s, r) => s + r.score, 0) + termDone + (result.flag ? 1 : 0) : 0;
  const totalPts = result ? result.results.reduce((s, r) => s + r.points, 0) + objectives.length + 1 : 0;
  const q = step > 0 ? questions[step - 1] : null;

  const Badge = ({ s }: { s: Check["state"] }) => (
    <span className={`badge ${s === "ok" ? "badge-ok" : s === "ko" ? "badge-danger" : s === "info" ? "badge-warn" : "badge-muted"}`}>
      {s === "ok" ? "OK" : s === "ko" ? "Problème" : s === "info" ? "À noter" : "À tester"}
    </span>
  );

  const camLabel = cam?.anomaly ? ANOMALY_LABEL[cam.anomaly] : cam?.faces === 1 ? "visage OK" : cam?.faces === 0 ? "aucun visage" : (cam?.faces ?? 0) > 1 ? `${cam?.faces} visages` : "analyse…";
  const camBad = !!cam?.anomaly || (cam?.faces !== null && cam?.faces !== undefined && cam.faces !== 1);

  return (
    <div className="min-h-screen relative">
      {stage === "exam" && !isFull && !inSeb && (
        <div className="fixed inset-0 z-[60] bg-bg flex items-center justify-center p-6">
          <div className="card max-w-md text-center">
            <h2 className="h1 text-danger">Plein écran obligatoire</h2>
            <p className="text-muted mt-3">Vous avez quitté le plein écran. Dans un vrai examen, c&apos;est une infraction et l&apos;épreuve reste masquée tant que vous n&apos;y revenez pas.</p>
            <button className="btn mt-6" onClick={goFull} autoFocus>Revenir en plein écran</button>
          </div>
        </div>
      )}
      {stage === "exam" && !camOn && (
        <div className="bg-warn/15 border-b border-warn/40 text-warn text-center py-2 text-sm px-4">
          Caméra désactivée : signalé au surveillant dans un vrai examen. <button className="underline ml-2" onClick={camera.open}>Réactiver la caméra</button>
        </div>
      )}

      <header className="border-b border-line">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href={staticSite ? "https://cybersup.ai" : "/"} className="py-5"><img src={logoSrc} alt="Cybersup" className="h-6 w-auto" /></a>
          <div className="flex items-center gap-4 text-sm">
            <span className="badge-warn">Épreuve d&apos;essai</span>
            {stage === "exam" && camOn && (
              <div className="relative">
                <video ref={camera.attach} className={`w-24 h-14 rounded bg-black object-cover border ${camBad ? "border-danger" : "border-line"}`} muted playsInline />
                <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] px-1.5 rounded ${camBad ? "bg-danger text-white" : "bg-ok text-bg"}`}>{camLabel}</span>
              </div>
            )}
            {stage === "exam" && <span className="font-mono text-lg">{formatClock(left)}</span>}
          </div>
        </div>
        {stage === "exam" && <div className="h-1 bg-surface-2"><div className="h-full bg-accent transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} /></div>}
      </header>
      {banner && stage === "exam" && (
        <div className="bg-danger/15 border-b border-danger/40 text-danger text-center py-2 text-sm px-4">
          {banner} <button className="underline ml-2" onClick={() => setBanner(null)}>fermer</button>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {stage === "checks" && (
          <>
            <div>
              <h1 className="h1"><span className="text-accent">Démo</span> de l&apos;épreuve</h1>
              <p className="text-muted mt-2 max-w-2xl">Vérifiez votre poste puis entraînez-vous, question par question : une mission sur un serveur Linux compromis, un QCM, une remise en ordre, une association, un mail de phishing, du code vulnérable et une analyse de données. Rien n&apos;est enregistré.</p>
              {staticSite && <p className="text-xs text-faint mt-2 max-w-2xl">Version de démonstration publiée sur GitHub Pages : tout s&apos;exécute dans votre navigateur. Dans la vraie plateforme, la machine, les réponses et la correction restent sur le serveur.</p>}
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
                      {c.id === "camera" && camDenied && <button className="btn-secondary !py-1 text-xs" onClick={camera.open}>Réessayer</button>}
                      <Badge s={c.state} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="flex items-center justify-between">
                  <div className="h2">Aperçu caméra</div>
                  {camOn && <span className={`badge ${camBad ? "badge-danger" : cam?.faces === 1 ? "badge-ok" : "badge-muted"}`}>{camLabel}</span>}
                </div>
                <video ref={stage === "checks" ? camera.attach : undefined} className="mt-3 w-full aspect-video rounded-md bg-[#05070d] border border-line object-cover" muted playsInline />
                <p className="text-xs text-muted mt-2">Pendant l&apos;épreuve, la caméra est analysée en continu : absence de visage, plusieurs personnes, caméra masquée ou image figée sont signalées.</p>
              </div>
            </section>
            <div className="card text-sm text-muted space-y-1">
              <div className="h2 text-fg mb-2">Le jour de l&apos;épreuve</div>
              <p>Plein écran obligatoire : l&apos;épreuve ne démarre pas sans lui et reste masquée si vous en sortez. Caméra ouverte automatiquement et analysée en continu ; la refuser ou la couper n&apos;arrête pas l&apos;épreuve mais c&apos;est signalé au surveillant. Un seul écran. Copier, coller et changer de fenêtre sont bloqués et comptés comme infractions.</p>
              <p>Une question à la fois, sans retour en arrière : une réponse validée est définitive. Le chrono est tenu par le serveur : fermer la page ne l&apos;arrête pas. Un seul appareil à la fois.</p>
            </div>
            {banner && <p className="text-danger text-sm">{banner}</p>}
            <div className="flex items-center gap-4">
              <button className="btn" onClick={begin} disabled={!canFull || (!faceOk && !camDenied)}>2. Commencer l&apos;épreuve d&apos;essai (plein écran)</button>
              {!faceOk && !camDenied && <span className="text-xs text-muted">Disponible dès que la caméra détecte votre visage.</span>}
              {camDenied && <span className="text-xs text-warn">Sans caméra, vous pouvez commencer, mais ce sera signalé au surveillant.</span>}
            </div>
          </>
        )}

        {stage === "exam" && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Question <b className="text-fg">{step + 1}</b> / {total}</span>
              <span className="text-xs text-muted">Question par question : pas de retour en arrière.</span>
            </div>

            {step === 0 ? (
              <section className="space-y-4">
                <div className="text-xs text-muted">Défi terminal · {objectives.length} missions + 1 bonus</div>
                <h2 className="h2">Mission : serveur compromis</h2>
                <p className="text-sm text-muted max-w-3xl">Une vraie machine (simulée) : lisez <code className="text-fg">~/MISSION.txt</code>, enquêtez et réparez. Les missions se cochent toutes seules quand l&apos;état de la machine est correct. Tapez <code className="text-fg">help</code> pour les commandes.</p>
                <Terminal run={run} initialPrompt={terminal.prompt} motd={terminal.motd} initialObjectives={objectives} height={360} />
                <label className="block text-sm text-muted max-w-md">Bonus : flag caché sur la machine
                  <input className="input mt-1 font-mono" placeholder="CYBER{...}" value={flag} maxLength={200} onChange={(e) => setFlag(e.target.value)} />
                </label>
              </section>
            ) : q && (
              <section className="card">
                <div className="text-xs text-muted">{HINT[q.type]} · {q.points} pt{q.points > 1 ? "s" : ""}</div>
                <div className="mt-1"><QuestionPrompt prompt={q.prompt} className="text-lg font-medium" /></div>
                <div className="mt-4">
                  <QuestionBody q={q} value={answers[q.id]} onChange={(r) => setAnswers((a) => ({ ...a, [q.id]: r }))} />
                </div>
              </section>
            )}

            <div className="flex justify-end items-center gap-2">
              {confirmNext ? <>
                <span className="text-sm text-danger">{step < total - 1 ? "Valider ? Vous ne pourrez plus revenir sur cette question." : "Rendre la copie définitivement ?"}</span>
                <button className="btn-secondary" onClick={() => setConfirmNext(false)}>Annuler</button>
                <button className="btn" onClick={validate}>Confirmer</button>
              </> : step < total - 1
                ? <button className="btn" onClick={() => setConfirmNext(true)}>Valider et continuer →</button>
                : <button className="btn" onClick={() => setConfirmNext(true)}>Valider et voir mon score</button>}
            </div>
          </>
        )}

        {stage === "done" && result && (
          <section className="space-y-4">
            <div className="card">
              <h1 className="h1">Essai terminé</h1>
              <div className="font-display text-5xl text-accent mt-4">{Math.round(score * 100) / 100}<span className="text-faint text-2xl"> / {totalPts}</span></div>
              <p className="text-muted mt-3">Le vrai examen fonctionne de la même façon, avec le chrono tenu par le serveur et un surveillant qui voit les anomalies.</p>
            </div>
            <div className="card text-sm space-y-2">
              <div className="flex justify-between"><span>Missions terminal</span><span className={termDone === objectives.length ? "text-ok" : "text-warn"}>{termDone} / {objectives.length}</span></div>
              <div className="flex justify-between"><span>Flag bonus</span><span className={result.flag ? "text-ok" : "text-danger"}>{result.flag ? "trouvé" : "non trouvé"}</span></div>
              {result.results.map((r) => {
                const qq = questions.find((x) => x.id === r.id)!;
                return (
                  <div key={r.id} className="flex justify-between border-t border-line pt-2">
                    <span className="truncate pr-4">{qq.prompt}</span>
                    <span className={r.score === r.points ? "text-ok" : r.score > 0 ? "text-warn" : "text-danger"}>{r.score} / {r.points}</span>
                  </div>
                );
              })}
            </div>
            <div className="card text-sm space-y-1">
              <div className="h2 mb-2">Ce que le surveillant aurait vu</div>
              <div className="flex justify-between"><span>Sorties du plein écran</span><span className={fullExits ? "text-danger" : "text-ok"}>{fullExits}</span></div>
              <div className="flex justify-between"><span>Anomalies caméra</span><span className={anomalies.length + camAlerts.length ? "text-danger" : "text-ok"}>{anomalies.length + camAlerts.length}</span></div>
              {camAlerts.map((a, i) => <div key={"c" + i} className="text-xs text-muted">{a}</div>)}
              {anomalies.map((a, i) => <div key={i} className="text-xs text-muted">{a.at} · {ANOMALY_LABEL[a.kind]}</div>)}
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => window.location.reload()}>Recommencer l&apos;essai</button>
              {!staticSite && <a className="btn" href="/login">Accéder à mes examens</a>}
            </div>
          </section>
        )}
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-faint">Cybersup, l&apos;école qui protège votre avenir</footer>
    </div>
  );
}
