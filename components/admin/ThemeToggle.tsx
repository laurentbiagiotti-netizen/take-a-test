"use client";
import { useEffect, useState } from "react";

type Mode = "clair" | "sombre" | "auto";
const KEY = "cx-theme";
const apply = (m: Mode) => {
  const dark = m === "sombre" || (m === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
};

/** Mode clair, sombre ou selon le système. Le choix est gardé sur cet appareil et ne vaut que pour l'espace équipe. */
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("clair");
  useEffect(() => {
    let m: Mode = "clair";
    try { m = (localStorage.getItem(KEY) as Mode) || "clair"; } catch {}
    setMode(m); apply(m);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => { let cur: Mode = "clair"; try { cur = (localStorage.getItem(KEY) as Mode) || "clair"; } catch {} apply(cur); };
    const onKey = () => choose(document.documentElement.classList.contains("dark") ? "clair" : "sombre");
    mq.addEventListener("change", onMq); window.addEventListener("cx-theme-toggle", onKey);
    return () => { mq.removeEventListener("change", onMq); window.removeEventListener("cx-theme-toggle", onKey); document.documentElement.classList.remove("dark"); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (m: Mode) => { setMode(m); try { localStorage.setItem(KEY, m); } catch {} apply(m); };
  return (
    <div className="flex gap-1 rounded-xl bg-fg/[0.06] p-1 text-xs" role="group" aria-label="Apparence">
      {(["clair", "sombre", "auto"] as const).map((m) => (
        <button key={m} onClick={() => choose(m)} aria-pressed={mode === m}
          className={`flex-1 rounded-lg px-2 py-1.5 capitalize ${mode === m ? "bg-surface font-semibold text-navy shadow-sm" : "text-fg/70 hover:text-fg"}`}>{m}</button>
      ))}
    </div>
  );
}
