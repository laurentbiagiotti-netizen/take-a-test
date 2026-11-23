import { redirect } from "next/navigation";
import Link from "next/link";
import { staffPageGuard } from "@/lib/auth/staff";
import { adminClient } from "@/lib/supabase/admin";
import { googleConfigured, mailDomain, redirectUri } from "@/lib/google";
import { PageTitle, Stat, fmtDate } from "@/components/admin/ui";
import MailAccountActions from "@/components/admin/MailAccountActions";
import AttachButton from "@/components/admin/AttachButton";
import { EXPECTED_MIGRATIONS } from "@/lib/migrations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mails et agenda" };

const ERR: Record<string, string> = {
  config: "La connexion Google n'est pas configurée sur le serveur (voir plus bas).",
  refus: "La connexion a été annulée chez Google.",
  etat: "La connexion a expiré : recommencez.",
  droits: "Il faut accepter les deux autorisations (envoyer des mails, gérer les événements de l'agenda).",
  domaine: `Ce compte n'est pas un compte @${mailDomain()}.`,
  base: "Le compte n'a pas pu être enregistré.", google: "Google a refusé la connexion. Réessayez.",
};
const KIND: Record<string, string> = { convocation: "Convocation", relance: "Relance", rappel_veille: "Rappel de la veille", rappel_10min: "Rappel 10 min avant", report: "Nouvelle date" };
const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Mails et agenda : le compte de l'école qui envoie les convocations et la relance, et le journal des envois. */
export default async function Mails({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const g = await staffPageGuard();
  if ("redirect" in g) redirect(g.redirect);
  if (g.role !== "admin") redirect("/admin");
  const sp = await searchParams;
  const admin = adminClient();
  const [{ data: acc }, { data: logs }, { data: tests }, { data: inbox }, { data: migs }, { data: health }] = await Promise.all([
    admin.from("mail_account").select("email, connected_at, last_error, last_error_at").maybeSingle(),
    admin.from("mail_log").select("id, test_id, email, kind, status, error, tries, updated_at").order("updated_at", { ascending: false }).limit(200),
    admin.from("tests").select("id, title, agenda_keyword, is_published"),
    admin.from("agenda_inbox").select("event_id, title, start_at, email, reason").order("start_at"),
    admin.from("schema_migrations").select("name"),
    admin.from("job_health").select("last_run_at, last_ok_at, last_error, last_error_at, detail").eq("job", "mails").maybeSingle(),
  ]);
  const applied = new Set((migs || []).map((m: any) => m.name));
  const missing = EXPECTED_MIGRATIONS.filter((m) => !applied.has(m));
  const h = health as any;
  const okAgo = h?.last_ok_at ? Math.round((Date.now() - +new Date(h.last_ok_at)) / 60000) : null;
  const failing = !!acc && (okAgo == null || okAgo > 5);
  const dup = new Map<string, string[]>();
  for (const t of (tests || []).filter((t: any) => t.is_published && (t.agenda_keyword || "").trim())) dup.set(norm((t as any).agenda_keyword), [...(dup.get(norm((t as any).agenda_keyword)) || []), (t as any).title]);
  const ambiguous = [...dup.entries()].filter(([, l]) => l.length > 1);
  const keyed = (tests || []).filter((t: any) => t.is_published && (t.agenda_keyword || "").trim());
  const pending = (inbox || []).filter((x: any) => !x.start_at || +new Date(x.start_at) > Date.now());
  const title = new Map((tests || []).map((t: any) => [t.id, t.title]));
  const sent = (logs || []).filter((l: any) => l.status === "sent");
  const ready = googleConfigured();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <PageTitle>Mails et agenda</PageTitle>
      <p className="mt-1.5 text-[15px] text-muted">Un compte Google de l&apos;école envoie les convocations et la relance, et porte les examens dans son agenda.</p>
      {sp.ok && <p className="mt-4 rounded-xl bg-[#2fa862]/[0.12] px-4 py-2.5 text-sm text-[#1f7a44]">Compte relié. Les prochains inscrits recevront leur convocation automatiquement.</p>}
      {sp.erreur && <p className="mt-4 rounded-xl bg-[#c23b17]/10 px-4 py-2.5 text-sm text-[#b3361a]">{ERR[sp.erreur] || "Connexion impossible."}</p>}

      {missing.length > 0 && (
        <div className="mt-4 rounded-xl border border-[#c23b17]/40 bg-[#c23b17]/10 px-4 py-3 text-sm text-[#b3361a]">
          <b>La base n&apos;est pas à jour : {missing.length} migration(s) manquante(s).</b> Tant qu&apos;elles ne sont pas passées, des réglages ne s&apos;enregistrent pas et les envois peuvent s&apos;arrêter.
          <div className="mt-1 font-mono text-xs">{missing.join(", ")}</div>
          <div className="mt-1">À lancer sur le poste qui déploie : <code>./scripts/migrer.sh</code> (le déploiement le fait désormais tout seul).</div>
        </div>
      )}
      {acc && (
        <div className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-2.5 text-sm ${failing ? "border border-[#c23b17]/40 bg-[#c23b17]/10 text-[#b3361a]" : "bg-[#2fa862]/[0.1] text-[#1f7a44]"}`}>
          <span className="font-semibold">{failing ? "La tâche planifiée ne passe plus" : "Tâche planifiée en marche"}</span>
          <span>Dernier passage réussi : {okAgo == null ? "jamais" : okAgo < 1 ? "il y a moins d'une minute" : `il y a ${okAgo} min`}</span>
          {h?.last_error && (!h.last_ok_at || +new Date(h.last_error_at) > +new Date(h.last_ok_at)) && <span className="w-full">Dernière erreur ({fmtDate(h.last_error_at, true)}) : {h.last_error}</span>}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-fg/60">Compte relié</div>
            {acc ? <><div className="mt-1 text-xl font-bold text-navy">{acc.email}</div><div className="text-sm text-muted">depuis le {fmtDate(acc.connected_at, true)}</div></>
              : <div className="mt-1 text-xl font-bold text-navy">Aucun compte</div>}
          </div>
          <MailAccountActions connected={!!acc} />
        </div>
        {acc?.last_error && <p className="mt-4 rounded-xl bg-[#c23b17]/10 px-4 py-2.5 text-sm text-[#b3361a]">Dernier incident ({fmtDate(acc.last_error_at, true)}) : {acc.last_error}. Si les envois sont bloqués, reliez le compte à nouveau.</p>}
        {!acc && <p className="mt-4 text-sm text-muted">Le titulaire du compte doit être présent : après le clic, Google lui demande de se connecter et d&apos;accepter deux autorisations (envoyer des mails en son nom, gérer les événements de son agenda). La plateforme ne lit pas sa boîte.</p>}
        {!ready && (
          <div className="mt-4 rounded-xl bg-[#f08a3e]/[0.12] px-4 py-3 text-sm text-[#a64a12]">
            À faire une fois sur le serveur : ajouter <code>GOOGLE_OAUTH_CLIENT_ID</code> et <code>GOOGLE_OAUTH_CLIENT_SECRET</code> dans <code>.env.production</code>,
            et déclarer cette adresse de redirection dans le client OAuth de Google Cloud : <code className="break-all">{redirectUri()}</code>
          </div>
        )}
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat dark label="Convocations envoyées" value={sent.filter((l: any) => l.kind === "convocation").length} hint="sur les 200 derniers envois" />
        <Stat label="Relances envoyées" value={sent.filter((l: any) => l.kind === "relance").length} hint="une seule par étudiant et par épreuve" />
        <Stat label="Échecs" value={(logs || []).length - sent.length} tone={(logs || []).length - sent.length ? "text-[#c23b17]" : undefined} hint="trois essais, puis abandon" />
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
        <h2 className="font-display text-lg uppercase text-navy">Ce qui part tout seul</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-fg/85">
          <li><b>Convocation</b> : dans la minute qui suit l&apos;inscription d&apos;un étudiant à une épreuve publiée (ou la publication de l&apos;épreuve), avec son lien et son code personnels.</li>
          <li><b>Relance</b> : deux heures après la fin de l&apos;épreuve, une seule fois, aux inscrits qui ne l&apos;ont pas commencée.</li>
          <li><b>Agenda</b> : chaque épreuve publiée et datée devient un événement dans l&apos;agenda du compte, mis à jour si la date ou la salle change.</li>
          <li><b>Tests d&apos;admission à créneaux individuels</b> : un événement « Test technique B3 Cyber - Prénom » par candidat, qui y est invité, avec son lien, son code et les consignes ; un rappel la veille avec le lien, un autre dix minutes avant. Si l&apos;événement est déplacé ou supprimé dans l&apos;agenda, le créneau du candidat suit.</li>
          <li>Rien n&apos;est rétroactif : seuls les étudiants inscrits après la connexion du compte sont convoqués, et seules les épreuves terminées après sont relancées.</li>
          <li>Chaque épreuve peut couper la convocation ou la relance dans ses <b>Réglages</b>, section « Mails et agenda ».</li>
        </ul>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
        <h2 className="font-display text-lg uppercase text-navy">Inscription depuis l&apos;agenda</h2>
        <p className="mt-1 text-sm text-muted">L&apos;agenda du compte est relu toutes les minutes. Un rendez-vous « Test technique B3 Cyber - Prénom » (créé par HubSpot) inscrit son invité à l&apos;épreuve qui porte ce mot-clé, avec ce créneau.</p>
        {keyed.length ? (
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">{keyed.map((t: any) => <li key={t.id} className="rounded-full bg-[#5561c9]/[0.12] px-3 py-1"><b className="text-navy">{t.agenda_keyword}</b> <span className="text-muted">vers</span> <Link className="hover:text-accent" href={`/admin/tests/${t.id}/invites`}>{t.title}</Link></li>)}</ul>
        ) : <p className="mt-3 rounded-xl bg-[#f08a3e]/[0.12] px-4 py-2.5 text-sm text-[#a64a12]">Aucune épreuve publiée n&apos;a de mot-clé d&apos;agenda : rien ne sera inscrit. À régler dans les Réglages de l&apos;épreuve d&apos;admission, section « Mails et agenda ».</p>}
        {ambiguous.map(([k, l]) => (
          <p key={k} className="mt-3 rounded-xl bg-[#c23b17]/10 px-4 py-2.5 text-sm text-[#b3361a]">Le mot-clé « {k} » est porté par {l.length} épreuves publiées ({l.join(", ")}) : les candidats sont inscrits à la plus récente. Gardez-le sur une seule.</p>
        ))}
        {pending.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-semibold text-[#b3361a]">{pending.length} rendez-vous non rattaché(s)</div>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
              {pending.map((x: any) => <li key={x.event_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2"><span className="font-medium">{x.title}</span><span className="text-muted">{fmtDate(x.start_at, true)}{x.email ? ` · ${x.email}` : ""}</span><span className="ml-auto text-xs text-[#b3361a]">{x.reason}</span>
                <AttachButton eventId={x.event_id} title={x.title} email={x.email} tests={(tests || []).map((t: any) => ({ id: t.id, title: t.title, published: t.is_published }))} /></li>)}
            </ul>
            <p className="mt-2 text-xs text-muted">Rattachez-les à une épreuve avec le bouton, ou corrigez le titre dans l&apos;agenda (ajoutez la classe) : ils seront repris dans les dix minutes.</p>
          </div>
        )}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
        <h2 className="px-6 pt-5 font-display text-lg uppercase text-navy">Journal des envois</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-y border-line bg-surface-2/60 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-fg/60">
              <th className="px-6 py-2.5">Date</th><th className="px-3 py-2.5">Étudiant</th><th className="px-3 py-2.5">Épreuve</th><th className="px-3 py-2.5">Mail</th><th className="px-6 py-2.5">État</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {(logs || []).map((l: any) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-6 py-2.5 text-muted">{fmtDate(l.updated_at, true)}</td>
                  <td className="px-3 py-2.5"><Link className="text-navy hover:text-accent" href={`/admin/etudiants/${encodeURIComponent(l.email)}`}>{l.email}</Link></td>
                  <td className="px-3 py-2.5"><Link className="hover:text-accent" href={`/admin/tests/${l.test_id}`}>{title.get(l.test_id) || "Épreuve"}</Link></td>
                  <td className="px-3 py-2.5">{KIND[l.kind] || l.kind}</td>
                  <td className="px-6 py-2.5">{l.status === "sent" ? <span className="font-semibold text-[#1f7a44]">Envoyé</span> : <span className="font-semibold text-[#b3361a]" title={l.error || ""}>Échec ({l.tries}/3)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!(logs || []).length && <p className="px-6 py-10 text-center text-sm text-muted">Aucun mail envoyé pour l&apos;instant.</p>}
      </section>
    </main>
  );
}
