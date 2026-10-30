import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Item = {
  id: string; position: number; domain: string | null; variant_group: string | null; type: string; prompt: string;
  n: number; reussite: number; sans_reponse: number; discrimination: number; alerte: string | null;
};

const pct = (x: number) => `${Math.round(x * 100)} %`;

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
  const items: Item[] = data?.questions || [];
  const flagged = items.filter((i) => i.alerte);
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <a href={`/admin/tests/${id}/attempts`} className="text-sm text-muted">← Tentatives</a>
      <h1 className="h1 mt-2">Statistiques des questions · {test?.title}</h1>
      {error && <p className="text-danger mt-3">{error.message}</p>}
      <p className="text-sm text-muted mt-2 max-w-3xl">
        Calculées sur {data?.copies ?? 0} copie(s) terminée(s). Une question est signalée quand presque tout le monde la réussit,
        quand presque personne ne la réussit, ou quand les bons candidats ne la réussissent pas mieux que les autres.
        Les alertes n&apos;apparaissent qu&apos;à partir de 10 copies par question ; les chiffres deviennent fiables vers 30.
      </p>
      {flagged.length > 0 && <p className="mt-3 text-warn">{flagged.length} question(s) à revoir.</p>}
      <table className="mt-6 w-full text-sm">
        <thead className="text-left text-muted">
          <tr><th className="py-2">N°</th><th>Variante</th><th>Domaine</th><th>Question</th><th>Copies</th><th>Réussite</th><th>Sans réponse</th><th title="Quart supérieur moins quart inférieur">Discrimination</th><th>Alerte</th></tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className={`border-t align-top ${i.alerte ? "bg-warn/10" : ""}`}>
              <td className="py-2">{i.position}</td>
              <td className="text-xs text-muted">{i.variant_group ? i.variant_group.split("-").pop() : "-"}</td>
              <td className="text-xs">{i.domain || "-"}</td>
              <td className="max-w-md"><span className="line-clamp-2">{i.prompt}</span></td>
              <td>{i.n}</td>
              <td>{pct(i.reussite)}</td>
              <td>{pct(i.sans_reponse)}</td>
              <td className={i.discrimination < 0.15 ? "text-warn" : i.discrimination >= 0.3 ? "text-ok" : ""}>{i.discrimination.toFixed(2)}</td>
              <td className="text-warn">{i.alerte || ""}</td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan={9} className="py-6 text-center text-muted">Pas encore de copie terminée.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
