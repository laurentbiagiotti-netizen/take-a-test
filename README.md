# Cybersup Exam

Plateforme auto-hébergée d'examens surveillés (tests d'admission, QCM, épreuves rédigées), fork durci de [Take A Test](https://github.com/ExPl0iT-29/take-a-test) (licence MIT, voir `LICENSE`).

Next.js 15 + Supabase (hébergé ou auto-hébergé) + Safe Exam Browser.

---

## Principe de sécurité

Le navigateur du candidat n'a **aucun accès direct** aux tables d'examen. Il ne parle qu'au serveur Next.js, qui, à **chaque requête** :

1. vérifie l'origine (anti-CSRF) et l'authentification ;
2. vérifie Safe Exam Browser (hash de la Config Key ou de la Browser Exam Key sur l'URL exacte) quand le test l'exige ;
3. vérifie le jeton de session unique (cookie httpOnly, un seul appareil à la fois) ;
4. appelle une fonction SQL réservée au serveur, qui applique le chrono, les règles et le barème.

Le navigateur **signale** (sortie de plein écran, changement d'onglet…), la base **décide** (gravité, compteur d'infractions, arrêt de l'épreuve, correction).

## Ce qui change par rapport au projet d'origine

### Failles corrigées

| Faille d'origine | Correction |
|---|---|
| Un candidat pouvait se passer **admin** (`update profiles set role='admin'`) | Aucun droit d'écriture sur `profiles`, rôle modifiable uniquement en SQL |
| Un candidat pouvait **écrire son score**, son statut, sa date de début, se débloquer sans code | Plus aucun accès direct aux tables `attempts`, `answers`, `proctor_events` |
| Note des réponses rédigées pré-remplie par le candidat puis conservée à la correction | Seul le staff note, dans le barème |
| Code d'accès global **lisible** par tout utilisateur connecté | Déplacé dans `test_secrets`, admin uniquement |
| Questions d'un test publié **lisibles sans compte**, avant l'épreuve | Questions servies uniquement au démarrage, aux candidats autorisés |
| Contrôle SEB « par test » basé sur la seule présence d'un en-tête | Vérification cryptographique avec clés par test, refus si aucune clé |
| Écritures directes du navigateur vers Supabase (SEB contournable avec curl) | Toutes les écritures passent par le serveur, SEB vérifié à chaque appel |
| Chrono, infractions et clôture gérés côté navigateur | Gérés par la base (délai serveur, réponses refusées après l'heure) |
| Limitation des essais de code contournable | Comptée en base, non modifiable par le candidat |
| Codes générés avec `Math.random` | Aléa cryptographique, codes de 12 caractères |
| Lien d'invitation construit depuis l'en-tête `Host` | Origine fixe `APP_URL` |
| Redirection ouverte après connexion (`?next=//site.com`) | Chemins internes uniquement |
| Sauvegarde des questions qui **effaçait les copies** déjà rendues | Questions verrouillées dès qu'un candidat a composé |
| `.seb` en mode « configuration client », sortie sans mot de passe | Mode examen, mot de passe de sortie, processus interdits, presse-papiers privé |

### Fonctions « examen pro » ajoutées

- **Session unique** : un second appareil est bloqué et journalisé ; le surveillant peut autoriser la reprise.
- **Chrono serveur** avec tolérance réglable, clôture automatique même si le candidat ferme la page (tâche planifiée).
- **Battement de cœur** toutes les 10 s : perte de connexion, changement d'IP ou de navigateur journalisés.
- **Vérification d'identité** : photo de la pièce d'identité et selfie pris en direct, validés par un surveillant.
- **Sujets différents par candidat** : tirage de N questions dans une banque, ordre des questions et des réponses mélangé.
- **Filigrane** (e-mail du candidat + identifiant) sur l'écran d'examen, pour décourager et tracer les photos d'écran.
- Détection de plusieurs écrans, des outils de développement, des tentatives d'impression.
- **Journal inaltérable** : événements chaînés par hash, toute modification ou suppression est détectée.
- **Rôle surveillant** (`proctor`) : suit les tentatives, valide les identités, ajoute du temps (tiers-temps), arrête une épreuve, sans pouvoir modifier les examens.
- **Fenêtre d'ouverture** (date d'ouverture et de fermeture).
- **RGPD** : photos (webcam, identité) purgées automatiquement après la durée de conservation fixée par test ; webcam désactivable par test.
- En-têtes HTTP durcis (CSP stricte, COOP, CORP, HSTS, `no-referrer`).

### API REST et webhooks

- API v1 (`/api/v1`) : examens, questions, invitations, résultats (JSON ou CSV), détail des tentatives, actions de surveillance.
- Clés d'API hachées, à portées, avec expiration, révocation, quota par minute et journal d'appels.
- Webhooks signés HMAC à chaque copie rendue, interrompue ou expirée (file d'envoi en base, renvois automatiques).
- Documentation OpenAPI : [`public/openapi.yaml`](./public/openapi.yaml), servie sur `/openapi.yaml`.

---

## Installation

### 1. Dépendances
```bash
npm install
```

### 2. Supabase
Créer un projet (cloud ou auto-hébergé sur votre infrastructure), puis exécuter [`supabase/schema.sql`](./supabase/schema.sql) dans l'éditeur SQL.

Dans **Authentication > Providers > Email**, activer la **confirmation d'e-mail** : sans elle, n'importe qui pourrait créer un compte avec l'adresse d'un candidat invité.

### 3. Variables d'environnement
```bash
cp .env.local.example .env.local
```
`SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` et `CRON_SECRET` sont obligatoires.

### 4. Lancer
```bash
npm run dev
```

### 5. Premier administrateur
S'inscrire sur `/signup`, puis en SQL :
```sql
update profiles set role = 'admin' where email = 'vous@cybersup.ai';
update profiles set role = 'proctor' where email = 'surveillant@cybersup.ai';
```

### 6. Tâche planifiée
Appeler `/api/cron/maintenance` **toutes les minutes** avec l'en-tête `Authorization: Bearer <CRON_SECRET>` (cron système, Vercel Cron, n8n…). Elle clôt les épreuves expirées, envoie les webhooks et purge les photos arrivées en fin de conservation.

## Safe Exam Browser

1. Dans l'admin du test, cocher « Safe Exam Browser obligatoire » et définir un mot de passe de sortie.
2. Télécharger le `.seb` depuis la page du test.
3. L'ouvrir dans l'outil de configuration SEB, onglet **Exam**, copier la **Config Key** (valable pour tous les postes, quelle que soit la version de SEB) et la coller dans « Clés Safe Exam Browser ».
4. Recommandé : réenregistrer le `.seb` chiffré par mot de passe depuis l'outil SEB, puis le distribuer aux candidats.

Sans clé configurée, un test « SEB obligatoire » est **refusé à tous** (échec en mode fermé), et la page admin le signale.

## Limites à connaître

Aucune surveillance à distance n'est parfaite. Un second appareil hors champ de la caméra reste possible : le meilleur dispositif reste SEB en salle avec un surveillant. La détection des outils de développement et des écrans multiples repose sur le navigateur et sert d'indice, pas de preuve. La CNIL impose de proposer une alternative en présentiel aux épreuves télésurveillées et encadre la conservation des images.

## Licence

MIT. Projet d'origine © ExPl0iT-29 ; modifications © Cybersup.
