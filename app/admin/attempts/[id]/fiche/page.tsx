import FicheJury from "@/components/admin/FicheJury";

export const dynamic = "force-dynamic";

/** Fiche jury d'un candidat, à imprimer ou enregistrer en PDF. */
export default async function Fiche({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FicheJury id={id} />;
}
