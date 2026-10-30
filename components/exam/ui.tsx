"use client";
/**
 * Éléments d'interface communs à la salle d'examen et à la démo :
 * barre de confirmation, vignette caméra, badges de vérification, règles.
 */
import type { ReactNode, Ref } from "react";
import { ANOMALY_LABEL, type CameraStatus } from "@/lib/proctor/camera-monitor";

// ------------------------------------------------------------ confirmation
/** Barre fixe en bas de l'écran : toujours visible, jamais sous la ligne de flottaison. */
export function ConfirmBar({ message, detail, confirmLabel = "Confirmer", onConfirm, onCancel, busy }: {
  message: string; detail?: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[55] border-t-2 border-accent bg-surface/95 backdrop-blur shadow-[0_-8px_24px_rgba(0,0,0,0.4)]"
      role="alertdialog" aria-live="assertive" aria-label="Confirmation">
      <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center gap-3">
        <span aria-hidden className="w-8 h-8 shrink-0 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold">!</span>
        <div className="flex-1 min-w-0 basis-[calc(100%-3rem)] sm:basis-auto">
          <div className="font-medium text-fg">{message}</div>
          {detail && <div className="text-sm text-muted">{detail}</div>}
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button className="btn-secondary flex-1 sm:flex-none" onClick={onCancel}>Annuler</button>
          <button className="btn flex-1 sm:flex-none" onClick={onConfirm} disabled={busy} autoFocus>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ caméra
export type CamTone = "ok" | "warn" | "bad" | "idle";

export function cameraTone(live: boolean, cam: CameraStatus | null): { tone: CamTone; label: string } {
  if (!live) return { tone: "bad", label: "caméra désactivée" };
  if (cam?.anomaly) return { tone: "bad", label: ANOMALY_LABEL[cam.anomaly] };
  if (cam?.faces === 1) return { tone: "ok", label: "visage détecté" };
  if (cam && cam.faces !== null && cam.faces !== 1) return { tone: "warn", label: cam.faces === 0 ? "aucun visage" : `${cam.faces} visages` };
  return { tone: "idle", label: cam?.ready ? "caméra active" : "analyse en cours" };
}

const DOT: Record<CamTone, string> = { ok: "bg-ok", warn: "bg-warn", bad: "bg-danger", idle: "bg-faint" };
const TXT: Record<CamTone, string> = { ok: "text-ok", warn: "text-warn", bad: "text-danger", idle: "text-muted" };

/** Vignette compacte pour l'en-tête : image, pastille et libellé côte à côte. */
export function CameraChip({ videoRef, live, cam }: { videoRef: Ref<HTMLVideoElement>; live: boolean; cam: CameraStatus | null }) {
  const { tone, label } = cameraTone(live, cam);
  return (
    <div className="flex items-center gap-2" aria-label={`Caméra : ${label}`}>
      <div className={`relative w-14 h-10 rounded overflow-hidden bg-black border ${tone === "bad" ? "border-danger" : "border-line"}`}>
        <video ref={videoRef} className={`w-full h-full object-cover ${live ? "" : "opacity-0"}`} muted playsInline aria-hidden />
        <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-black ${DOT[tone]}`} aria-hidden />
      </div>
      <span className={`hidden sm:block text-xs leading-tight max-w-[7rem] ${TXT[tone]}`}>{label}</span>
    </div>
  );
}

// ------------------------------------------------------------ vérifications
export type CheckState = "ok" | "pending" | "fix" | "step" | "optional" | "manual";
const BADGE: Record<CheckState, { cls: string; label: string }> = {
  ok: { cls: "badge-ok", label: "OK" },
  pending: { cls: "badge-muted", label: "En cours" },
  fix: { cls: "badge-danger", label: "À corriger" },
  step: { cls: "badge-muted", label: "Au démarrage" },
  optional: { cls: "badge-muted", label: "Facultatif" },
  manual: { cls: "badge-muted", label: "À vérifier" },
};

export function CheckBadge({ state }: { state: CheckState }) {
  const b = BADGE[state];
  return (
    <span className={`badge ${b.cls} inline-flex items-center gap-1.5`}>
      {state === "pending" && <span aria-hidden className="w-2 h-2 rounded-full border-2 border-current border-t-transparent animate-spin" />}
      {b.label}
    </span>
  );
}

export function CheckRow({ label, detail, state, action }: { label: string; detail?: string; state: CheckState; action?: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3 border-t border-line pt-3 first:border-0 first:pt-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {detail && <div className="text-xs text-muted mt-0.5">{detail}</div>}
        {action}
      </div>
      <div className="shrink-0"><CheckBadge state={state} /></div>
    </li>
  );
}

// ------------------------------------------------------------ règles
const ICONS: Record<string, ReactNode> = {
  fullscreen: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  camera: <><rect x="3" y="7" width="13" height="10" rx="2" /><path d="M16 11l5-3v8l-5-3" /></>,
  linear: <><path d="M5 12h12" /><path d="M13 6l6 6-6 6" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  screen: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
};

export function RuleIcon({ name }: { name: keyof typeof ICONS | string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export function examRules(maxViolations?: number): { icon: string; title: string; text: string }[] {
  return [
    { icon: "fullscreen", title: "Plein écran obligatoire", text: "L'épreuve démarre en plein écran et se masque si vous en sortez." },
    { icon: "camera", title: "Caméra allumée", text: "Elle s'ouvre seule. L'image n'est pas enregistrée : une photo est prise seulement en cas d'anomalie (autre personne, caméra masquée), examinée par un surveillant." },
    { icon: "linear", title: "Une question à la fois", text: "Une réponse validée est définitive : pas de retour en arrière." },
    { icon: "clock", title: "Chrono tenu par le serveur", text: "Fermer ou recharger la page ne l'arrête pas." },
    { icon: "lock", title: "Copier, coller, changer de fenêtre", text: maxViolations ? `Bloqués et comptés comme infractions : au-delà de ${maxViolations}, un surveillant examine votre épreuve.` : "Bloqués et comptés comme infractions, examinées par un surveillant." },
    { icon: "screen", title: "Un seul écran, un seul appareil", text: "Débranchez tout écran secondaire avant de commencer." },
  ];
}

export function RulesList({ maxViolations, title = "Le jour de l'épreuve" }: { maxViolations?: number; title?: string }) {
  return (
    <section className="card">
      <h2 className="h2">{title}</h2>
      <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-4">
        {examRules(maxViolations).map((r) => (
          <li key={r.icon} className="flex gap-3">
            <span className="shrink-0 w-9 h-9 rounded-md bg-accent/10 text-accent flex items-center justify-center"><RuleIcon name={r.icon} /></span>
            <div>
              <div className="text-sm font-medium text-fg">{r.title}</div>
              <div className="text-sm text-muted">{r.text}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Bouton de départ avec l'état « prêt » juste à côté. */
export function StartRow({ ready, label, hint, onStart, disabled }: { ready: boolean; label: string; hint: string; onStart: () => void; disabled?: boolean }) {
  return (
    <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-center gap-3">
      <button className="btn" onClick={onStart} disabled={disabled}>{label}</button>
      <span className={`text-sm flex items-center gap-2 ${ready ? "text-ok" : "text-muted"}`} role="status">
        <span aria-hidden className={`w-2 h-2 rounded-full ${ready ? "bg-ok" : "bg-faint"}`} />{hint}
      </span>
    </div>
  );
}
