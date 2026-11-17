"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/Toaster";
import { createClient } from "@/lib/supabase/client";

/** Publier un brouillon (ou le repasser en brouillon) depuis la liste des épreuves. */
export default function PublishButton({ id, title, published, questions, className }: {
  id: string; title: string; published: boolean; questions: number; className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (!published && questions === 0) return notify("Ajoutez au moins une question avant de publier.");
    const msg = published
      ? `Repasser « ${title} » en brouillon ?\n\nLes candidats ne pourront plus la commencer ; les copies en cours ne sont pas touchées.`
      : `Publier « ${title} » ?\n\nLes candidats inscrits pourront la commencer dans sa fenêtre d'ouverture.`;
    if (!confirm(msg)) return;
    setBusy(true);
    const { error } = await createClient().from("tests").update({ is_published: !published }).eq("id", id);
    setBusy(false);
    if (error) return notify(error.message);
    notify(published ? "Épreuve repassée en brouillon." : "Épreuve publiée.", "ok");
    router.refresh();
  };
  return (
    <button className={className ?? (published ? "btn-secondary !py-1.5" : "btn !py-1.5")} onClick={toggle} disabled={busy}>
      {busy ? "…" : published ? "Dépublier" : "Publier"}
    </button>
  );
}
