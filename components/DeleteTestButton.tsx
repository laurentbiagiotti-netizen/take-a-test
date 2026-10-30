"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteTestButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  return (
    <button
      className="text-sm text-danger hover:underline"
      onClick={async () => {
        if (!confirm(`Supprimer « ${title} » ?\n\nLes questions, tentatives, réponses, invitations et journaux seront aussi supprimés. Action irréversible.`)) return;
        const supabase = createClient();
        const { error } = await supabase.from("tests").delete().eq("id", id);
        if (error) return alert(error.message);
        router.refresh();
      }}
    >Supprimer</button>
  );
}
