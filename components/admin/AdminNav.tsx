"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Navigation de l'espace équipe : trois vues (examens, classes, banque) et les outils. */
export default function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname() || "";
  const items = [
    { href: "/admin", label: "Examens", on: path === "/admin" || path.startsWith("/admin/tests") || path.startsWith("/admin/attempts") || path === "/admin/new" },
    { href: "/admin/classes", label: "Classes", on: path.startsWith("/admin/classes") },
    { href: "/admin/banque", label: "Banque de questions", on: path.startsWith("/admin/banque") },
  ];
  const tools = isAdmin ? [
    { href: "/admin/audit", label: "Journal", on: path.startsWith("/admin/audit") },
    { href: "/admin/api", label: "API", on: path.startsWith("/admin/api") },
  ] : [];
  const tab = (i: { href: string; label: string; on: boolean }) => (
    <Link key={i.href} href={i.href} aria-current={i.on ? "page" : undefined}
      className={`relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors ${i.on ? "text-fg" : "text-muted hover:text-fg"}`}>
      {i.label}
      {i.on && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
    </Link>
  );
  return (
    <div className="border-b border-line bg-surface">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Espace équipe">
        {items.map(tab)}
        <span className="mx-2 h-5 w-px bg-line" aria-hidden />
        {tools.map(tab)}
        {isAdmin && <Link href="/admin/new" className="btn !py-1.5 ml-auto shrink-0 my-2">+ Nouvelle épreuve</Link>}
      </nav>
    </div>
  );
}
