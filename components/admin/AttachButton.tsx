"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/Toaster";

/** « Rattacher à une épreuve » : inscrit l'invité d'un rendez-vous d'agenda à l'épreuve choisie, avec son créneau. */
export default function AttachButton({ eventId, title, email, tests }: { eventId: string; title: string; email: string | null; tests: { id: string; title: string; published: boolean }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const attach = async (testId: string) => {
    setBusy(true);
    const r = await fetch("/api/admin/agenda/attach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event_id: eventId, test_id: testId }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return notify(j.error || "Rattachement impossible.");
    notify(`${j.email} inscrit à « ${j.test} ». Sa convocation part dans la minute si l'épreuve est publiée.`, "ok");
    setOpen(false); router.refresh();
  };
  return (
    <>
      <button className="rounded-lg border border-line-strong bg-surface px-2.5 py-1 text-xs font-semibold text-navy hover:border-accent" onClick={() => setOpen(true)}>Rattacher à une épreuve</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 text-left backdrop-blur-[2px]" role="dialog" aria-modal aria-label="Rattacher à une épreuve" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg uppercase text-navy">Rattacher à une épreuve</h3>
            <p className="mt-1 text-sm text-muted">{title}{email ? ` · ${email}` : ""}. Le candidat sera inscrit avec le créneau du rendez-vous, puis convoqué.</p>
            <div className="mt-4 max-h-[50vh] space-y-1.5 overflow-y-auto">
              {tests.map((t) => (
                <button key={t.id} disabled={busy} onClick={() => attach(t.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-left text-sm hover:border-accent disabled:opacity-50">
                  <span className="truncate font-medium">{t.title}</span><span className="shrink-0 text-xs text-muted">{t.published ? "publiée" : "brouillon : convocation à la publication"}</span>
                </button>
              ))}
              {!tests.length && <p className="text-sm text-muted">Aucune épreuve.</p>}
            </div>
            <div className="mt-4 text-right"><button className="btn-secondary" onClick={() => setOpen(false)}>Annuler</button></div>
          </div>
        </div>
      )}
    </>
  );
}
