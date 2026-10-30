import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Vos données et vos droits" };

/**
 * Notice d'information des candidats (RGPD art. 13), rédigée d'après la
 * recommandation de la CNIL sur la télésurveillance des examens en ligne
 * (délibération 2023-058). Accessible avant toute connexion.
 */
export default function Confidentialite() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-14">
      <h1 className="h1">Vos données et vos droits</h1>
      <p className="text-muted mt-3">Ce que la plateforme des tests d&apos;admission de Cybersup collecte quand vous passez une épreuve, pourquoi, combien de temps, et comment exercer vos droits. Mise à jour : {LEGAL.updatedAt}.</p>

      <div className="card mt-8">
        <h2 className="h2">L&apos;essentiel</h2>
        <ul className="mt-3 space-y-2 text-sm list-disc pl-5">
          <li><b>Pas d&apos;enregistrement vidéo ni audio.</b> L&apos;image de la caméra est analysée sur votre ordinateur et n&apos;est pas envoyée en continu.</li>
          <li><b>Une photo seulement en cas d&apos;anomalie</b> (autre personne visible, caméra masquée…), pour qu&apos;un surveillant puisse vérifier.</li>
          <li><b>Pas de reconnaissance faciale</b>, pas d&apos;analyse de votre regard, de votre frappe ou de vos émotions.</li>
          <li><b>Aucune décision automatique</b> : les alertes sont examinées par une personne de l&apos;équipe, qui seule peut interrompre une épreuve ou retenir une suspicion de fraude.</li>
          <li><b>Photos et pièces d&apos;identité supprimées après 30 jours</b> (60 jours en cas de suspicion de fraude signalée).</li>
          <li><b>Vous pouvez demander à passer l&apos;épreuve en présentiel.</b></li>
        </ul>
      </div>

      <section className="mt-10 space-y-8 text-sm leading-relaxed">
        <div>
          <h2 className="h2">Qui est responsable</h2>
          <p className="mt-2">Responsable du traitement : {LEGAL.controller}. Délégué à la protection des données et exercice de vos droits : {LEGAL.dpoContact}.</p>
        </div>

        <div>
          <h2 className="h2">Pourquoi ces données</h2>
          <p className="mt-2">Uniquement pour organiser votre épreuve d&apos;admission, en garantir l&apos;équité (lutte contre la fraude) et évaluer votre candidature. Elles ne servent à rien d&apos;autre : ni publicité, ni entraînement d&apos;outils, ni revente.</p>
          <p className="mt-2">Base légale : les mesures préalables à votre inscription que vous avez demandées (article 6.1.b du RGPD). Les modalités de l&apos;épreuve vous sont communiquées avec la convocation, avant l&apos;épreuve.</p>
        </div>

        <div>
          <h2 className="h2">Ce qui est collecté</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li><b>Votre compte</b> : nom, adresse e-mail, mot de passe (conservé sous forme hachée, illisible même par l&apos;équipe).</li>
            <li><b>Vos réponses</b> et votre résultat, y compris par domaine.</li>
            <li><b>Le déroulé de l&apos;épreuve</b> : heures de début et de fin, sorties du plein écran, changements d&apos;onglet ou de fenêtre, coupures réseau, adresse IP et type de navigateur. Ce journal est protégé contre toute modification.</li>
            <li><b>Des photos de la caméra</b>, seulement lorsqu&apos;une anomalie est détectée. La détection (présence d&apos;un visage, d&apos;une autre personne, caméra masquée ou figée) se fait sur votre ordinateur.</li>
            <li><b>Une photo de pièce d&apos;identité et un selfie</b>, seulement si l&apos;épreuve demande une vérification d&apos;identité. Ils sont comparés à l&apos;œil par un surveillant, sans traitement biométrique.</li>
          </ul>
          <p className="mt-2 text-muted">La caméra peut capter votre environnement : installez-vous dans une pièce calme et neutre, et prévenez les personnes autour de vous.</p>
        </div>

        <div>
          <h2 className="h2">Qui y a accès</h2>
          <p className="mt-2">Les membres de l&apos;équipe d&apos;admission et les surveillants habilités, connectés avec une double authentification ; toute modification qu&apos;ils font est journalisée. Les données sont hébergées par : {LEGAL.host}. Elles sont chiffrées pendant leur transfert et leur stockage.</p>
        </div>

        <div>
          <h2 className="h2">Combien de temps</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Photos de caméra, pièce d&apos;identité et selfie : supprimés automatiquement 30 jours après l&apos;épreuve, ou 60 jours après une suspicion de fraude signalée par un surveillant (le temps de la procédure).</li>
            <li>Réponses, résultat et déroulé de l&apos;épreuve : {LEGAL.resultsRetention}.</li>
            <li>Compte : jusqu&apos;à votre demande de suppression ou la fin de la campagne d&apos;admission.</li>
          </ul>
        </div>

        <div>
          <h2 className="h2">Vos droits</h2>
          <p className="mt-2">Vous pouvez accéder à vos données (y compris aux photos prises et au journal de votre épreuve), les faire rectifier, les faire effacer, en limiter l&apos;usage ou en recevoir une copie. Écrivez à : {LEGAL.dpoContact}. Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (cnil.fr).</p>
        </div>

        <div>
          <h2 className="h2">Passer l&apos;épreuve autrement</h2>
          <p className="mt-2">Si vous ne souhaitez pas passer l&apos;épreuve à distance sous surveillance, ou si votre matériel ne le permet pas, vous pouvez demander à la passer en présentiel, dans des conditions équivalentes : {LEGAL.admissionsContact}.</p>
        </div>
      </section>
    </main>
  );
}
