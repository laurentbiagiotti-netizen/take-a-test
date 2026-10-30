import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import ExamRoom from "@/components/ExamRoom";
import UnlockForm from "@/components/UnlockForm";
import IdentityCheck from "@/components/IdentityCheck";
import { appUrl } from "@/lib/security/env";
import { mergeKeys, sebRequired, verifySeb } from "@/lib/security/seb";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Panel({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="max-w-xl mx-auto p-10 text-center">
      <h1 className="h1">{title}</h1>
      <div className="text-muted mt-3 space-y-2">{children}</div>
      <div className="mt-6"><a href="/dashboard" className="btn-secondary">Retour au tableau de bord</a></div>
    </main>
  );
}

export default async function TakeTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return <Panel title="Examen introuvable" />;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/test/${id}`);

  const admin = adminClient();
  const { data: test } = await admin.from("tests").select("id, require_seb, is_published, seb_accept_config_key").eq("id", id).maybeSingle();
  if (!test?.is_published) return <Panel title="Examen introuvable" />;

  // Safe Exam Browser : vérifié sur la requête de la page elle-même, puis
  // à nouveau sur chaque appel d'API de l'examen.
  if (sebRequired(test.require_seb)) {
    const h = await headers();
    const path = h.get("x-cx-path") || `/test/${id}`;
    const { data: sec } = await admin.from("test_secrets")
      .select("seb_browser_exam_keys, seb_config_keys").eq("test_id", id).maybeSingle();
    const keys = mergeKeys({ bek: sec?.seb_browser_exam_keys, ck: sec?.seb_config_keys }, test.seb_accept_config_key);
    const r = await verifySeb(appUrl() + path, h, keys);
    if (!r.ok) {
      return (
        <Panel title="Ouvrez cet examen dans Safe Exam Browser">
          <p>Cet examen se passe uniquement dans Safe Exam Browser (SEB), qui verrouille votre ordinateur pendant l&apos;épreuve.</p>
          <p>Installez SEB, puis ouvrez le fichier de configuration <code>.seb</code> transmis par l&apos;école : l&apos;examen se lancera automatiquement.</p>
          {r.reason === "no_keys_configured" && <p className="text-danger text-sm">Configuration SEB incomplète côté école : prévenez le surveillant.</p>}
          <div className="flex gap-3 justify-center pt-3">
            <a href="https://safeexambrowser.org/download_en.html" className="btn" target="_blank" rel="noreferrer">Télécharger SEB</a>
          </div>
        </Panel>
      );
    }
  }

  const { data: st, error } = await admin.rpc("exam_prepare", { p_user: user.id, p_test: id });
  if (error) {
    const code = (error.message || "").split(":")[0];
    if (code === "not_invited") {
      return (
        <Panel title="Vous n'êtes pas sur la liste des candidats">
          <p>Cet examen est réservé aux candidats invités. L&apos;adresse de votre compte (<code>{user.email}</code>) n&apos;y figure pas.</p>
          <p>Si vous avez reçu une invitation, reconnectez-vous avec l&apos;adresse exacte utilisée par l&apos;école.</p>
        </Panel>
      );
    }
    return <Panel title="Examen indisponible" />;
  }

  if (st.state === "not_open") {
    return <Panel title={st.title}><p>L&apos;examen ouvre le {new Date(st.opens_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.</p></Panel>;
  }
  if (st.state === "closed") return <Panel title={st.title}><p>La période de passage est terminée.</p></Panel>;
  if (["submitted", "terminated", "expired"].includes(st.state)) {
    return (
      <Panel title="Copie enregistrée">
        <p>{st.state === "terminated" ? "Votre épreuve a été interrompue par le dispositif de surveillance." :
            st.state === "expired" ? "Le temps imparti est écoulé : vos réponses enregistrées ont été transmises." :
            "Vos réponses ont été transmises."}</p>
        <p>Les résultats vous seront communiqués par l&apos;école.</p>
      </Panel>
    );
  }

  if (!st.unlocked) {
    return (
      <main className="max-w-md mx-auto p-10">
        <h1 className="h1">{st.title}</h1>
        <p className="text-muted mt-2">Saisissez le code d&apos;accès reçu par e-mail pour continuer.</p>
        <UnlockForm testId={id} />
      </main>
    );
  }

  if (st.identity_status === "pending" || st.identity_status === "rejected") {
    return <IdentityCheck testId={id} title={st.title} rejected={st.identity_status === "rejected"} />;
  }
  if (st.state === "pending" && st.identity_status === "submitted" && st.id_verify_before_start) {
    return (
      <Panel title="Identité en cours de vérification">
        <p>Un surveillant vérifie votre pièce d&apos;identité. Rechargez cette page dans quelques instants.</p>
        <p><a className="underline" href={`/test/${id}`}>Recharger</a></p>
      </Panel>
    );
  }

  // Reprise : le navigateur d'origine garde son cookie de session et reprend ;
  // un autre appareil est refusé par /begin (ExamRoom affiche le message).
  return (
    <ExamRoom
      testId={id}
      title={st.title}
      description={st.description}
      durationMinutes={st.duration_minutes}
      maxViolations={st.max_violations}
      requireWebcam={st.require_webcam !== false}
      resuming={st.state === "in_progress"}
      watermark={`${user.email} · ${String(st.attempt_id).slice(0, 8)}`}
    />
  );
}
