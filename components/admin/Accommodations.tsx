"use client";
import { useEffect, useState } from "react";
import { notify } from "@/components/Toaster";
import { createClient } from "@/lib/supabase/client";

type Row = { email: string; extra_minutes: number; note: string | null };

/**
 * Tiers-temps et aménagements : enregistrés une fois par étudiant (adresse mail),
 * puis ajoutés automatiquement à la durée de toutes ses épreuves.
 */
export default function Accommodations({ students = [] }: { students?: { email: string; name: string }[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState("20");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const scope = new Set(students.map((s) => s.email.toLowerCase()));
  const load = async () => {
    const { data } = await supabase.from("student_accommodations").select("email, extra_minutes, note").order("email");
    setRows((data || []) as Row[]);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = students.length ? rows.filter((r) => scope.has(r.email)) : rows;
  const nameOf = (e: string) => students.find((s) => s.email.toLowerCase() === e)?.name;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = Math.round(Number(minutes));
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return notify("Adresse mail invalide.");
    if (!(m > 0 && m <= 600)) return notify("Indiquez un nombre de minutes entre 1 et 600.");
    setBusy(true);
    const { error } = await supabase.from("student_accommodations").upsert({ email: mail, extra_minutes: m, note: note.trim() || null, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return notify(error.message);
    notify("Tiers-temps enregistré : il s'appliquera à toutes ses prochaines épreuves.", "ok");
    setEmail(""); setNote(""); load();
  };
  const remove = async (r: Row) => {
    if (!confirm(`Retirer le tiers-temps de ${r.email} ?`)) return;
    const { error } = await supabase.from("student_accommodations").delete().eq("email", r.email);
    if (error) return notify(error.message);
    load();
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
      <h2 className="font-display text-lg uppercase text-navy">Tiers-temps et aménagements</h2>
      <p className="mt-1 text-sm text-muted">Saisi une seule fois par étudiant. Le temps est ajouté à chaque épreuve qu&apos;il commence, sans rien régler épreuve par épreuve.</p>
      <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[15rem] flex-1 text-sm font-medium">Étudiant (adresse mail)
          <input className="input mt-1.5" list="acc-students" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@cybersup.ai" />
          <datalist id="acc-students">{students.map((s) => <option key={s.email} value={s.email}>{s.name}</option>)}</datalist>
        </label>
        <label className="w-28 text-sm font-medium">Minutes en plus
          <input className="input mt-1.5" type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="min-w-[12rem] flex-1 text-sm font-medium">Note interne (facultatif)
          <input className="input mt-1.5" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. un tiers du temps, validé par la direction" />
        </label>
        <button className="btn" disabled={busy}>Enregistrer</button>
      </form>
      {shown.length > 0 ? (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {shown.map((r) => (
            <li key={r.email} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium">{nameOf(r.email) || r.email}</span>
              {nameOf(r.email) && <span className="text-muted">{r.email}</span>}
              <span className="rounded-full bg-[#5561c9]/[0.12] px-2.5 py-0.5 text-xs font-semibold text-navy">+{r.extra_minutes} min</span>
              {r.note && <span className="text-muted">{r.note}</span>}
              <button className="ml-auto text-muted hover:text-[#b3361a]" onClick={() => remove(r)}>Retirer</button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-muted">Aucun tiers-temps enregistré{students.length ? " dans cette classe" : ""}.</p>}
    </section>
  );
}
