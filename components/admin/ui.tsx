import Link from "next/link";
import type { Verdict } from "@/lib/admin/roster";

/** Briques visuelles de l'espace équipe (cartes, notes, pastilles, petits graphiques). */

/** Quatre paliers de note, partout les mêmes : 14 et plus, 10 à 14, 7 à 10, moins de 7. */
export function tier(n: number | null | undefined) {
  if (n == null) return { text: "text-faint", bar: "bg-fg/15", soft: "bg-fg/5 text-muted", avatar: "bg-[#b9b3a8]", key: "none" };
  if (n >= 14) return { text: "text-[#1f8a4c]", bar: "bg-[#2fa862]", soft: "bg-[#2fa862]/15 text-[#1f7a44]", avatar: "bg-[#2fa862]", key: "high" };
  if (n >= 10) return { text: "text-navy", bar: "bg-navy", soft: "bg-[#5561c9]/[0.14] text-navy", avatar: "bg-navy", key: "mid" };
  if (n >= 7) return { text: "text-[#e2671b]", bar: "bg-[#f08a3e]", soft: "bg-[#f08a3e]/[0.18] text-[#c2541a]", avatar: "bg-[#f08a3e]", key: "low" };
  return { text: "text-[#c23b17]", bar: "bg-[#c23b17]", soft: "bg-[#c23b17]/[0.12] text-[#b3361a]", avatar: "bg-[#c23b17]", key: "fail" };
}
export const TIERS = [
  { label: "14+", cls: "bg-[#2fa862]" }, { label: "10–14", cls: "bg-navy" }, { label: "7–10", cls: "bg-[#f08a3e]" }, { label: "<7", cls: "bg-[#c23b17]" },
];

export const VERDICT: Record<string, { label: string; cls: string; dot: string }> = {
  pass: { label: "Réussi", cls: "bg-[#2fa862]/[0.12] text-[#1f7a44] ring-[#2fa862]/25", dot: "bg-[#2fa862]" },
  review: { label: "À statuer", cls: "bg-[#f08a3e]/[0.14] text-[#b54d14] ring-[#f08a3e]/30", dot: "bg-[#f08a3e]" },
  fail: { label: "Échoué", cls: "bg-[#c23b17]/10 text-[#b3361a] ring-[#c23b17]/25", dot: "bg-[#c23b17]" },
};

export function Pill({ cls, children, title }: { cls: string; children: React.ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>{children}</span>;
}
export const Dot = ({ cls }: { cls: string }) => <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />;

export function VerdictPill({ verdict, status, forced, manual }: { verdict: Verdict; status: string; forced?: boolean; manual?: boolean }) {
  if (status === "absent") return <span className="rounded-full border border-dashed border-line-strong px-2.5 py-0.5 text-xs text-muted">Absent</span>;
  if (status === "in_progress") return <Pill cls="bg-[#2563eb]/10 text-[#1d4ed8] ring-[#2563eb]/25"><span className="h-1.5 w-1.5 rounded-full bg-[#2563eb] animate-pulse" />En cours</Pill>;
  if (!verdict) return <Pill cls="bg-fg/5 text-muted ring-fg/10">{status === "terminated" ? "Arrêté" : "Rendu"}</Pill>;
  const v = VERDICT[verdict];
  return (
    <Pill cls={v.cls} title={forced ? "Décision forcée par l'équipe" : manual ? "Une réponse rédigée attend sa correction" : undefined}>
      <Dot cls={v.dot} />{v.label}{forced ? " *" : ""}
    </Pill>
  );
}

export function Avatar({ first, last, note, size = 30 }: { first: string; last: string; note: number | null; size?: number }) {
  const ini = ((first[0] || "") + (last[0] || "")).toUpperCase() || "?";
  return (
    <span style={{ width: size, height: size }} className={`inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${tier(note).avatar}`}>{ini}</span>
  );
}

export const fmt20 = (n: number | null | undefined) => (n == null ? "—" : (Math.round(n * 10) / 10).toString().replace(".", ","));

/** Note sur 20 en gras, colorée selon son palier, avec sa barre. */
export function NoteBar({ value, width = "w-40" }: { value: number | null; width?: string }) {
  if (value == null) return <span className="text-faint">—</span>;
  const t = tier(value);
  return (
    <span className="inline-flex items-center gap-3 tabular-nums">
      <span className={`w-10 font-bold ${t.text}`}>{fmt20(value)}</span>
      <span className={`relative h-1.5 ${width} overflow-hidden rounded-full bg-fg/10`} aria-hidden>
        <span className={`absolute inset-y-0 left-0 rounded-full ${t.bar}`} style={{ width: `${Math.max(2, Math.min(100, (value / 20) * 100))}%` }} />
      </span>
    </span>
  );
}
/** Compatibilité avec les vues précédentes */
export const Score = ({ value }: { value: number | null; pass?: number; fail?: number }) => <NoteBar value={value} width="w-20" />;

export function Stat({ label, value, unit, hint, dark, tone }: {
  label: string; value: React.ReactNode; unit?: string; hint?: React.ReactNode; dark?: boolean; tone?: string;
}) {
  return (
    <div className={`rounded-2xl px-5 py-4 ${dark ? "bg-navy text-white shadow-[0_12px_28px_-16px_rgba(10,16,71,0.8)]" : "border border-line bg-surface shadow-[0_1px_2px_rgba(15,22,64,0.04)]"}`}>
      <div className={`text-sm ${dark ? "text-white/80" : "text-fg/80"}`}>{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`font-display text-[32px] leading-none tabular-nums ${dark ? "text-[#ff8a3d]" : tone || "text-navy"}`}>{value}</span>
        {unit && <span className={`text-base ${dark ? "text-white/70" : "text-muted"}`}>{unit}</span>}
      </div>
      {hint && <div className={`mt-2 text-xs ${dark ? "text-white/70" : "text-muted"}`}>{hint}</div>}
    </div>
  );
}
/** Ancienne carte chiffrée, gardée pour les pages déjà écrites */
export const Kpi = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string }) => <Stat label={label} value={value} hint={hint} />;

/** Répartition des notes : 7 barres de 0 à 20, colorées par palier. */
export function Histogram({ bins }: { bins: number[] }) {
  const max = Math.max(1, ...bins);
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
      <div className="text-sm text-fg/80">Répartition des notes</div>
      <div className="mt-2 flex h-[58px] items-end gap-1.5">
        {bins.map((n, k) => {
          const mid = ((k + 0.5) / bins.length) * 20;
          return (
            <div key={k} className="flex flex-1 flex-col items-center justify-end gap-1">
              {n > 0 && <span className="text-[10px] font-semibold leading-none text-fg/70 tabular-nums">{n}</span>}
              <span className={`w-full rounded-t-[3px] ${tier(mid).bar}`} style={{ height: `${n ? Math.max(8, (n / max) * 44) : 2}px`, opacity: n ? 1 : 0.25 }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between border-t border-line pt-1 text-[10px] text-muted"><span>0</span><span>10</span><span>20</span></div>
    </div>
  );
}

/** Anneau de moyenne pour les cartes d'examen. */
export function Donut({ value, size = 40 }: { value: number | null; size?: number }) {
  const r = 16, c = 2 * Math.PI * r, p = value == null ? 0 : Math.max(0, Math.min(1, value / 20));
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="5" className="stroke-fg/10" />
      {value != null && <circle cx="20" cy="20" r={r} fill="none" strokeWidth="5" strokeLinecap="round" stroke="currentColor"
        className={tier(value).text} strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 20 20)" />}
    </svg>
  );
}

/** Ancienne barre empilée réussi / à statuer / échoué */
export function VerdictBar({ pass, review, fail }: { pass: number; review: number; fail: number }) {
  const total = pass + review + fail;
  if (!total) return <div className="h-1.5 rounded-full bg-fg/5" />;
  const w = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-fg/5" title={`${pass} réussi(s), ${review} à statuer, ${fail} échoué(s)`}>
      <span className="bg-[#2fa862]" style={{ width: w(pass) }} /><span className="bg-[#f08a3e]" style={{ width: w(review) }} /><span className="bg-[#c23b17]" style={{ width: w(fail) }} />
    </div>
  );
}

export function Breadcrumb({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-2 text-sm">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span className="text-faint">›</span>}
          {it.href ? <Link href={it.href} className="text-muted hover:text-fg">{it.label}</Link> : <span className="font-medium text-fg">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export const PageTitle = ({ children }: { children: React.ReactNode }) => (
  <h1 className="font-display text-[34px] uppercase leading-[1.05] tracking-tight text-navy break-words">{children}</h1>
);

export const fmtDate = (d?: string | null, withTime = false) => d
  ? new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Europe/Paris" })
  : "";
export const fmtDay = (d?: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" }) : "";
export const fmtTime = (d?: string | null) => d ? new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", ":") : "";
export const fmtDuration = (s: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min ${String(sec).padStart(2, "0")} s`;
};

/** Pastilles et sous-titres d'un examen selon sa période. */
export function examState(t: { is_published: boolean; opens_at?: string | null; closes_at?: string | null }, live = 0) {
  const now = Date.now();
  if (!t.is_published) return { key: "draft", label: "Brouillon", pill: "bg-fg/5 text-muted ring-fg/10", dot: "bg-muted", accent: "" };
  if (live > 0 || ((!t.opens_at || +new Date(t.opens_at) <= now) && (!t.closes_at || +new Date(t.closes_at) > now) && (t.opens_at || t.closes_at)))
    return { key: "live", label: "En cours", pill: "bg-[#2fa862]/[0.12] text-[#1f7a44] ring-[#2fa862]/25", dot: "bg-[#2fa862] animate-pulse", accent: "before:bg-[#2fa862]" };
  if (t.opens_at && +new Date(t.opens_at) > now) return { key: "soon", label: "À venir", pill: "bg-navy/[0.08] text-navy ring-navy/15", dot: "bg-navy", accent: "before:bg-navy" };
  if (t.closes_at && +new Date(t.closes_at) <= now) return { key: "done", label: "Terminé", pill: "bg-fg/5 text-fg/80 ring-fg/10", dot: "bg-fg/60", accent: "" };
  return { key: "open", label: "Ouvert", pill: "bg-[#2fa862]/[0.12] text-[#1f7a44] ring-[#2fa862]/25", dot: "bg-[#2fa862]", accent: "before:bg-[#2fa862]" };
}
