# API des inscriptions aux épreuves

Cette API sert à inscrire des candidats à une épreuve, suivre où ils en sont, modifier leur inscription (tiers-temps, changement d'épreuve, nouveau code) ou les désinscrire, depuis un autre outil : n8n, HubSpot, Grimp, un tableur.

Une inscription, c'est un candidat (son e-mail) sur une épreuve. Elle donne au candidat un code personnel et un lien d'accès direct.

## Accès

Les appels utilisent la même sécurité que le reste de l'API v1 : une clé créée dans *Admin, API*, et chaque requête signée (voir `scripts/api-client.mjs`, qui fait la signature pour vous).

- portée `invites:read` pour lire ;
- portée `invites:write` pour inscrire, modifier, désinscrire.

Pensez à limiter la clé aux adresses IP de votre outil d'automatisation.

## Statuts

| Statut | Signification |
|---|---|
| `registered` | inscrit, n'a pas encore commencé |
| `started` | épreuve en cours |
| `submitted` | copie rendue |
| `terminated` | épreuve interrompue par un surveillant |
| `expired` | temps écoulé |

## Les appels

### Inscrire un candidat

`POST /api/v1/registrations`

```json
{ "test_id": "…", "email": "ines.bernard@exemple.fr", "full_name": "Inès Bernard", "extra_minutes": 0, "external_ref": "hubspot-123456" }
```

- Réponse `201` si l'inscription est créée, `200` si le candidat était déjà inscrit à cette épreuve : ses informations sont alors mises à jour, et son code ne change pas. On peut donc rappeler sans risque de doublon.
- `extra_minutes` : tiers-temps en minutes (0 à 600).
- `external_ref` : l'identifiant du candidat dans votre outil (fiche HubSpot, candidature Grimp), renvoyé partout ensuite.

La réponse contient `code` et `access_url`, le lien personnel à mettre dans la convocation.

**En lot :** `{ "test_id": "…", "registrations": [ { "email": "…" }, … ] }`, jusqu'à 500 par appel. La réponse `207` donne le résultat ligne par ligne, avec les compteurs `created`, `updated` et `errors`.

### Lister les inscriptions

`GET /api/v1/registrations`

Filtres possibles : `test_id`, `email`, `external_ref`, `status`, `limit` (1 à 500, 100 par défaut), `offset`.
Avec `include=convocation`, chaque inscription contient le texte de convocation prêt à envoyer (objet et corps du mail). La plateforme n'envoie jamais de mail toute seule.

Exemples :
- tous les inscrits d'une épreuve : `GET /api/v1/registrations?test_id=…`
- retrouver un candidat depuis HubSpot : `GET /api/v1/registrations?external_ref=hubspot-123456`

Chaque inscription contient aussi `attempt` dès que le candidat a commencé : statut, score, nombre d'alertes, dates.

### Voir une inscription

`GET /api/v1/registrations/{id}` (avec `?include=convocation` si besoin).

### Modifier une inscription

`PATCH /api/v1/registrations/{id}`

Tout est facultatif :
- `full_name`, `extra_minutes`, `external_ref` : modifiables à tout moment ;
- `email` : corriger une adresse ;
- `test_id` : déplacer le candidat sur une autre épreuve (une autre session, par exemple) ;
- `regenerate_code: true` : donner un nouveau code (code perdu ou transmis à quelqu'un d'autre).

Une fois l'épreuve commencée, l'e-mail, l'épreuve et le code ne changent plus : réponse `409`.

### Désinscrire

`DELETE /api/v1/registrations/{id}` : réponse `204`. Refusé (`409`) si le candidat a déjà commencé : sa copie doit être conservée.

## Webhooks

Dans *Admin, API*, un webhook peut maintenant aussi recevoir :
- `registration.created`, `registration.updated`, `registration.deleted` ;
- en plus de `attempt.submitted`, `attempt.expired`, `attempt.terminated`, `attempt.flagged`, `attempt.verdict`.

Les notifications d'inscription contiennent la fiche (e-mail, nom, `external_ref`, statut), jamais le code d'accès. Les nouveaux webhooks sont abonnés à tous les événements. Un webhook déjà créé doit être recréé pour recevoir les événements d'inscription.

## Erreurs

| Code | Cas |
|---|---|
| `400` | donnée invalide (e-mail, tiers-temps, identifiant) |
| `401` | clé absente, invalide, ou signature fausse |
| `404` | épreuve ou inscription introuvable |
| `409` | modification ou désinscription impossible car le candidat a commencé, ou candidat déjà inscrit à l'épreuve de destination |
| `429` | trop d'appels par minute |

## Exemple avec le client fourni

```
node scripts/api-client.mjs POST /api/v1/registrations '{"test_id":"…","email":"ines.bernard@exemple.fr","full_name":"Inès Bernard"}'
node scripts/api-client.mjs GET "/api/v1/registrations?test_id=…"
node scripts/api-client.mjs PATCH /api/v1/registrations/… '{"extra_minutes":20}'
```
