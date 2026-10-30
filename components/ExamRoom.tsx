"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Salle d'examen. Le navigateur ne fait que SIGNALER : chrono, compteur
 * d'infractions, clôture et correction sont décidés par le serveur.
 * Aucune bonne réponse n'est jamais envoyée au navigateur.
 */

type Opt = { id: string; text: string; image_url?: string | null };
type Q = { id: string; type: "mcq_single" | "mcq_multi" | "long_text"; prompt: string; options: Opt[] | null; points: number; image_url?: string | null };
type Phase = "prep" | "starting" | "active" | "ended" | "blocked";

const HEARTBEAT_MS = 10_000;
const SNAPSHOT_MS = 20_000;
const VIOLATION_DEBOUNCE_MS = 1500;

export default function ExamRoom(props: {
  testId: string; title: string; description?: string | null; durationMinutes: number;
  maxViolations: number; requireWebcam: boolean; resuming: boolean; watermark: string;
}) {
  const { testId, title, description, durationMinutes, maxViolations, requireWebcam, resuming, watermark } = props;
  const api = useCallback((p: string) => `/api/exam/${testId}/${p}`, [testId]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastViolationAt = useRef(0);
  const clockOffset = useRef(0);
  const textTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const phaseRef = useRef<Phase>("prep");

  const [phase, setPhaseState] = useState<Phase>("prep");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [deadline, setDeadline] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const [idx, setIdx] = useState(0);
  const [violations, setViolations] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [endMessage, setEndMessage] = useState<string>("");
  const [saving, setSaving] = useState<"idle" | "saving" | "error">("idle");

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const stopMedia = () => streamRef.current?.getTracks().forEach((t) => t.stop());

  const end = useCallback((status: string) => {
    if (phaseRef.current === "ended") return;
    stopMedia();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setEndMessage(
      status === "terminated" ? "L'épreuve a été interrompue : nombre maximal d'infractions atteint." :
      status === "expired" ? "Le temps est écoulé. Vos réponses enregistrées ont été transmises." :
      "Vos réponses ont été transmises. Vous pouvez fermer cette fenêtre.");
    setPhase("ended");
  }, []);

  const post = useCallback(async (path: string, body?: unknown) => {
    const r = await fetch(api(path), {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const j = await r.json().catch(() => ({}));
    if (j?.status && j.status !== "in_progress" && phaseRef.current === "active") end(j.status);
    if (typeof j?.violation_count === "number") setViolations(j.violation_count);
    if (!r.ok && (j?.error === "session_invalid" || j?.error === "seb_required")) {
      stopMedia();
      setBanner(j.message); setPhase("blocked");
    }
    return { ok: r.ok, data: j };
  }, [api, end]);

  const report = useCallback((kind: string, detail?: Record<string, unknown>, isViolation = false) => {
    if (phaseRef.current !== "active") return;
    if (isViolation) {
      const t = Date.now();
      if (t - lastViolationAt.current < VIOLATION_DEBOUNCE_MS) return; // un seul geste = une infraction
      lastViolationAt.current = t;
      setBanner(`Infraction signalée : ${LABELS[kind] || kind}. Au bout de ${maxViolations}, l'épreuve s'arrête.`);
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
    if (requireWebcam) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        streamRef.current = stream;
      } catch {
        setBanner("La caméra est obligatoire pour cet examen. Autorisez l'accès puis réessayez.");
        return;
      }
    }
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); }
    catch { setBanner("Le plein écran est obligatoire."); stopMedia(); return; }

    setPhase("starting");
    const { ok, data } = await post("begin");
    if (!ok || data?.status !== "in_progress") {
      stopMedia();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      if (data?.status && data.status !== "in_progress") { end(data.status); return; }
      setBanner(data?.message || "Impossible de démarrer l'examen.");
      setPhase(data?.error === "session_locked" ? "blocked" : "prep");
      return;
    }
    clockOffset.current = new Date(data.server_now).getTime() - Date.now();
    setDeadline(new Date(data.deadline_at).getTime());
    setQuestions(data.questions || []);
    setAnswers(data.answers || {});
    setViolations(data.violation_count || 0);
    setPhase("active");
  };

  useEffect(() => {
    if (phase === "active" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  // ---------- Surveillance ----------
  useEffect(() => {
    if (phase !== "active") return;
    const onFs = () => { if (!document.fullscreenElement) report("fullscreen_exit", undefined, true); };
    const onVis = () => { if (document.hidden) report("tab_hidden", undefined, true); };
    const onBlur = () => report("window_blur", undefined, true);
    const block = (kind: string) => (e: Event) => { e.preventDefault(); report(kind); };
    const onCopy = block("copy_blocked"), onPaste = block("paste_blocked"), onCut = block("cut_blocked");
    const onContext = (e: Event) => e.preventDefault();
    const onPrint = () => report("print_attempt", undefined, true);
    const onLeave = (e: MouseEvent) => { if (!e.relatedTarget) report("mouse_left"); };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if ((mod && ["c", "v", "x", "p", "s", "u", "a", "f", "g", "j", "i"].includes(k)) || (mod && e.shiftKey && ["i", "j", "c", "k"].includes(k))
          || k === "f12" || k === "printscreen" || (e.altKey && k === "tab")) {
        e.preventDefault();
        report("shortcut_blocked", { key: (mod ? "mod+" : "") + (e.shiftKey ? "shift+" : "") + k });
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("cut", onCut);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("beforeprint", onPrint);
    document.documentElement.addEventListener("mouseleave", onLeave);

    // Écran secondaire branché en cours d'épreuve, outils de développement
    const probe = setInterval(() => {
      if ((window.screen as any).isExtended === true) report("multiple_screens", undefined, true);
      const dw = window.outerWidth - window.innerWidth, dh = window.outerHeight - window.innerHeight;
      if (document.fullscreenElement && (dw > 200 || dh > 250)) report("devtools_open", { dw, dh }, true);
    }, 5000);

    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("beforeprint", onPrint);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      clearInterval(probe);
    };
  }, [phase, report]);

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

  // Captures webcam (déposées par le serveur dans un espace privé)
  useEffect(() => {
    if (phase !== "active" || !requireWebcam) return;
    const i = setInterval(async () => {
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (!track || track.readyState !== "live" || track.muted) { report("camera_off", undefined, true); return; }
      const v = videoRef.current; if (!v || !v.videoWidth) return;
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = Math.round(320 * v.videoHeight / v.videoWidth);
      canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.6));
      if (!blob) return;
      const fd = new FormData(); fd.append("image", blob, "snap.jpg");
      const r = await fetch(api("snapshot"), { method: "POST", body: fd, credentials: "same-origin" });
      const j = await r.json().catch(() => ({}));
      if (j?.status && j.status !== "in_progress") end(j.status);
    }, SNAPSHOT_MS);
    return () => clearInterval(i);
  }, [phase, requireWebcam, report, api, end]);

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

  useEffect(() => () => stopMedia(), []);

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

  const setText = (q: Q, text: string) => {
    setAnswers((a) => ({ ...a, [q.id]: { text } }));
    clearTimeout(textTimers.current[q.id]);
    textTimers.current[q.id] = setTimeout(() => save(q, { text }), 800);
  };

  const submit = async () => {
    const unanswered = questions.filter((q) => !answers[q.id] || (answers[q.id].selected?.length === 0) || answers[q.id].text === "").length;
    if (!confirm(unanswered ? `${unanswered} question(s) sans réponse. Rendre la copie définitivement ?` : "Rendre la copie définitivement ?")) return;
    await Promise.all(Object.entries(textTimers.current).map(async ([qid, t]) => {
      clearTimeout(t);
      const q = questions.find((x) => x.id === qid);
      if (q && answers[qid]) await save(q, answers[qid]);
    }));
    const { data } = await post("submit");
    end(data?.status || "submitted");
  };

  const watermarkTiles = useMemo(() => Array.from({ length: 40 }, (_, i) => i), []);

  // ---------- Rendu ----------
  if (phase === "ended" || phase === "blocked") {
    return (
      <main className="max-w-xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-bold">{phase === "ended" ? "Épreuve terminée" : "Accès bloqué"}</h1>
        <p className="text-slate-600 mt-3">{phase === "ended" ? endMessage : banner}</p>
        <a href="/dashboard" className="btn mt-6 inline-flex">Retour</a>
      </main>
    );
  }

  if (phase === "prep" || phase === "starting") {
    return (
      <main className="max-w-2xl mx-auto p-10">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-slate-600 mt-2 whitespace-pre-wrap">{description}</p>}
        <div className="card mt-6 space-y-2 text-sm">
          <p><b>{resuming ? "Reprise de l'épreuve." : "Avant de commencer :"}</b></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Durée : <b>{durationMinutes} minutes</b>, chronométrées par le serveur (le chrono continue si vous fermez la page).</li>
            <li>L&apos;épreuve se déroule en <b>plein écran</b> ; en sortir est une infraction.</li>
            {requireWebcam && <li>La <b>caméra</b> reste allumée ; des photos sont prises régulièrement et conservées de façon sécurisée pendant la durée fixée par l&apos;école.</li>}
            <li>Copier, coller, clic droit, raccourcis et changement d&apos;onglet ou de fenêtre sont bloqués et journalisés.</li>
            <li>Un seul écran : débranchez tout écran secondaire.</li>
            <li>Au bout de <b>{maxViolations} infractions</b>, l&apos;épreuve s&apos;arrête automatiquement.</li>
            <li>L&apos;examen ne peut être ouvert que sur un seul appareil à la fois.</li>
          </ul>
        </div>
        {banner && <p className="text-red-600 text-sm mt-4">{banner}</p>}
        <button className="btn mt-6" onClick={start} disabled={phase === "starting"}>
          {phase === "starting" ? "Démarrage…" : resuming ? "Reprendre l'épreuve" : "Commencer l'épreuve"}
        </button>
      </main>
    );
  }

  const q = questions[idx];
  const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
  const hh = Math.floor(remaining / 3600), mm = Math.floor((remaining % 3600) / 60), ss = remaining % 60;
  const clock = `${hh ? hh + ":" : ""}${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-slate-50 select-none relative overflow-auto">
      {/* Filigrane : dissuade les photos d'écran et permet de tracer une fuite */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden opacity-[0.07] select-none">
        <div className="flex flex-wrap gap-x-24 gap-y-16 -rotate-[25deg] -translate-x-1/4 -translate-y-1/4 w-[200vw]">
          {watermarkTiles.map((i) => <span key={i} className="text-sm font-mono whitespace-nowrap">{watermark}</span>)}
        </div>
      </div>

      {banner && <div className="bg-red-600 text-white text-center py-2 text-sm relative z-50">{banner}</div>}
      <header className="flex items-center justify-between p-4 border-b bg-white relative z-30">
        <div><b>{title}</b> <span className="text-slate-500 text-sm">· Question {idx + 1}/{questions.length}</span></div>
        <div className="flex items-center gap-4">
          <span className={`text-xs ${saving === "error" ? "text-red-600" : "text-slate-400"}`}>
            {saving === "saving" ? "Enregistrement…" : saving === "error" ? "Non enregistré" : "Enregistré"}
          </span>
          <span className="text-xs text-slate-500">Infractions : {violations}/{maxViolations}</span>
          {requireWebcam && <video ref={videoRef} className="w-24 h-16 bg-black rounded" muted playsInline />}
          <div className={`font-mono text-lg ${remaining < 300 ? "text-red-600" : ""}`}>{clock}</div>
          <button className="btn" onClick={submit}>Rendre la copie</button>
        </div>
      </header>

      <nav className="max-w-3xl mx-auto px-6 pt-4 flex flex-wrap gap-1 relative z-30">
        {questions.map((qq, i) => {
          const a = answers[qq.id];
          const done = a && ((a.selected && a.selected.length) || (a.text && a.text.trim()));
          return (
            <button key={qq.id} onClick={() => setIdx(i)}
              className={`w-8 h-8 text-xs rounded border ${i === idx ? "border-slate-900 font-bold" : "border-slate-300"} ${done ? "bg-slate-200" : "bg-white"}`}>
              {i + 1}
            </button>
          );
        })}
      </nav>

      <main className="max-w-3xl mx-auto p-6 relative z-30">
        {q && (
          <div className="card">
            <div className="text-sm text-slate-500">
              {q.type === "long_text" ? "Réponse rédigée" : q.type === "mcq_multi" ? "Plusieurs réponses possibles" : "Une seule réponse"} · {q.points} pt{q.points > 1 ? "s" : ""}
            </div>
            <h2 className="text-lg font-semibold mt-1 whitespace-pre-wrap">{q.prompt}</h2>
            {q.image_url && <img src={q.image_url} alt="" className="mt-3 max-h-80 rounded border" draggable={false} />}
            <div className="mt-4 space-y-2">
              {q.type === "long_text" && (
                <textarea
                  className="input min-h-[220px] font-mono" maxLength={20000} spellCheck={false}
                  autoComplete="off" autoCorrect="off"
                  value={answers[q.id]?.text || ""}
                  onChange={(e) => setText(q, e.target.value)}
                  onDrop={(e) => e.preventDefault()}
                />
              )}
              {q.type !== "long_text" && q.options?.map((opt) => {
                const sel: string[] = answers[q.id]?.selected || [];
                const checked = sel.includes(opt.id);
                return (
                  <label key={opt.id} className={`flex gap-2 items-center p-2 rounded border cursor-pointer ${checked ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"}`}>
                    <input
                      type={q.type === "mcq_single" ? "radio" : "checkbox"} name={`q-${q.id}`} checked={checked}
                      onChange={(e) => {
                        let next = sel.slice();
                        if (q.type === "mcq_single") next = e.target.checked ? [opt.id] : [];
                        else next = e.target.checked ? [...next, opt.id] : next.filter((x) => x !== opt.id);
                        setChoice(q, { selected: next });
                      }}
                    />
                    <div className="flex-1">
                      <div>{opt.text}</div>
                      {opt.image_url && <img src={opt.image_url} alt="" className="mt-1 max-h-32 rounded border" draggable={false} />}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-6 flex justify-between">
              <button className="btn-secondary" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>← Précédente</button>
              {idx < questions.length - 1
                ? <button className="btn" onClick={() => setIdx((i) => i + 1)}>Suivante →</button>
                : <button className="btn" onClick={submit}>Terminer et rendre</button>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const LABELS: Record<string, string> = {
  fullscreen_exit: "sortie du plein écran",
  tab_hidden: "changement d'onglet",
  window_blur: "changement de fenêtre",
  multiple_screens: "écran secondaire détecté",
  devtools_open: "outils de développement ouverts",
  camera_off: "caméra coupée",
  print_attempt: "tentative d'impression",
};
