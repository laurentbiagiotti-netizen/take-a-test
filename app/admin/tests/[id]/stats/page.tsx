import { createClient } from "@/lib/supabase/server";
import { StatsTable, type ItemStat } from "@/components/admin/StatsTable";

export const dynamic = "force-dynamic";

/**
 * Statistiques par question, sur les copies terminées.
 * Réussite : part des points obtenus. Discrimination : réussite du quart des
 * meilleurs candidats moins celle du quart des plus faibles (0,3 et plus = bonne
 * question, moins de 0,15 = elle ne départage pas). Fiable à partir de 30 copies.
 */
export default async function Stats({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: test } = await supabase.from("tests").select("title").eq("id", id).single();
  const { data, error } = await supabase.rpc("item_stats", { p_test: id });
  const items: ItemStat[] = data?.questions || [];
  const flagged = items.filter((i) => i.alerte);
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <a href={`/admin/tests/${id}/attempts`} className="text-sm text-muted">← Tentatives</a>
      <h1 className="h1 mt-2">Statistiques des questions · {test?.title}</h1>
      {error && <p className="text-danger mt-3">{error.message}</p>}
      <p className="text-sm text-muted mt-2 max-w-3xl">
        Calculées sur {data?.copies ?? 0} copie(s) terminée(s). Une question est signalée quand presque tout le monde la réussit,
        quand presque personne ne la réussit, ou quand les bons candidats ne la réussissent pas mieux que les autres.
        Les alertes n&apos;apparaissent qu&apos;à partir de 10 copies par question ; les chiffres deviennent fiables vers 30.
      </p>
      {flagged.length > 0 && <p className="mt-3 text-warn">{flagged.length} question(s) à revoir.</p>}
      <StatsTable items={items} />
    </main>
  );
}
