"use client";

/** Briques de formulaire de l'espace équipe : sections, champs, interrupteurs. */

export function Section({ id, title, desc, children, aside }: { id: string; title: string; desc?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-navy">{title}</h2>
          {desc && <p className="mt-0.5 max-w-2xl text-sm text-muted">{desc}</p>}
        </div>
        {aside}
      </header>
      <div className="space-y-5 px-6 py-5">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className = "" }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-fg">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; hint?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-6 ${disabled ? "opacity-50" : ""}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">{label}</div>
        {hint && <div className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${checked ? "bg-[#2fa862]" : "bg-fg/20"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
        <span className="sr-only">{checked ? "Activé" : "Désactivé"}</span>
      </button>
    </div>
  );
}

export const inputCls = "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

export function Num({ value, onChange, min, max, step, suffix, placeholder, width = "w-28" }: {
  value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; suffix?: string; placeholder?: string; width?: string;
}) {
  return (
    <span className={`inline-flex items-center overflow-hidden rounded-xl border border-line-strong bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 ${width}`}>
      <input className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none" type="number" min={min} max={max} step={step}
        value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      {suffix && <span className="shrink-0 pr-3 text-xs text-muted">{suffix}</span>}
    </span>
  );
}
