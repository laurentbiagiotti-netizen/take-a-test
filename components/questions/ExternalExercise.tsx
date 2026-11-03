"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/exam/client";

export type ExternalInfo = { tool: string; label?: string | null; time_limit_s?: number | null; started?: boolean; completed?: boolean };
export type LaunchResult = {
  url?: string; origin?: string; deadline_at?: string; completed?: boolean;
  unavailable?: boolean; error?: string; status?: string;
};

const TOOL_LABEL: Record<string, string> = { crime: "Crime GeoGuess", win95: "Cybersup OS" };

/** Message envoyé par la page d'examen d'un outil à l'épreuve. */
type ToolMessage = { type: "cx-exam"; event: "ready" | "progress" | "completed" | "blur" | "focus" };

/**
 * Exercice dans un outil de l'école, ouvert dans un cadre de l'épreuve. Le
 * plein écran, la caméra et le journal continuent de tourner autour. La note
 * ne transite jamais par ce composant : l'outil (ou la plateforme) l'enregistre
 * côté serveur.
 */
export default function ExternalExercise({ q, launch, onCompleted, onToolBlur }: {
  q: { id: string; external?: ExternalInfo | null };
  launch: () => Promise<LaunchResult>;
  onCompleted: () => void;
  /** Le candidat a quitté la fenêtre alors que le focus était dans l'outil. */
  onToolBlur?: () => void;
}) {
  const ext = q.external;
  const [frame, setFrame] = useState<{ url: string; origin: string; deadline: number } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "running" | "done" | "error">(ext?.completed ? "done" : "idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const started = useRef(false);

  const open = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setState("loading"); setMsg(null);
    const r = await launch();
    if (r.error || !r.url || !r.origin) {
      started.current = false;
      setState(r.completed ? "done" : "error");
      setMsg(r.unavailable ? "L'exercice n'est pas disponible pour le moment. Prévenez le surveillant." : r.error || "Impossible d'ouvrir l'exercice.");
      return;
    }
    setFrame({ url: r.url, origin: r.origin, deadline: r.deadline_at ? new Date(r.deadline_at).getTime() : 0 });
    setState(r.completed ? "done" : "running");
  }, [launch]);

  // Exercice déjà commencé (page rechargée) : on le rouvre tout de suite.
  useEffect(() => { if (ext?.started && !ext?.completed) void open(); }, [ext?.started, ext?.completed, open]);

  useEffect(() => {
    if (!frame) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== frame.origin) return;
      const m = e.data as ToolMessage;
      if (!m || m.type !== "cx-exam") return;
      if (m.event === "completed") { setState("done"); onCompleted(); }
      if (m.event === "blur") onToolBlur?.();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [frame, onCompleted, onToolBlur]);

  useEffect(() => {
    if (!frame?.deadline) return;
    const t = setInterval(() => setLeft(Math.max(0, Math.round((frame.deadline - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [frame]);

  if (!ext) return <p className="text-danger text-sm">Exercice mal configuré. Prévenez le surveillant.</p>;
  const name = TOOL_LABEL[ext.tool] || ext.tool;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          Exercice dans <b className="text-fg">{name}</b>{ext.label ? ` · ${ext.label}` : ""}
          {ext.time_limit_s ? ` · ${Math.round(ext.time_limit_s / 60)} min` : ""}
        </span>
        {state === "running" && left !== null && (
          <span className={`font-mono ${left < 60 ? "text-danger" : "text-muted"}`} aria-label={`Temps restant pour l'exercice ${formatClock(left)}`}>
            Exercice : {formatClock(left)}
          </span>
        )}
        {state === "done" && <span className="badge-ok">Exercice terminé</span>}
      </div>

      {state === "idle" && (
        <div className="mt-4 rounded border border-line bg-surface-2 p-4">
          <p className="text-sm">
            L&apos;exercice s&apos;ouvre ici, sans quitter l&apos;épreuve.
            {ext.time_limit_s ? ` Vous aurez ${Math.round(ext.time_limit_s / 60)} minutes dès l'ouverture.` : ""}
            {" "}Les indices et le classement de l&apos;outil sont désactivés pendant l&apos;épreuve.
          </p>
          <button className="btn mt-3" onClick={() => void open()}>Commencer l&apos;exercice</button>
        </div>
      )}
      {state === "loading" && <p className="mt-4 text-sm text-muted" role="status">Ouverture de l&apos;exercice…</p>}
      {state === "error" && (
        <div className="mt-4">
          <p className="text-sm text-danger" role="alert">{msg}</p>
          <button className="btn-secondary mt-2" onClick={() => void open()}>Réessayer</button>
        </div>
      )}
      {frame && (
        <iframe
          key={frame.url}
          src={frame.url}
          title={`Exercice ${name}`}
          data-exam-tool={ext.tool}
          className="mt-4 w-full rounded border border-line bg-black"
          style={{ height: "min(72vh, 820px)" }}
          sandbox="allow-scripts allow-same-origin allow-forms"
          referrerPolicy="no-referrer"
          allow="fullscreen 'none'; camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
        />
      )}
      {state === "done" && !frame && (
        <p className="mt-4 text-sm text-muted">Vos réponses à cet exercice sont enregistrées. Vous pouvez valider et continuer.</p>
      )}
    </div>
  );
}

/** Le focus est dans le cadre d'un outil d'examen (ce n'est pas une sortie de fenêtre). */
export function focusInToolFrame(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && el.tagName === "IFRAME" && !!el.dataset.examTool;
}

/** Le pointeur est au-dessus du cadre d'un outil d'examen. */
export function pointInToolFrame(x: number, y: number): boolean {
  return Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe[data-exam-tool]")).some((f) => {
    const r = f.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });
}
