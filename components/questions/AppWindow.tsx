"use client";
import type { ReactNode } from "react";

/** Cadre de fenêtre réaliste (macOS, Windows ou navigateur) autour d'un exercice. */
export default function AppWindow({ title, kind = "mac", url, dark, children, className = "", bodyClass = "" }: {
  title: string; kind?: "mac" | "win" | "browser"; url?: string; dark?: boolean; children: ReactNode; className?: string; bodyClass?: string;
}) {
  const bar = dark ? "bg-[#2b2d31] text-white/70 border-black/40" : "bg-[#ececec] text-[#3c3c3c] border-[#c8c8c8]";
  return (
    <div className={`rounded-xl overflow-hidden border shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6)] ${dark ? "border-black/50" : "border-[#b9b9b9]"} ${className}`}>
      <div className={`relative flex items-center h-9 px-3 border-b text-[12px] select-none ${bar}`}>
        {kind !== "win" && (
          <div className="flex gap-1.5" aria-hidden>
            <span className="w-3 h-3 rounded-full bg-[#ff5f57] border border-black/10" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e] border border-black/10" />
            <span className="w-3 h-3 rounded-full bg-[#28c840] border border-black/10" />
          </div>
        )}
        {kind === "browser" ? (
          <div className={`mx-auto flex items-center gap-2 w-[min(32rem,70%)] h-6 rounded-md px-3 text-[11.5px] ${dark ? "bg-black/30" : "bg-white border border-[#d6d6d6]"}`}>
            <span aria-hidden>🔒</span><span className="truncate font-mono">{url}</span>
          </div>
        ) : (
          <div className={`${kind === "win" ? "" : "absolute inset-x-0 text-center pointer-events-none"} truncate font-medium`}>{title}</div>
        )}
        {kind === "win" && <div className="ml-auto flex gap-4 text-[13px]" aria-hidden><span>–</span><span>☐</span><span>✕</span></div>}
      </div>
      <div className={bodyClass}>{children}</div>
    </div>
  );
}
