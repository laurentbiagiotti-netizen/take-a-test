"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Onglets d'une épreuve : la vue d'ensemble (candidats et notes) d'abord, les questions ensuite. */
export default function ExamTabs({ id, isAdmin, live }: { id: string; isAdmin: boolean; live: number }) {
  const path = usePathname() || "";
  const base = `/admin/tests/${id}`;
  const tabs = [
    { href: base, label: "Vue d'ensemble", on: path === base },
    ...(isAdmin ? [{ href: `${base}/questions`, label: "Questions et réglages", on: path.startsWith(`${base}/questions`) }] : []),
    ...(isAdmin ? [{ href: `${base}/invites`, label: "Inscriptions", on: path.startsWith(`${base}/invites`) }] : []),
    { href: `${base}/live`, label: live ? `En direct · ${live}` : "En direct", on: path.startsWith(`${base}/live`), live: live > 0 },
    { href: `${base}/attempts`, label: "Copies", on: path.startsWith(`${base}/attempts`) },
    { href: `${base}/dashboard`, label: "Analyse", on: path.startsWith(`${base}/dashboard`) },
    { href: `${base}/stats`, label: "Questions difficiles", on: path.startsWith(`${base}/stats`) },
  ];
  return (
    <nav className="mt-5 -mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Sections de l'épreuve">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.on ? "page" : undefined}
          className={`relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${t.on ? "text-fg" : "text-muted hover:text-fg"}`}>
          {"live" in t && t.live && <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb] animate-pulse" />}
          {t.label}
          {t.on && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
        </Link>
      ))}
    </nav>
  );
}
