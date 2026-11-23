import FicheJury from "@/components/admin/FicheJury";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fiches jury" };

/** Plusieurs fiches jury à la suite, une par page, pour un seul PDF. */
export default async function Fiches({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const list = (ids || "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 80);
  return (
    <div>
      <div className="mx-auto flex max-w-[820px] items-center justify-between px-6 pt-8 print:hidden">
        <span className="text-sm text-muted">{list.length} fiche(s) jury, une par page</span>
        <PrintButton label="Enregistrer en un seul PDF" />
      </div>
      {!list.length && <p className="px-6 py-16 text-center text-muted">Aucune copie sélectionnée.</p>}
      {list.map((id, i) => <div key={id} className={i ? "break-before-page" : ""}><FicheJury id={id} bare /></div>)}
    </div>
  );
}
