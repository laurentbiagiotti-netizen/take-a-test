import { createClient } from "@/lib/supabase/server";
import { StatsTable, type ItemStat } from "@/components/admin/StatsTable";
import { Stat } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/**
 * Analyse par question, sur les copies terminées.
 * Réussite : part des points obtenus. Discrimination : réussite du quart des
 * meilleurs moins celle du quart des plus faibles (0,30 et plus = bonne question,
 * moins de 0,15 = elle ne départage pas). Distracteurs : mauvaises réponses de QCM
 * que personne n'a choisies. Fiable à partir de 30 copies.
 */
export default async function Stats({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data, error }, { data: picks }, { data: qs }] = await Promise.all([
    supabase.rpc("item_stats", { p_test: id }),
    supabase.rpc("option_stats", { p_test: id }),
    supabase.from("questions").select("id, type, options").eq("test_id", id).in("type", ["mcq_single", "mcq_multi"]),
  ]);
  const ids = (qs || []).map((q: any) => q.id);
  const { data: keys } = ids.length ? await supabase.from("answer_keys").select("question_id, correct").in("question_id", ids) : { data: [] as any[] };
  const good = new Map((keys || []).map((k: any) => [k.question_id, new Set((Array.isArray(k.correct) ? k.correct : []).map(String))]));
  const opts = new Map((qs || []).map((q: any) => [q.id, Array.isArray(q.options) ? q.options : []]));
  const chosen: Record<string, Record<string, number>> = picks || {};
  const items: ItemStat[] = (data?.questions || []).map((i: ItemStat) => {
    const o: any[] | undefined = opts.get(i.id);
    const unused = o && i.n >= 10 ? o.filter((x) => !good.get(i.id)?.has(String(x.id)) && !(chosen[i.id]?.[String(x.id)] > 0)).map((x) => String(x.text || "").slice(0, 80)) : [];
    return { ...i, unused };
  });
  const flagged = items.filter((i) => i.alerte);
  const weak = items.filter((i) => i.n >= 10 && i.discrimination < 0.15);
  const dead = items.filter((i) => i.unused?.length);
  return (
    <main className="space-y-5 px-4 py-6 sm:px-8">
      {error && <p className="rounded-xl bg-[#c23b17]/10 px-4 py-2.5 text-sm text-[#b3361a]">{error.message}</p>}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat dark label="Copies analysées" value={data?.copies ?? 0} hint="alertes dès 10 copies, fiables vers 30" />
        <Stat label="Questions à revoir" value={flagged.length} tone={flagged.length ? "text-[#c23b17]" : undefined} hint="trop faciles, trop difficiles ou qui ne départagent pas" />
        <Stat label="Ne départagent pas" value={weak.length} hint="discrimination sous 0,15" />
        <Stat label="Réponses jamais choisies" value={dead.reduce((s, i) => s + (i.unused?.length || 0), 0)} hint={`dans ${dead.length} QCM : distracteurs à réécrire`} />
      </section>
      <p className="max-w-3xl text-sm text-muted">
        Discrimination : réussite du quart des meilleurs étudiants moins celle du quart des plus faibles. À 0,30 et plus, la question départage bien ;
        sous 0,15, les bons ne la réussissent pas mieux que les autres. Une mauvaise réponse que personne ne choisit ne sert à rien : remplacez-la par une erreur plausible.
      </p>
      <StatsTable items={items} />
    </main>
  );
}
