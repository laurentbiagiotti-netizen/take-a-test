"use client";
import { useEffect, useState } from "react";

/**
 * Messages de l'interface d'administration, affichés dans la page
 * (et non dans une fenêtre d'alerte du navigateur qui bloque tout).
 */
type Toast = { id: number; text: string; tone: "error" | "ok" | "info" };

export function notify(text: string, tone: Toast["tone"] = "error") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cx-toast", { detail: { text, tone } }));
}

export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { text, tone } = (e as CustomEvent).detail;
      const id = ++n;
      setItems((all) => [...all.slice(-3), { id, text, tone }]);
      setTimeout(() => setItems((all) => all.filter((t) => t.id !== id)), tone === "error" ? 9000 : 5000);
    };
    window.addEventListener("cx-toast", on);
    return () => window.removeEventListener("cx-toast", on);
  }, []);
  return (
    <div className="fixed top-4 right-4 z-[70] space-y-2 w-[min(26rem,calc(100vw-2rem))]" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} role={t.tone === "error" ? "alert" : "status"}
          className={`card !py-3 flex items-start gap-3 shadow-lg border-l-4 ${t.tone === "error" ? "border-l-danger" : t.tone === "ok" ? "border-l-ok" : "border-l-accent"}`}>
          <p className="text-sm flex-1 whitespace-pre-line">{t.text}</p>
          <button className="text-muted hover:text-fg text-sm" aria-label="Fermer" onClick={() => setItems((all) => all.filter((x) => x.id !== t.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
