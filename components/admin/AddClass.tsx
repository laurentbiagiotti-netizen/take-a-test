"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/Toaster";
import { createClient } from "@/lib/supabase/client";

/** Petit bouton « + Classe » : crée une classe, proposée ensuite à la publication et dans les filtres. */
export default function AddClass() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [campus, setCampus] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, " ");
    if (!n) return;
    setBusy(true);
    const { error } = await createClient().from("classes").insert({ name: n, campus: campus || null });
    setBusy(false);
    if (error) return notify(error.code === "23505" ? "Cette classe existe déjà." : error.message);
    notify(`Classe « ${n} » créée.`, "ok");
    setName(""); setOpen(false); router.refresh();
  };
  return (
    <div className="relative">
      <button className="btn-secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>+ Classe</button>
      {open && (
        <form onSubmit={save} className="absolute right-0 z-20 mt-2 w-80 space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_18px_40px_-20px_rgba(15,22,64,0.5)]">
          <label className="block text-sm font-medium">Nom de la classe
            <input autoFocus className="input mt-1.5" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Bachelor 2 Cybersécurité Lille" />
          </label>
          <label className="block text-sm font-medium">Campus
            <select className="input mt-1.5" value={campus} onChange={(e) => setCampus(e.target.value)}>
              <option value="">Non précisé</option><option>Puteaux</option><option>Lille</option><option>Marseille</option><option>À distance</option>
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
            <button className="btn" disabled={busy || !name.trim()}>Créer</button>
          </div>
        </form>
      )}
    </div>
  );
}
