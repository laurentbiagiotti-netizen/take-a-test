"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QuestionBody, { type PublicQ } from "@/components/questions/QuestionBody";
import QuestionPrompt from "@/components/questions/QuestionPrompt";
import { ANOMALY_LABEL, startCameraMonitor, type CameraStatus } from "@/lib/proctor/camera-monitor";
import { EVENT_LABEL, TYPE_HINT, faceReady, formatClock, fullscreenSupported, isAnswered, useAutoCamera, useTimeAlerts } from "@/lib/exam/client";

/**
 * Salle d'examen. Le navigateur ne fait que SIGNALER : chrono, compteur
 * d'infractions, clôture et correction sont décidés par le serveur.
 * Aucune bonne réponse n'est jamais envoyée au navigateur.
 *
 * Règles fixes : une question à la fois sans retour, plein écran obligatoire,
 * caméra ouverte automatiquement (refusée ou coupée : le candidat continue,
 * le surveillant est alerté).
 */

type Q = PublicQ;
type Phase = "prep" | "starting" | "active" | "ended" | "blocked";

const HEARTBEAT_MS = 10_000;
const SNAPSHOT_MS = 20_000;
const VIOLATION_DEBOUNCE_MS = 1500;

export default function ExamRoom(props: {
  testId: string; title: string; description?: string | null; durationMinutes: number;
  maxViolations: number; requireWebcam?: boolean; resuming: boolean; watermark: string; linearHint?: boolean;
}) {
  const { testId, title, description, durationMinutes, maxViolations, resuming, watermark } = props;
  const api = useCallback((p: string) => `/api/exam/${testId}/${p}`, [testId]);

  const lastViolationAt = useRef(0);
  const clockOffset = useRef(0);
  const textTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const phaseRef = useRef<Phase>("prep");
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // SEB verrouille déjà tout l'écran (mode kiosque) : pas d'API plein écran à exiger
  const inSeb = typeof navigator !== "undefined" && /SEB\//.test(navigator.userAgent);
  const [canFull, setCanFull] = useState(true);
  // Jeton de requête tournant : chaque appel renvoie le suivant. Les appels
  // sont sérialisés (file d'attente) pour ne jamais désynchroniser la chaîne.
  const nonceRef = useRef<string | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const [phase, setPhaseState] = useState<Phase>("prep");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [deadline, setDeadline] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const [idx, setIdx] = useState(0);
  const [isFull, setIsFull] = useState(true);
  const [cam, setCam] = useState<CameraStatus | null>(null);
  const [confirming, setConfirming] = useState<"next" | "submit" | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [violations, setViolations] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [endMessage, setEndMessage] = useState<string>("");
  const [saving, setSaving] = useState<"idle" | "saving" | "error">("idle");

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const camera = useAutoCamera();

  useEffect(() => { setCanFull(inSeb || fullscreenSupported()); }, [inSeb]);

  const end = useCallback((status: string) => {
    if (phaseRef.current === "ended") return;
    camera.stop();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setEndMessage(
      status === "terminated" ? "L'épreuve a été interrompue : nombre maximal d'infractions atteint." :
      status === "expired" ? "Le temps est écoulé. Vos réponses enregistrées ont été transmises." :
      "Vos réponses ont été transmises. Vous pouvez fermer cette fenêtre.");
    setPhase("ended");
  }, [camera.stop]);

  const post = useCallback((path: string, body?: unknown, form?: FormData): Promise<{ ok: boolean; data: any }> => {
    const task = async () => {
      const headers: Record<string, string> = {};
      if (!form) headers["Content-Type"] = "application/json";
      if (nonceRef.current) headers["X-Exam-Nonce"] = nonceRef.current;
      let r: Response;
      try {
        r = await fetch(api(path), { method: "POST", credentials: "same-origin", headers, body: form ?? JSON.stringify(body ?? {}) });
      } catch { return { ok: false, data: { message: "Connexion perdue, nouvel essai dans quelques secondes." } }; }
      const next = r.headers.get("X-Exam-Nonce");
      if (next) nonceRef.current = next;
      const j = await r.json().catch(() => ({}));
      if (j?.status && j.status !== "in_progress" && phaseRef.current === "active") end(j.status);
      if (typeof j?.violation_count === "number") setViolations(j.violation_count);
      if (!r.ok && ["session_invalid", "session_killed", "seb_required"].includes(j?.error)) {
        camera.stop();
        setBanner(j.message); setPhase("blocked");
      }
      return { ok: r.ok, data: j };
    };
    const p = queueRef.current.then(task, task);
    queueRef.current = p.catch(() => {});
    return p;
  }, [api, end, camera.stop]);

  const report = useCallback((kind: string, detail?: Record<string, unknown>, isViolation = false) => {
    if (phaseRef.current !== "active") return;
    if (isViolation) {
      const t = Date.now();
      if (t - lastViolationAt.current < VIOLATION_DEBOUNCE_MS) return; // un seul geste = une infraction
      lastViolationAt.current = t;
      setBanner(`Infraction signalée : ${EVENT_LABEL[kind] || kind}. Au bout de ${maxViolations}, l'épreuve s'arrête.`);
    }
    post("event", { kind, detail });
  }, [post, maxViolations]);

  // ---------- Démarrage ----------
  const start = async () => {
    setBanner(null);
    if ((window.screen as any).isExtended === true) {
      setBanner("Plusieurs écrans sont détectés. Débranchez les écrans supplémentaires puis réessayez.");
      return;
    }
    if (!inSeb) {
      try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); }
      catch { /* vérifié juste en dessous */ }
      if (!document.fullscreenElement) { setBanner("Le plein écran est obligatoire : l'épreuve ne peut pas commencer sans lui."); return; }
      setIsFull(true);
    }

    setPhase("starting");
    const { ok, data } = await post("begin");
    if (!ok || data?.status !== "in_progress") {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      if (data?.status && data.status !== "in_progress") { end(data.status); return; }
      setBanner(data?.message || "Impossible de démarrer l'examen.");
      setPhase(data?.error === "session_locked" ? "blocked" : "prep");
      return;
    }
    clockOffset.current = new Date(data.server_now).getTime() - Date.now();
    setDeadline(new Date(data.deadline_at).getTime());
    setQuestions(data.questions || []);
    setIdx(Math.min(data.current_index || 0, Math.max(0, (data.questions || []).length - 1)));
    setAnswers(data.answers || {});
    setViolations(data.violation_count || 0);
    setPhase("active");
    // Caméra refusée : le candidat passe quand même, le surveillant est alerté
    if (!camera.live()) {
      post("event", { kind: "camera_refused" });
      setBanner("Caméra non autorisée : l'épreuve continue, mais c'est signalé au surveillant.");
    }
  };

  // ---------- Caméra ----------
  // Contrôle du visage avant le départ (rien n'est envoyé au serveur)
  useEffect(() => {
    if (phase !== "prep" || camera.state !== "live" || !camera.videoRef.current) return;
    return startCameraMonitor({ video: camera.videoRef.current, onStatus: setCam });
  }, [phase, camera.state, camera.videoRef]);

  // Caméra coupée en cours d'épreuve : signalée, l'épreuve continue
  useEffect(() => {
    if (phase === "active" && camera.state === "denied" && camera.streamRef.current) {
      report("camera_off");
      setBanner("Caméra coupée : l'épreuve continue, mais c'est signalé au surveillant.");
    }
  }, [phase, camera.state, camera.streamRef, report]);

  // ---------- Surveillance ----------
  useEffect(() => {
    if (phase !== "active") return;
    // Plein écran obligatoire : tout clic ou touche hors plein écran le redemande
    const refull = () => {
      if (!inSeb && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => setIsFull(true)).catch(() => {});
      }
    };
    const onFs = () => {
      if (inSeb) return;
      const full = !!document.fullscreenElement;
      setIsFull(full);
      if (!full) report("fullscreen_exit", undefined, true); else report("fullscreen_return");
    };
    const onVis = () => { if (document.hidden) report("tab_hidden", undefined, true); };
    const onBlur = () => report("window_blur", undefined, true);
    const block = (kind: string) => (e: Event) => { e.preventDefault(); report(kind); };
    const onCopy = block("copy_blocked"), onPaste = block("paste_blocked"), onCut = block("cut_blocked");
    const onContext = (e: Event) => e.preventDefault();
    const onPrint = () => report("print_attempt", undefined, true);
    const onLeave = (e: MouseEvent) => { if (!e.relatedTarget) report("mouse_left"); };
    // Recharger ou fermer la page coûte une reprise de session : on prévient
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if ((mod && ["c", "v", "x", "p", "s", "u", "a", "f", "g", "j", "i"].includes(k)) || (mod && e.shiftKey && ["i", "j", "c", "k"].includes(k))
          || k === "f12" || k === "printscreen" || (e.altKey && k === "tab")) {
        e.preventDefault();
        report("shortcut_blocked", { key: (mod ? "mod+" : "") + (e.shiftKey ? "shift+" : "") + k });
      }
    };
    const listeners: [EventTarget, string, any, boolean?][] = [
      [document, "pointerdown", refull, true], [document, "keydown", refull, true],
      [document, "fullscreenchange", onFs], [document, "visibilitychange", onVis], [window, "blur", onBlur],
      [document, "copy", onCopy], [document, "paste", onPaste], [document, "cut", onCut],
      [document, "contextmenu", onContext], [document, "keydown", onKey, true], [window, "beforeprint", onPrint],
      [document.documentElement, "mouseleave", onLeave], [window, "beforeunload", onUnload],
    ];
    listeners.forEach(([t, n, f, c]) => t.addEventListener(n, f, c));

    // Écran secondaire branché en cours d'épreuve, outils de développement
    const probe = setInterval(() => {
      if ((window.screen as any).isExtended === true) report("multiple_screens", undefined, true);
      const dw = window.outerWidth - window.innerWidth, dh = window.outerHeight - window.innerHeight;
      if (document.fullscreenElement && (dw > 200 || dh > 250)) report("devtools_open", { dw, dh }, true);
    }, 5000);

    return () => {
      listeners.forEach(([t, n, f, c]) => t.removeEventListener(n, f, c));
      clearInterval(probe);
    };
  }, [phase, report, inSeb]);

  // Battement de cœur : présence, IP, chrono serveur
  useEffect(() => {
    if (phase !== "active") return;
    const i = setInterval(async () => {
      const { data } = await post("heartbeat");
      if (data?.deadline_at) {
        setDeadline(new Date(data.deadline_at).getTime());
        clockOffset.current = new Date(data.server_now).getTime() - Date.now();
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(i);
  }, [phase, post]);

  const sendFrame = useCallback(async (name: string, quality: number) => {
    const v = camera.videoRef.current; if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = 320; c.height = Math.round(320 * v.videoHeight / v.videoWidth);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/jpeg", quality));
    if (blob) { const fd = new FormData(); fd.append("image", blob, name); await post("snapshot", undefined, fd); }
  }, [camera.videoRef, post]);

  // Captures webcam régulières (déposées par le serveur dans un espace privé)
  useEffect(() => {
    if (phase !== "active") return;
    const i = setInterval(() => { if (camera.live()) sendFrame("snap.jpg", 0.6); }, SNAPSHOT_MS);
    return () => clearInterval(i);
  }, [phase, camera.live, sendFrame]);

  // Analyse caméra : anomalies signalées au serveur avec une photo immédiate
  useEffect(() => {
    const v = camera.videoRef.current;
    if (phase !== "active" || camera.state !== "live" || !v) return;
    return startCameraMonitor({
      video: v,
      onStatus: setCam,
      onAnomaly: async (kind, detail) => {
        if (phaseRef.current !== "active") return;
        setBanner(`Anomalie caméra : ${ANOMALY_LABEL[kind]}. Le surveillant en est informé.`);
        await post("event", { kind, detail });
        await sendFrame("anomalie.jpg", 0.7);
      },
    });
  }, [phase, camera.state, camera.videoRef, post, sendFrame]);

  const goFull = async () => {
    try { await document.documentElement.requestFullscreen(); setIsFull(true); }
    catch { setBanner("Plein écran refusé par le navigateur : cliquez à nouveau."); }
  };

  // Chrono (affichage) ; la vraie limite est appliquée par le serveur
  useEffect(() => {
    if (phase !== "active") return;
    const i = setInterval(async () => {
      const t = Date.now() + clockOffset.current;
      setNow(t);
      if (deadline && t >= deadline + 1000) {
        clearInterval(i);
        const { data } = await post("submit");
        end(data?.status || "expired");
      }
    }, 1000);
    return () => clearInterval(i);
  }, [phase, deadline, post, end]);

  const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
  const timeAlert = useTimeAlerts(remaining, phase === "active" && deadline > 0);

  // Le focus suit la question affichée (lecteurs d'écran, clavier)
  useEffect(() => { if (phase === "active") headingRef.current?.focus(); }, [idx, phase]);

  // ---------- Réponses ----------
  const save = useCallback(async (q: Q, response: any) => {
    setSaving("saving");
    const { ok, data } = await post("answer", { question_id: q.id, response });
    setSaving(ok ? "idle" : "error");
    if (!ok && data?.message) setBanner(data.message);
  }, [post]);

  const setChoice = (q: Q, response: any) => {
    setAnswers((a) => ({ ...a, [q.id]: response }));
    save(q, response);
  };

  // Saisie au clavier : enregistrement différé (texte, réponse courte, flag)
  const setText = (q: Q, response: any) => {
    setAnswers((a) => ({ ...a, [q.id]: response }));
    clearTimeout(textTimers.current[q.id]);
    textTimers.current[q.id] = setTimeout(() => save(q, response), 700);
  };

  const flushPending = async () => {
    await Promise.all(Object.entries(textTimers.current).map(async ([qid, t]) => {
      clearTimeout(t);
      delete textTimers.current[qid];
      const q = questions.find((x) => x.id === qid);
      if (q && answers[qid]) await save(q, answers[qid]);
    }));
  };

  // Navigation linéaire : enregistre la réponse, puis le serveur verrouille la question
  const next = async () => {
    const q = questions[idx]; if (!q) return;
    setConfirming(null);
    setAdvancing(true);
    await flushPending();
    const { ok, data } = await post("next", { from: idx });
    setAdvancing(false);
    if (ok && typeof data.current_index === "number") setIdx(data.current_index);
  };

  const submit = async () => {
    setConfirming(null);
    await flushPending();
    const { data } = await post("submit");
    end(data?.status || "submitted");
  };

  const watermarkTiles = useMemo(() => Array.from({ length: 40 }, (_, i) => i), []);

  // ---------- Rendu ----------
  if (phase === "ended" || phase === "blocked") {
    return (
      <main className="max-w-xl mx-auto p-10 text-center">
        <h1 className="h1">{phase === "ended" ? "Épreuve terminée" : "Accès bloqué"}</h1>
        <p className="text-muted mt-3" role="status">{phase === "ended" ? endMessage : banner}</p>
        <a href="/dashboard" className="btn mt-6 inline-flex">Retour</a>
      </main>
    );
  }

  if (phase === "prep" || phase === "starting") {
    const faceOk = faceReady(camera.state === "live", cam);
    const canStart = canFull && (faceOk || camera.state === "denied");
    const camMsg = camera.state === "denied" ? "Caméra refusée ou absente. Vous pouvez l'autoriser (icône dans la barre d'adresse) puis cliquer sur Réessayer, ou commencer sans : ce sera signalé au surveillant."
      : camera.state === "pending" ? "Ouverture de la caméra… autorisez l'accès quand le navigateur le demande."
      : !cam ? "Analyse de l'image…"
      : cam.anomaly ? `${ANOMALY_LABEL[cam.anomaly]} : placez-vous seul, face à la caméra, dans un endroit éclairé.`
      : faceOk ? "Visage détecté, tout est prêt."
      : cam.faces === 0 ? "Aucun visage détecté : placez-vous face à la caméra." : cam.faces && cam.faces > 1 ? "Plusieurs visages détectés : vous devez être seul." : "Analyse de l'image…";
    const checks: { label: string; ok: boolean | null; detail: string }[] = [
      { label: "Caméra", ok: camera.state === "pending" ? null : faceOk, detail: camMsg },
      { label: "Plein écran", ok: canFull, detail: canFull ? "Il s'activera au clic sur « Commencer »." : "Ce navigateur ne permet pas le plein écran (téléphone ou tablette). Utilisez un ordinateur avec Chrome, Edge, Firefox ou Safari." },
    ];
    return (
      <main className="max-w-2xl mx-auto p-6 sm:p-10">
        <h1 className="h1">{title}</h1>
        {description && <p className="text-muted mt-2 whitespace-pre-wrap">{description}</p>}
        <div className="card mt-6 space-y-2 text-sm">
          <p><b>{resuming ? "Reprise de l'épreuve." : "Avant de commencer :"}</b></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Durée : <b>{durationMinutes} minutes</b>, chronométrées par le serveur (le chrono continue si vous fermez la page).</li>
            <li><b>Une question à la fois</b> : une réponse validée est définitive, aucun retour en arrière.</li>
            <li>Le <b>plein écran est obligatoire</b> : l&apos;épreuve ne démarre pas sans lui ; en sortir est une infraction et masque l&apos;épreuve jusqu&apos;à votre retour.</li>
            <li>La <b>caméra s&apos;active automatiquement</b> et reste allumée : des photos sont prises régulièrement et l&apos;image est analysée (absence de visage, plusieurs personnes, caméra masquée). Si vous la refusez ou la coupez, l&apos;épreuve continue mais le surveillant est prévenu.</li>
            <li>Copier, coller, clic droit, raccourcis et changement d&apos;onglet ou de fenêtre sont bloqués et journalisés. Un seul écran.</li>
            <li>Au bout de <b>{maxViolations} infractions</b>, l&apos;épreuve s&apos;arrête automatiquement.</li>
          </ul>
        </div>
        <div className="card mt-4 grid sm:grid-cols-[10rem_1fr] gap-4 items-start">
          <video ref={camera.attach} className={`w-40 h-28 bg-black rounded border ${faceOk ? "border-ok" : "border-line"}`} muted playsInline aria-label="Aperçu de la caméra" />
          <ul className="text-sm space-y-3">
            {checks.map((c) => (
              <li key={c.label}>
                <div className="font-medium flex items-center gap-2">
                  <span aria-hidden className={`inline-block w-2 h-2 rounded-full ${c.ok === null ? "bg-faint" : c.ok ? "bg-ok" : "bg-warn"}`} />
                  {c.label}
                </div>
                <p className={c.ok ? "text-ok" : "text-muted"}>{c.detail}</p>
                {c.label === "Caméra" && camera.state === "denied" && <button className="btn-secondary mt-2" onClick={camera.open}>Réessayer</button>}
              </li>
            ))}
          </ul>
        </div>
        {banner && <p className="text-danger text-sm mt-4" role="alert">{banner}</p>}
        <button className="btn mt-6" onClick={start} disabled={phase === "starting" || !canStart}>
          {phase === "starting" ? "Démarrage…" : resuming ? "Reprendre l'épreuve" : "Commencer l'épreuve"}
        </button>
      </main>
    );
  }

  const q = questions[idx];
  const isLast = idx >= questions.length - 1;

  return (
    <div className="min-h-screen bg-bg select-none relative overflow-auto">
      {/* Filigrane : dissuade les photos d'écran et permet de tracer une fuite */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden opacity-[0.07] select-none">
        <div className="flex flex-wrap gap-x-24 gap-y-16 -rotate-[25deg] -translate-x-1/4 -translate-y-1/4 w-[200vw]">
          {watermarkTiles.map((i) => <span key={i} className="text-sm font-mono whitespace-nowrap">{watermark}</span>)}
        </div>
      </div>

      {!isFull && !inSeb && (
        <div className="fixed inset-0 z-[60] bg-bg flex items-center justify-center p-6" role="alertdialog" aria-labelledby="fs-title">
          <div className="card max-w-md text-center">
            <h2 id="fs-title" className="h1 text-danger">Plein écran obligatoire</h2>
            <p className="text-muted mt-3">Vous avez quitté le plein écran : c&apos;est une infraction, et l&apos;épreuve reste masquée tant que vous n&apos;y revenez pas. Le chrono continue.</p>
            <button className="btn mt-6" onClick={goFull} autoFocus>Revenir en plein écran</button>
          </div>
        </div>
      )}
      {camera.state !== "live" && (
        <div className="bg-warn/15 border-b border-warn/40 text-warn text-center py-2 text-sm relative z-50" role="status">
          Caméra désactivée : c&apos;est signalé au surveillant. <button className="underline ml-2" onClick={camera.open}>Réactiver la caméra</button>
        </div>
      )}
      {banner && <div className="bg-danger text-white text-center py-2 text-sm relative z-50" role="alert">{banner}</div>}
      {timeAlert && remaining <= 300 && <div className="bg-warn text-bg text-center py-1 text-sm font-medium relative z-50" role="status">{timeAlert}</div>}
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b bg-surface relative z-30">
        <div className="flex items-center gap-4 min-w-0">
          <img src="/cybersup-logo-blanc.svg" alt="Cybersup" className="h-5 w-auto" />
          <span className="text-faint">|</span>
          <b className="font-display uppercase text-sm truncate">{title}</b>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-xs ${saving === "error" ? "text-danger" : "text-faint"}`} role="status">
            {saving === "saving" ? "Enregistrement…" : saving === "error" ? "Non enregistré" : "Enregistré"}
          </span>
          <span className="text-xs text-muted">Infractions : {violations}/{maxViolations}</span>
          <div className="relative">
            <video ref={camera.attach} className={`w-24 h-16 bg-black rounded border ${cam?.anomaly ? "border-danger" : "border-line"}`} muted playsInline aria-label="Caméra" />
            {camera.state === "live" && (
              <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] px-1.5 rounded ${cam?.anomaly ? "bg-danger text-white" : cam?.faces === 1 ? "bg-ok text-bg" : "bg-surface-2 text-muted"}`}>
                {cam?.anomaly ? ANOMALY_LABEL[cam.anomaly] : cam?.faces === 1 ? "visage OK" : cam?.ready ? "analyse…" : "chargement…"}
              </span>
            )}
          </div>
          <div className={`font-mono text-lg ${remaining < 300 ? "text-danger" : ""}`} aria-label={`Temps restant ${formatClock(remaining)}`}>{formatClock(remaining)}</div>
        </div>
      </header>

      <div className="h-1 bg-surface-2 relative z-30" role="progressbar" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={idx + 1} aria-label="Progression">
        <div className="h-full bg-accent transition-all" style={{ width: `${((idx + 1) / Math.max(1, questions.length)) * 100}%` }} />
      </div>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 relative z-30">
        <div className="text-sm text-muted mb-3">Question <b className="text-fg">{idx + 1}</b> sur {questions.length}</div>
        {q && (
          <div className="card">
            <div className="text-sm text-muted">
              {TYPE_HINT[q.type] || ""} · {q.points} pt{q.points > 1 ? "s" : ""}
            </div>
            <div className="mt-1"><QuestionPrompt ref={headingRef} prompt={q.prompt} /></div>
            {q.image_url && <img src={q.image_url} alt="" className="mt-3 max-h-80 rounded border" draggable={false} />}
            <div className="mt-4">
              <QuestionBody q={q} value={answers[q.id]} onChange={(r) => setChoice(q, r)} onText={(r) => setText(q, r)}
                runTerminal={async (command) => {
                  const { ok, data } = await post("terminal", { question_id: q.id, command });
                  return ok ? data : { error: data?.message || "Commande refusée." };
                }} />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted">Une réponse validée est définitive.</span>
              {confirming ? (
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmation">
                  <span className="text-sm text-danger">
                    {confirming === "submit"
                      ? (() => { const n = questions.filter((x) => x.type !== "terminal" && !isAnswered(answers[x.id])).length; return n ? `${n} sans réponse. Rendre la copie ?` : "Rendre la copie définitivement ?"; })()
                      : isAnswered(answers[q.id]) || q.type === "terminal" ? "Valider ? Pas de retour possible." : "Aucune réponse. Passer quand même ?"}
                  </span>
                  <button className="btn-secondary" onClick={() => setConfirming(null)}>Annuler</button>
                  <button className="btn" disabled={advancing} onClick={confirming === "submit" ? submit : next} autoFocus>Confirmer</button>
                </div>
              ) : !isLast
                ? <button className="btn" onClick={() => setConfirming("next")} disabled={advancing}>Valider et continuer →</button>
                : <button className="btn" onClick={() => setConfirming("submit")}>Valider et rendre la copie</button>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
