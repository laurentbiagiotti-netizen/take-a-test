# AIPD : plateforme des tests d'admission Cybersup (trame)

30 octobre 2026 · Laurent Biagiotti

Copie de travail de la trame partagée dans Claude Docs. Les passages entre crochets sont à renseigner par l'établissement.

## Objet et statut

Cette trame prépare l'analyse d'impact (AIPD) de la plateforme en ligne des tests d'admission de Cybersup, à compléter et valider par le DPO avant le premier passage de candidats.

- Traitement analysé : organisation et télésurveillance des épreuves d'admission en ligne (Bachelor 1, Bachelor 3, Mastère Cybersécurité).
- Références : RGPD article 35 ; recommandation de la CNIL sur la télésurveillance des examens en ligne (délibération n° 2023-058 du 8 juin 2023) ; liste CNIL des traitements soumis à AIPD (délibération n° 2018-327).
- Méthode : celle de la CNIL (contexte, principes fondamentaux, risques, validation), reprenable dans l'outil PIA de la CNIL.
- Rédaction de la trame : description technique de la plateforme telle que développée au 30 octobre 2026. Ce document n'est pas un avis juridique.

## Pourquoi une AIPD

L'AIPD est requise : la CNIL demande qu'une analyse d'impact soit menée avec le DPO avant toute mise en œuvre d'un dispositif de télésurveillance d'examen, sauf absence de risque élevé (recommandation 2023-058, §32). Plusieurs critères du CEPD sont réunis ; deux suffisent en principe.

| Critère CEPD | Rempli | Pourquoi |
| --- | --- | --- |
| Évaluation ou notation | Oui | L'épreuve note les candidats et prépare une décision d'admission. |
| Surveillance systématique | Oui | Journal des événements, détection automatique sur l'image de la caméra pendant toute l'épreuve. |
| Usage innovant de technologies | Oui | Détection de visages et de personnes par apprentissage automatique, dans le navigateur. |
| Personnes vulnérables | À évaluer | Candidats en position de dépendance vis-à-vis de l'école ; certains candidats au B1 peuvent être mineurs. |
| Données sensibles ou très personnelles | Partiel | Images du domicile et de l'environnement ; pièce d'identité si la vérification est activée. |
| Décision automatisée à effet juridique | Non | Aucune décision automatique : les alertes sont examinées par un surveillant (voir mesures). |

## Description du traitement

La plateforme fait passer en ligne un QCM d'admission (et une mission sur machine Linux simulée en B3 et Mastère), surveillé par l'équipe, sans enregistrement vidéo.

- Responsable du traitement : [raison sociale, adresse] ; DPO : [contact].
- Finalités : organiser l'épreuve, en garantir l'équité (lutte contre la fraude), évaluer la candidature. Aucune autre réutilisation.
- Personnes concernées : candidats à l'admission ; membres de l'équipe (comptes, journal des actions) ; tiers filmés incidemment dans la pièce du candidat.
- Destinataires : équipe d'admission et surveillants habilités (double authentification) ; jury d'entretien (fiche candidat) ; outils de l'école reliés par API ou webhook (HubSpot, Grimp), si l'école les branche.
- Sous-traitants : hébergeur de la base et des fichiers [Supabase, région d'hébergement à confirmer] ; hébergeur de l'application [à compléter]. Les modèles de détection sont servis par la plateforme elle-même ; aucun service tiers d'analyse d'image.

| Données | Origine | Conservation |
| --- | --- | --- |
| Compte : nom, e-mail, mot de passe haché | Candidat | Fin de la campagne d'admission ou demande de suppression [à confirmer] |
| Invitation : code d'accès, tiers-temps, identifiant HubSpot ou Grimp | Équipe | Comme le compte |
| Réponses, score, score par domaine | Candidat, correction | [durée de la campagne d'admission, à fixer] |
| Journal d'épreuve : horodatages, sorties du plein écran, changements de fenêtre, IP, navigateur | Plateforme | Comme les réponses ; journal chaîné, non modifiable |
| Photos de la caméra, prises seulement lors d'une anomalie | Navigateur du candidat | 30 jours après l'épreuve ; 60 jours après une suspicion signalée par un surveillant |
| Pièce d'identité et selfie, si la vérification est activée | Candidat | 30 jours après l'épreuve, comme les photos |
| Journal des actions de l'équipe | Plateforme | [6 mois à 1 an, à fixer] |

Ce qui n'est pas collecté : flux vidéo ou audio, captures d'écran, gabarits biométriques, données de regard, de frappe ou d'émotion. L'image de la caméra est analysée sur l'ordinateur du candidat ; seule une photo d'anomalie quitte le poste.

## Nécessité et proportionnalité

- Base légale : exécution de mesures précontractuelles prises à la demande du candidat (article 6.1.b du RGPD), l'établissement étant privé. Les modalités de l'épreuve (caméra, plein écran, journal) sont présentées avant l'inscription à l'épreuve, dans la convocation et sur l'écran de préparation. [à valider par le DPO]
- Minimisation :
  - pas d'enregistrement vidéo ni audio, pas de capture d'écran ;
  - pas de reconnaissance faciale ni de comparaison biométrique : la plateforme compte les visages et les silhouettes, elle n'identifie personne ;
  - pas d'analyse du regard, de la frappe ou du comportement ;
  - une photo n'est envoyée que lors d'une anomalie (visage absent, plusieurs personnes, caméra masquée ou figée).
- Pas de décision automatique : une alerte caméra ne compte pas comme infraction et n'arrête jamais l'épreuve. Au-delà du seuil d'infractions (sorties du plein écran, changements de fenêtre), le surveillant est prévenu et décide. Les résultats sont examinés par l'équipe, puis par le jury d'entretien.
- Alternative : le candidat qui refuse la caméra peut continuer l'épreuve (le refus est signalé au surveillant) ou demander à passer l'épreuve en présentiel, sur le campus, aux mêmes conditions. [modalités pratiques à organiser]
- Information : notice en ligne /confidentialite, paragraphe dédié dans la convocation, règles rappelées sur l'écran de préparation avant le démarrage.
- Droits : accès, rectification, effacement, limitation, opposition dans les cas prévus, réclamation auprès de la CNIL. Contact : [adresse du DPO]. Délai de réponse : un mois.
- Tiers-temps : fixé à l'avance par l'équipe pour chaque candidat concerné, sans que le candidat ait à justifier sa situation sur la plateforme.

## Mesures de sécurité

- Accès : chaque table est protégée par des règles d'accès en base (RLS) ; le candidat ne voit que sa propre épreuve ; les comptes de l'équipe exigent la double authentification ; l'administration peut être limitée à des plages d'adresses IP.
- Intégrité : le journal d'épreuve est en ajout seul et chaîné par empreintes (sha256) ; toute action de l'équipe (prolonger, interrompre, signaler une suspicion) y est inscrite avec son auteur.
- Correction côté serveur : les bonnes réponses ne sont jamais envoyées au navigateur ; la navigation question par question et le chronomètre sont contrôlés par le serveur.
- Fichiers : photos et pièces d'identité dans un espace de stockage privé, servies par liens signés de courte durée.
- Chiffrement : HTTPS pour tous les échanges ; chiffrement au repos assuré par l'hébergeur [à confirmer].
- Purge : une tâche planifiée supprime les photos et pièces d'identité 30 jours après l'épreuve, ou 60 jours après une suspicion signalée.
- Navigateur sécurisé (Safe Exam Browser) : optionnel, activable par épreuve.
- Reçu de dépôt : une référence de 12 caractères calculée sur les réponses permet de prouver ce qui a été remis.
- Secrets : clés d'API hachées en base ; webhooks signés.

## Risques pour les personnes

Gravité et vraisemblance cotées de 1 (négligeable) à 4 (maximale), après mesures. Cotation proposée, à discuter avec le DPO.

| Risque | Effet pour la personne | Mesures | Gravité | Vraisemblance |
| --- | --- | --- | --- | --- |
| Accès illégitime aux photos ou aux résultats | Atteinte à la vie privée, image du domicile exposée | RLS, double authentification, liens signés, purge à 30 jours | 2 | 1 |
| Modification des réponses ou du journal | Résultat faussé | Correction serveur, journal chaîné, reçu de dépôt | 3 | 1 |
| Perte des réponses (coupure réseau, panne) | Épreuve à repasser | Sauvegarde à chaque réponse, reprise de l'épreuve, sauvegardes de l'hébergeur | 2 | 2 |
| Faux positif de la détection (ombre, poster, reflet) | Suspicion injustifiée, stress | Alerte seulement, jamais d'arrêt ; examen humain ; le candidat peut s'expliquer en entretien | 2 | 2 |
| Capture d'un tiers ou d'éléments privés de la pièce | Atteinte à la vie privée d'un proche | Photo seulement sur anomalie, consigne de cadrage, purge rapide | 2 | 2 |
| Exclusion d'un candidat sans caméra ou mal équipé | Rupture d'égalité | Refus de caméra possible et signalé, alternative en présentiel, démo d'essai | 2 | 2 |
| Réutilisation à d'autres fins (marketing, fichier) | Détournement de finalité | Finalités limitées, export vers HubSpot ou Grimp limité au résultat | 2 | 1 |

## Écarts avec la recommandation CNIL et plan d'action

Déjà corrigé dans la plateforme :

- l'arrêt automatique de l'épreuve au-delà du seuil d'infractions a été supprimé : le surveillant est prévenu et décide ;
- les alertes caméra ne comptent plus comme infractions ;
- les photos périodiques ont été supprimées : une photo n'est prise que lors d'une anomalie ;
- la conservation des photos est passée à 30 jours, 60 jours en cas de suspicion signalée ;
- une notice candidat a été publiée et la convocation y renvoie.

Reste à faire :

| Action | Responsable | Échéance |
| --- | --- | --- |
| Organiser l'alternative en présentiel (salle, dates, inscription) | [à compléter] | Avant la première session |
| Faire passer un examen blanc à un petit groupe et recueillir son avis | [à compléter] | Avant la première session |
| Compléter les mentions de la notice (raison sociale, DPO, hébergeur) | [à compléter] | Avant la mise en ligne |
| Fixer la durée de conservation des réponses et des journaux d'accès | DPO | [à compléter] |
| Journaliser la consultation des photos par l'équipe (non fait à ce jour) | Équipe technique | [à compléter] |
| Prévoir le cas des candidats mineurs (information des représentants légaux) | DPO | [à compléter] |
| Signer ou vérifier l'accord de sous-traitance avec l'hébergeur | [à compléter] | [à compléter] |

## Validation

| Étape | Nom | Date | Avis |
| --- | --- | --- | --- |
| Avis du DPO | [à compléter] | [à compléter] | [à compléter] |
| Avis des personnes concernées (examen blanc) | [à compléter] | [à compléter] | [à compléter] |
| Décision du responsable du traitement | [à compléter] | [à compléter] | [à compléter] |

Cette analyse est à revoir à chaque changement notable (nouveau type de donnée, nouveau sous-traitant, nouvelle règle de détection) et au moins une fois par an.

### Sources

- CNIL, délibération n° 2023-058 du 8 juin 2023 portant adoption d'une recommandation relative aux dispositifs de surveillance des examens à distance.
- CNIL, guide et outil PIA pour l'analyse d'impact relative à la protection des données.
- Lignes directrices du CEPD (ex-G29) concernant l'analyse d'impact, WP 248 rév.01.
