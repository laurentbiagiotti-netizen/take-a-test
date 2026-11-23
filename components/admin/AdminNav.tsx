"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  exams: <path d="M9 4h6m-6 0a1 1 0 0 0-1 1v1h8V5a1 1 0 0 0-1-1M9 4h6M8 6H6.5A1.5 1.5 0 0 0 5 7.5v12A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 6H16m-7 7 2 2 4-4" />,
  classes: <path d="M16 19v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 8v-1a3 3 0 0 0-2.2-2.9M15 5.1a3 3 0 0 1 0 5.8" />,
  bank: <path d="M7 4h10a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 5h6M9 13h6M9 17h3" />,
  journal: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
  today: <path d="M12 3v2m0 14v2M5.6 5.6 7 7m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />,
  calendar: <path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 6 5Zm2.5 8h2m3 0h2m-7 3.5h2" />,
  chart: <path d="M4 20V10m5.5 10V4M15 20v-7m5.5 7V8" />,
  api: <path d="m8 9-4 3 4 3m8-6 4 3-4 3m-3-9-2 12" />,
};
const Icon = ({ d }: { d: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

/** Barre latérale de l'espace équipe : trois vues (examens, classes, banque) puis les outils. */
export default function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname() || "";
  const main = [
    { href: "/admin/aujourdhui", label: "Aujourd'hui", icon: I.today, on: path.startsWith("/admin/aujourdhui") },
    { href: "/admin", label: "Examens", icon: I.exams, on: path === "/admin" || path.startsWith("/admin/tests") || path.startsWith("/admin/attempts") || path.startsWith("/admin/pv") || path.startsWith("/admin/fiches") || path === "/admin/new" },
    { href: "/admin/classes", label: "Classes", icon: I.classes, on: path.startsWith("/admin/classes") || path.startsWith("/admin/etudiants") },
    { href: "/admin/banque", label: "Banque de questions", icon: I.bank, on: path.startsWith("/admin/banque") },
    { href: "/admin/calendrier", label: "Calendrier", icon: I.calendar, on: path.startsWith("/admin/calendrier") },
    { href: "/admin/pilotage", label: "Pilotage", icon: I.chart, on: path.startsWith("/admin/pilotage") },
  ];
  const tools = isAdmin ? [
    { href: "/admin/audit", label: "Journal", icon: I.journal, on: path.startsWith("/admin/audit") },
    { href: "/admin/api", label: "API et webhooks", icon: I.api, on: path.startsWith("/admin/api") },
  ] : [];
  const item = (i: (typeof main)[number]) => (
    <Link key={i.href} href={i.href} aria-current={i.on ? "page" : undefined}
      className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-all ${i.on
        ? "bg-navy text-white shadow-[0_8px_20px_-10px_rgba(10,16,71,0.7)]"
        : "text-fg/80 hover:bg-fg/5 hover:text-fg"}`}>
      <Icon d={i.icon} />{i.label}
    </Link>
  );
  return (
    <aside className="no-print lg:sticky lg:top-0 lg:h-screen lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-line bg-surface-2/70">
      <div className="flex lg:h-full flex-col gap-1 overflow-x-auto px-3 py-3 lg:px-4 lg:py-6">
        <button onClick={() => window.dispatchEvent(new Event("cx-palette"))}
          className="mb-3 hidden items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2 text-left text-sm text-muted hover:border-accent lg:flex">
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
          Rechercher<kbd className="ml-auto rounded border border-line-strong px-1.5 font-mono text-[11px]">⌘K</kbd>
        </button>
        <div className="hidden lg:block px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Équipe</div>
        <nav className="flex gap-1 lg:flex-col" aria-label="Espace équipe">{main.map(item)}</nav>
        {tools.length > 0 && <div className="mx-3 my-3 hidden h-px bg-line lg:block" />}
        <nav className="flex gap-1 lg:flex-col" aria-label="Outils">{tools.map(item)}</nav>
        {isAdmin && (
          <div className="mt-auto hidden lg:block">
            <Link href="/admin/new" className="btn w-full justify-center">+ Nouvelle épreuve</Link>
          </div>
        )}
      </div>
    </aside>
  );
}
