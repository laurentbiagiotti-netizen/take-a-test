"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Onglets d'une épreuve : résultats d'abord, puis questions et le reste du suivi. */
export default function ExamTabs({ id, isAdmin, live, questions }: { id: string; isAdmin: boolean; live: number; questions: number }) {
  const path = usePathname() || "";
  const reglages = useSearchParams()?.get("vue") === "reglages";
  const base = `/admin/tests/${id}`;
  const tabs: { href: string; label: string; on: boolean; badge?: React.ReactNode }[] = [
    { href: base, label: "Résultats", on: path === base },
    ...(isAdmin ? [{ href: `${base}/questions`, label: "Questions", on: path.startsWith(`${base}/questions`) && !reglages, badge: questions }] : []),
    ...(isAdmin ? [{ href: `${base}/questions?vue=reglages`, label: "Réglages", on: path.startsWith(`${base}/questions`) && reglages }] : []),
    ...(isAdmin ? [{ href: `${base}/invites`, label: "Inscriptions", on: path.startsWith(`${base}/invites`) }] : []),
    { href: `${base}/live`, label: "En direct", on: path.startsWith(`${base}/live`), badge: live ? <span className="inline-flex items-center gap-1 text-[#1f7a44]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2fa862]" />{live}</span> : undefined },
    { href: `${base}/attempts`, label: "Copies", on: path.startsWith(`${base}/attempts`) },
    { href: `${base}/dashboard`, label: "Analyse", on: path.startsWith(`${base}/dashboard`) },
    { href: `${base}/stats`, label: "Analyse des questions", on: path.startsWith(`${base}/stats`) },
  ];
  return (
    <nav className="mt-7 flex gap-2 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Sections de l'épreuve">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.on ? "page" : undefined}
          className={`relative inline-flex items-center gap-2 whitespace-nowrap px-4 pb-3 pt-1 text-[15px] transition-colors ${t.on ? "font-semibold text-navy" : "text-fg/70 hover:text-fg"}`}>
          {t.label}
          {t.badge !== undefined && t.badge !== 0 && <span className="text-xs text-muted tabular-nums">{t.badge}</span>}
          {t.on && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-accent" />}
        </Link>
      ))}
    </nav>
  );
}
