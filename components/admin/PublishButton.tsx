"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/Toaster";
import { createClient } from "@/lib/supabase/client";
import { FORMATIONS } from "@/lib/excel/bank";

/**
 * Publier un brouillon pour une promo (formation visée), ou le repasser en
 * brouillon. La promo choisie est enregistrée sur l'épreuve et sert aussi
 * à l'import des questions de la banque.
 */
export default function PublishButton({ id, title, published, questions, formation, className, onDone }: {
  id: string; title: string; published: boolean; questions: number; formation?: string | null;
  className?: string; onDone?: (patch: { is_published: boolean; formation?: string | null }) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const known = formation && (FORMATIONS as readonly string[]).includes(formation);
  const [promo, setPromo] = useState<string>(formation ? (known ? formation : "__autre") : "");
  const [other, setOther] = useState<string>(formation && !known ? formation : "");

  const save = async (patch: { is_published: boolean; formation?: string | null }) => {
    setBusy(true);
    const { error } = await createClient().from("tests").update(patch).eq("id", id);
    setBusy(false);
    if (error) return notify(error.message);
    notify(patch.is_published ? `Épreuve publiée${patch.formation ? ` pour ${patch.formation}` : ""}.` : "Épreuve repassée en brouillon.", "ok");
    setOpen(false);
    onDone?.(patch);
    router.refresh();
  };

  const click = () => {
    if (published) {
      if (confirm(`Repasser « ${title} » en brouillon ?\n\nLes candidats ne pourront plus la commencer ; les copies en cours ne sont pas touchées.`)) save({ is_published: false });
      return;
    }
    if (questions === 0) return notify("Ajoutez au moins une question avant de publier.");
    setOpen(true);
  };

  const chosen = promo === "__autre" ? other.trim() : promo;

  return (
    <>
      <button className={className ?? (published ? "btn-secondary !py-1.5" : "btn !py-1.5")} onClick={click} disabled={busy}>
        {busy ? "…" : published ? "Dépublier" : "Publier"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Publier l'épreuve" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="h2">Publier « {title} »</h2>
              <p className="text-sm text-muted mt-1">Les candidats inscrits pourront la commencer dans sa fenêtre d&apos;ouverture.</p>
            </div>
            <label className="block text-sm">Pour quelle promo ?
              <select className="input mt-1" value={promo} onChange={(e) => setPromo(e.target.value)}>
                <option value="">Toutes les promos (épreuve commune)</option>
                {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                <option value="__autre">Autre promo…</option>
              </select>
            </label>
            {promo === "__autre" && (
              <input className="input" autoFocus maxLength={100} placeholder="Ex. Bachelor 1 Cybersécurité, session de mars" value={other} onChange={(e) => setOther(e.target.value)} />
            )}
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn" disabled={busy || (promo === "__autre" && !other.trim())}
                onClick={() => save({ is_published: true, formation: chosen || null })}>Publier</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
