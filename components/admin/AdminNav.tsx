"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  exams: <path d="M9 4h6m-6 0a1 1 0 0 0-1 1v1h8V5a1 1 0 0 0-1-1M9 4h6M8 6H6.5A1.5 1.5 0 0 0 5 7.5v12A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 6H16m-7 7 2 2 4-4" />,
  classes: <path d="M16 19v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 8v-1a3 3 0 0 0-2.2-2.9M15 5.1a3 3 0 0 1 0 5.8" />,
  bank: <path d="M7 4h10a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 5h6M9 13h6M9 17h3" />,
  journal: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
  api: <path d="m8 9-4 3 4 3m8-6 4 3-4 3m-3-9-2 12" />,
};
const Icon = ({ d }: { d: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

/** Barre latérale de l'espace équipe : trois vues (examens, classes, banque) puis les outils. */
export default function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname() || "";
  const main = [
    { href: "/admin", label: "Examens", icon: I.exams, on: path === "/admin" || path.startsWith("/admin/tests") || path.startsWith("/admin/attempts") || path === "/admin/new" },
    { href: "/admin/classes", label: "Classes", icon: I.classes, on: path.startsWith("/admin/classes") },
    { href: "/admin/banque", label: "Banque de questions", icon: I.bank, on: path.startsWith("/admin/banque") },
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
    <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-line bg-surface-2/70">
      <div className="flex lg:h-full flex-col gap-1 overflow-x-auto px-3 py-3 lg:px-4 lg:py-6">
        <div className="hidden lg:block px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Équipe</div>
        <nav className="flex gap-1 lg:flex-col" aria-label="Espace équipe">{main.map(item)}</nav>
        {tools.length > 0 && <div className="mx-3 my-3 hidden h-px bg-line lg:block" />}
        <nav className="flex gap-1 lg:flex-col" aria-label="Outils">{tools.map(item)}</nav>
        {isAdmin && (
          <div className="hidden lg:block mt-auto">
            <Link href="/admin/new" className="btn w-full justify-center">+ Nouvelle épreuve</Link>
          </div>
        )}
      </div>
    </aside>
  );
}
