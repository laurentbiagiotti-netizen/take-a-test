# Relier la plateforme à HubSpot ou à Grimp

La plateforme sait déjà recevoir des candidats et renvoyer leurs résultats. Il reste à brancher vos comptes. Rien n'est envoyé automatiquement aux candidats : les convocations sont préparées en brouillon et relues par l'équipe.

## 1. Sans aucun réglage : par fichier

- **Importer** : exportez la liste des candidats depuis HubSpot ou Grimp (CSV), puis collez-la dans *Admin, épreuve, Candidats*. Colonnes reconnues : e-mail, prénom, nom (ou nom complet), tiers-temps en minutes, identifiant (« Record ID » pour HubSpot).
- **Récupérer les résultats** : `GET /api/v1/tests/{id}/results?format=csv`, ou le bouton d'export. Chaque ligne contient l'identifiant d'origine (`external_ref`), le score, le seuil, la décision indicative (`passed`), les domaines sous le plancher et le score par domaine. Ce fichier se réimporte tel quel dans HubSpot (import par Record ID) ou dans Grimp.

## 2. Automatique : API et webhooks

1. Dans *Admin, API*, créez une clé avec les portées `invites:write` et `results:read`, en limitant les adresses IP autorisées à celles de votre outil d'automatisation (n8n, Make, Zapier ou un workflow HubSpot).
2. **Entrée des candidats** : à chaque nouveau candidat (formulaire HubSpot ou candidature Grimp), l'outil appelle
   `POST /api/v1/tests/{id}/invites` avec `{"candidates": [{"email": "...", "full_name": "...", "extra_minutes": 0, "external_ref": "<id HubSpot ou Grimp>"}]}`.
   La réponse contient le code personnel du candidat, à reporter dans le brouillon de convocation.
3. **Retour des résultats** : dans *Admin, API*, ajoutez un webhook vers votre outil, sur l'événement `attempt.submitted` (et `attempt.expired`, `attempt.terminated`). Chaque notification est signée (HMAC, en-tête `X-Cx-Signature`) et contient :
   - `external_ref` : l'identifiant du candidat dans HubSpot ou Grimp ;
   - `score`, `max_score`, `violation_count` ;
   - `admission.passed`, `admission.pass_mark`, `admission.below_floors`, `admission.domains` (score par domaine).
   L'outil met alors à jour la fiche : par exemple, dans HubSpot, des propriétés « Score test d'admission », « Admissible » et « Points de vigilance », et le passage à l'étape « Entretien » du pipeline.

## Ce qu'il faut pour finir le branchement

- HubSpot : un jeton d'application privée avec l'accès aux contacts, et le nom des propriétés à remplir.
- Grimp : l'accès à son API ou à ses exports et imports, à confirmer avec Grimp.
- L'outil d'automatisation retenu (n8n, déjà utilisé chez Cybersup, convient).
