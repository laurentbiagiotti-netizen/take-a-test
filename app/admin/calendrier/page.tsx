import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, examState, fmtTime } from "@/components/admin/ui";
import { conflicts, span } from "@/lib/admin/calendar";
import { eventTitle, slotEnd } from "@/lib/exam/convocation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendrier" };

type T = { id: string; title: string; formation: string | null; campus: string | null; room: string | null; is_published: boolean;
  opens_at: string; closes_at: string | null; duration_minutes: number; start: number; end: number;
  /** Créneau individuel d'un candidat (test d'admission) */
  slot?: { email: string; href: string } };
const dayKey = (d: Date | number | string) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
const addDays = (k: string, n: number) => { const d = new Date(`${k}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monday = (k: string) => addDays(k, -((new Date(`${k}T12:00:00Z`).getUTCDay() + 6) % 7));
const label = (k: string, o: Intl.DateTimeFormatOptions) => new Date(`${k}T12:00:00Z`).toLocaleDateString("fr-FR", { ...o, timeZone: "UTC" });
const BORDER: Record<string, string> = { live: "border-[#2fa862]", open: "border-[#2fa862]", soon: "border-navy", done: "border-fg/30", draft: "border-dashed border-line-strong" };

export default async function Calendrier({ searchParams }: { searchParams: Promise<{ vue?: string; d?: string }> }) {
  const sp = await searchParams;
  const vue = sp.vue === "semaine" ? "semaine" : "mois";
  const today = dayKey(Date.now());
  const d = /^\d{4}-\d{2}-\d{2}$/.test(sp.d || "") ? (sp.d as string) : today;
  const supabase = await createClient();
  const { data } = await supabase.from("tests").select("id, title, formation, campus, room, is_published, opens_at, closes_at, duration_minutes").order("opens_at");
  const dated: T[] = (data || []).filter((t: any) => t.opens_at).map((t: any) => ({ ...t, ...span(t) }));
  const undated = (data || []).filter((t: any) => !t.opens_at);
  const clash = conflicts(dated);

  const first = vue === "mois" ? monday(`${d.slice(0, 7)}-01`) : monday(d);
  const nDays = vue === "mois" ? 42 : 7;
  const days = Array.from({ length: nDays }, (_, i) => addDays(first, i));
  // Créneaux individuels des candidats (tests d'admission), fixés dans l'onglet Inscriptions ou repris de l'agenda
  const { data: slotRows } = await supabase.from("invites").select("id, test_id, email, full_name, extra_minutes, slot_at").eq("preview", false).not("slot_at", "is", null);
  const byId = new Map((data || []).map((t: any) => [t.id, t]));
  const slots: T[] = (slotRows || []).filter((i: any) => byId.has(i.test_id)).map((i: any) => {
    const t: any = byId.get(i.test_id);
    const first = (i.full_name || "").trim().split(/\s+/)[0] || i.email.split("@")[0];
    const start = +new Date(i.slot_at);
    return { id: `c-${i.id}`, title: eventTitle(t.formation, first), formation: t.title, campus: null, room: "À distance", is_published: t.is_published, opens_at: i.slot_at, closes_at: null,
      duration_minutes: t.duration_minutes, start, end: +new Date(slotEnd(i.slot_at, t.duration_minutes, i.extra_minutes || 0)), slot: { email: i.email, href: `/admin/tests/${t.id}/invites` } };
  });
  // Conflit de créneaux : le même candidat convoqué deux fois sur des horaires qui se chevauchent
  for (let a = 0; a < slots.length; a++) for (let b = a + 1; b < slots.length; b++) {
    const x = slots[a], y = slots[b];
    if (x.slot!.email !== y.slot!.email || x.start >= y.end || y.start >= x.end) continue;
    clash.set(x.id, [...(clash.get(x.id) || []), `Même candidat que « ${y.formation} »`]);
    clash.set(y.id, [...(clash.get(y.id) || []), `Même candidat que « ${x.formation} »`]);
  }
  const onDay = (k: string) => [...dated, ...slots].filter((t) => dayKey(t.start) <= k && dayKey(t.end - 1) >= k).sort((a, b) => a.start - b.start);
  const prev = vue === "mois" ? addDays(`${d.slice(0, 7)}-01`, -1).slice(0, 7) + "-01" : addDays(d, -7);
  const next = vue === "mois" ? addDays(`${d.slice(0, 7)}-28`, 7).slice(0, 7) + "-01" : addDays(d, 7);
  const title = vue === "mois" ? label(`${d.slice(0, 7)}-01`, { month: "long", year: "numeric" })
    : `Semaine du ${label(first, { day: "numeric", month: "long" })} au ${label(addDays(first, 6), { day: "numeric", month: "long", year: "numeric" })}`;
  const inView = [...dated, ...slots].filter((t) => dayKey(t.end - 1) >= days[0] && dayKey(t.start) <= days[nDays - 1] && clash.has(t.id));
  const href = (v: string, k: string) => `/admin/calendrier?vue=${v}&d=${k}`;

  const Card = ({ t, k, full }: { t: T; k: string; full?: boolean }) => {
    const st = examState(t as any);
    const c = clash.get(t.id);
    const sameDay = dayKey(t.start) === dayKey(t.end - 1);
    const hours = sameDay ? `${fmtTime(t.opens_at)} à ${fmtTime(new Date(t.end).toISOString())}` : dayKey(t.start) === k ? `dès ${fmtTime(t.opens_at)}` : dayKey(t.end - 1) === k ? `jusqu'à ${fmtTime(new Date(t.end).toISOString())}` : "toute la journée";
    return (
      <Link href={t.slot ? t.slot.href : `/admin/tests/${t.id}`} title={c ? c.join("\n") : t.slot ? `${t.title} · ${t.slot.email}` : t.title}
        className={`block rounded-lg border-l-[3px] px-2 py-1.5 text-left transition-colors hover:bg-fg/[0.05] ${c ? "border-[#c23b17] bg-[#c23b17]/[0.07]" : t.slot ? "border-accent bg-accent/[0.07]" : `${BORDER[st.key] || "border-line-strong"} bg-fg/[0.03]`}`}>
        <div className="text-[11px] tabular-nums text-muted">{hours}</div>
        <div className={`text-[13px] font-semibold leading-snug text-navy ${full ? "" : "truncate"}`}>{t.title}</div>
        {(full || c) && <div className="mt-0.5 text-[11px] text-muted">{t.slot ? `${t.slot.email} · ${t.formation} · à distance` : [t.formation, t.room, t.campus].filter(Boolean).join(" · ") || "Promo et salle non précisées"}</div>}
        {c && <div className="mt-0.5 text-[11px] font-semibold text-[#b3361a]">Conflit{full ? ` : ${Array.from(new Set(c)).join(" ; ")}` : ""}</div>}
      </Link>
    );
  };

  return (
    <main className="mx-auto max-w-[88rem] px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle>Calendrier</PageTitle>
          <p className="mt-1.5 text-[15px] text-muted first-letter:uppercase">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-fg/[0.06] p-1 text-sm">
            {(["mois", "semaine"] as const).map((v) => (
              <Link key={v} href={href(v, d)} className={`rounded-lg px-3 py-1.5 capitalize ${v === vue ? "bg-surface font-semibold text-navy shadow-sm" : "text-fg/70 hover:text-fg"}`}>{v}</Link>
            ))}
          </div>
          <Link href={href(vue, prev)} className="btn-secondary !px-3" aria-label="Période précédente">‹</Link>
          <Link href={href(vue, today)} className="btn-secondary">Aujourd&apos;hui</Link>
          <Link href={href(vue, next)} className="btn-secondary !px-3" aria-label="Période suivante">›</Link>
        </div>
      </div>

      {inView.length > 0 && (
        <div className="mt-5 rounded-2xl border border-[#c23b17]/30 bg-[#c23b17]/[0.06] px-5 py-4">
          <div className="text-sm font-semibold text-[#b3361a]">{inView.length} épreuve(s) en conflit sur cette période</div>
          <ul className="mt-2 space-y-1 text-sm">
            {inView.map((t) => (
              <li key={t.id}><Link className="font-medium text-navy hover:text-accent" href={t.slot ? t.slot.href : `/admin/tests/${t.id}/questions?vue=reglages#dates`}>{t.title}</Link>
                <span className="text-muted"> · {label(dayKey(t.start), { weekday: "short", day: "numeric", month: "short" })} {fmtTime(t.opens_at)} · {Array.from(new Set(clash.get(t.id))).join(" ; ")}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
        <div className="grid grid-cols-7 border-b border-line bg-surface-2/60 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-fg/60">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((x) => <div key={x} className="py-2.5">{x}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((k, i) => {
            const list = onDay(k);
            const out = vue === "mois" && k.slice(0, 7) !== d.slice(0, 7);
            return (
              <div key={k} className={`min-w-0 border-b border-line p-1.5 ${i % 7 ? "border-l" : ""} ${vue === "mois" ? "min-h-[7.5rem]" : "min-h-[26rem]"} ${out ? "bg-surface-2/50" : ""}`}>
                <Link href={href("semaine", k)} className={`mb-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm tabular-nums ${k === today ? "bg-accent font-bold text-white" : out ? "text-faint" : "text-fg/80 hover:bg-fg/[0.06]"}`}>
                  {Number(k.slice(8))}
                </Link>
                <div className="space-y-1">
                  {(vue === "mois" ? list.slice(0, 3) : list).map((t) => <Card key={t.id} t={t} k={k} full={vue === "semaine"} />)}
                  {vue === "mois" && list.length > 3 && <Link href={href("semaine", k)} className="block px-2 text-[11px] font-medium text-accent">+ {list.length - 3} autre(s)</Link>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-navy" />Épreuve datée</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-accent" />Créneau d&apos;un candidat (test d&apos;admission) : {slots.length} à ce jour</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-[#c23b17]" />Conflit</span>
      </p>
      {undated.length > 0 && (
        <p className="mt-3 text-sm text-muted">Sans date d&apos;ouverture (normal pour une épreuve à créneaux individuels) : {undated.map((t: any, i: number) => (
          <span key={t.id}>{i > 0 && ", "}<Link className="text-navy hover:text-accent" href={`/admin/tests/${t.id}/questions?vue=reglages#dates`}>{t.title}</Link></span>
        ))}</p>
      )}
    </main>
  );
}
