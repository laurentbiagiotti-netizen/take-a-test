import Link from "next/link";
import type { Verdict } from "@/lib/admin/roster";

/** Petites briques communes à l'espace équipe. */

export const VERDICT: Record<string, { label: string; cls: string; dot: string }> = {
  pass: { label: "Réussi", cls: "bg-ok/10 text-ok ring-ok/25", dot: "bg-ok" },
  review: { label: "À statuer", cls: "bg-warn/10 text-warn ring-warn/25", dot: "bg-warn" },
  fail: { label: "Échoué", cls: "bg-danger/10 text-danger ring-danger/25", dot: "bg-danger" },
};

export const STATUS: Record<string, { label: string; cls: string }> = {
  in_progress: { label: "En cours", cls: "bg-[#2563eb]/10 text-[#1d4ed8] ring-[#2563eb]/25" },
  submitted: { label: "Rendu", cls: "bg-fg/5 text-muted ring-fg/10" },
  expired: { label: "Temps écoulé", cls: "bg-fg/5 text-muted ring-fg/10" },
  terminated: { label: "Arrêté", cls: "bg-danger/10 text-danger ring-danger/25" },
  pending: { label: "Inscrit", cls: "bg-fg/5 text-muted ring-fg/10" },
};

export function Pill({ cls, children, title }: { cls: string; children: React.ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{children}</span>;
}

export function VerdictPill({ verdict, status, forced, manual }: { verdict: Verdict; status: string; forced?: boolean; manual?: boolean }) {
  if (status === "in_progress") return <Pill cls={STATUS.in_progress.cls}><span className="h-1.5 w-1.5 rounded-full bg-[#2563eb] animate-pulse" />En cours</Pill>;
  if (!verdict) return <Pill cls={STATUS.submitted.cls}>{STATUS[status]?.label || "—"}</Pill>;
  const v = VERDICT[verdict];
  return (
    <Pill cls={v.cls} title={forced ? "Décision forcée par l'équipe" : manual ? "Une réponse rédigée attend sa correction" : undefined}>
      <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />{v.label}{forced ? " *" : ""}
    </Pill>
  );
}

/** Note sur 20 avec une barre : vert au-dessus du seuil de réussite, orange entre les deux, rouge en dessous. */
export function Score({ value, pass = 10, fail = 8 }: { value: number | null; pass?: number; fail?: number }) {
  if (value == null) return <span className="text-faint">—</span>;
  const color = value >= pass ? "bg-ok" : value < fail ? "bg-danger" : "bg-warn";
  return (
    <span className="inline-flex items-center gap-2.5 tabular-nums">
      <span className="w-12 text-right font-semibold">{value.toFixed(1).replace(".", ",")}</span>
      <span className="relative h-1.5 w-20 rounded-full bg-fg/10 overflow-hidden" aria-hidden>
        <span className={`absolute inset-y-0 left-0 rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, (value / 20) * 100))}%` }} />
      </span>
    </span>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "ok" | "warn" | "danger" | "live" }) {
  const t = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : tone === "live" ? "text-[#1d4ed8]" : "text-fg";
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(20,26,51,0.04)]">
      <div className="text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${t}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

/** Répartition réussi / à statuer / échoué en une barre empilée. */
export function VerdictBar({ pass, review, fail }: { pass: number; review: number; fail: number }) {
  const total = pass + review + fail;
  if (!total) return <div className="h-1.5 rounded-full bg-fg/5" />;
  const w = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-fg/5" title={`${pass} réussi(s), ${review} à statuer, ${fail} échoué(s)`}>
      <span className="bg-ok" style={{ width: w(pass) }} />
      <span className="bg-warn" style={{ width: w(review) }} />
      <span className="bg-danger" style={{ width: w(fail) }} />
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions, back }: {
  eyebrow?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string };
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">← {back.label}</Link>}
        {eyebrow && <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">{eyebrow}</div>}
        <h1 className="h1 mt-1 break-words">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export const fmtDate = (d?: string | null, withTime = false) => d
  ? new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Europe/Paris" })
  : "";
export const fmt20 = (n: number | null) => (n == null ? "—" : n.toFixed(1).replace(".", ","));
