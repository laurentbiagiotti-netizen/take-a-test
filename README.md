# Cybersup Exam

Plateforme auto-hébergée d'examens surveillés (tests d'admission, QCM, épreuves rédigées), fork durci de [Take A Test](https://github.com/ExPl0iT-29/take-a-test) (licence MIT, voir `LICENSE`).

Next.js 15 + Supabase (hébergé ou auto-hébergé) + Safe Exam Browser. Interface en français, aux couleurs de Cybersup.

- **Démo publique** sur `/demo` : vérification du poste (caméra, plein écran, écran unique, SEB), puis une épreuve d'essai avec une mission sur un serveur Linux compromis et un exemple de chaque type de question.
- **Questions variées** : QCM, réponse rédigée, remise en ordre, association, repérage (code vulnérable, journaux, mail de phishing, tableau), analyse de données, défi terminal avec missions.

---

## Principe de sécurité

Le navigateur du candidat n'a **aucun accès direct** aux tables d'examen. Il ne parle qu'au serveur Next.js, qui, à **chaque requête** :

1. vérifie l'origine (anti-CSRF) et l'authentification ;
2. vérifie Safe Exam Browser (hash de la Browser Exam Key, salée par examen, sur l'URL exacte) quand le test l'exige ;
3. vérifie le jeton de session unique (généré par le serveur, cookie httpOnly) et le poste : changement de navigateur = infraction, changement d'IP = signalé ;
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
| Redirection ouverte après connexion (`?next=//site.com`) | Chemins internes uniquement, validés par analyse d'URL |
| `.seb` téléchargeable par tous (Config Key et mot de passe de sortie recalculables) | Réservé aux admins, sel par examen, à distribuer chiffré |
| Sauvegarde des questions qui **effaçait les copies** déjà rendues | Questions verrouillées dès qu'un candidat a composé |
| `.seb` en mode « configuration client », sortie sans mot de passe | Mode examen, mot de passe de sortie, processus interdits, presse-papiers privé |

### Fonctions « examen pro » ajoutées

- **Session unique** : un second appareil est bloqué et journalisé ; un cookie de session copié sur un autre poste déclenche une infraction ; le surveillant peut autoriser la reprise.
- **Chrono serveur** avec tolérance réglable, clôture automatique même si le candidat ferme la page (tâche planifiée).
- **Battement de cœur** toutes les 10 s : perte de connexion, changement d'IP ou de navigateur journalisés.
- **Vérification d'identité** : photo de la pièce d'identité et selfie pris en direct, validés par un surveillant (avant le début si souhaité ; un refus en cours d'épreuve l'arrête).
- **Sujets différents par candidat** : tirage de N questions dans une banque, ordre des questions et des réponses mélangé.
- **Filigrane** (e-mail du candidat + identifiant) sur l'écran d'examen, pour décourager et tracer les photos d'écran.
- Détection de plusieurs écrans, des outils de développement, des tentatives d'impression.
- **Journal inaltérable** : événements numérotés et chaînés par hash, ancrés dans la tentative et dans les webhooks ; modification, suppression ou troncature détectées.
- **Webcam imposée côté serveur** : absence de photo pendant plus de 75 s = infraction.
- **Rôle surveillant** (`proctor`) : suit les tentatives, valide les identités, ajoute du temps (tiers-temps), arrête une épreuve et note les réponses rédigées, sans voir les codes d'accès ni modifier les examens ou les notes de QCM.
- **Fenêtre d'ouverture** (date d'ouverture et de fermeture).
- **RGPD** : photos (webcam, identité) purgées automatiquement après la durée de conservation fixée par test ; webcam désactivable par test.
- En-têtes HTTP durcis (CSP stricte, COOP, CORP, HSTS, `no-referrer`).

### Sécurité du staff et de l'infrastructure

- **Double authentification (TOTP) obligatoire** pour les admins et surveillants, exigée jusque dans la base (RLS) : un mot de passe volé ne donne accès à rien. Enrôlement guidé sur `/mfa`.
- **Liste d'IP autorisées** pour l'interface d'administration (`ADMIN_ALLOWED_CIDRS`), par exemple le réseau de l'école et Tailscale. C'est une défense en profondeur : elle ne couvre pas un appel direct à Supabase avec une session staff volée (la double authentification reste la vraie barrière). Les clés d'API ayant une portée d'écriture doivent obligatoirement être limitées à des IP.
- **Journal d'administration inaltérable** (`/admin/audit`) : qui a créé, modifié ou supprimé quoi, sans jamais recopier les valeurs secrètes.
- **CSP avec nonce par requête** : aucun script ne s'exécute sans le nonce de la page (plus de `unsafe-inline`), polices auto-hébergées, aucune ressource tierce.
- **Jeton de requête tournant** pendant l'épreuve : chaque appel présente le jeton reçu au précédent. Une session copiée et utilisée en parallèle désynchronise la chaîne : infraction, session coupée, reprise sur autorisation du surveillant.

### Types de questions

| Type | Ce que fait le candidat | Correction |
|---|---|---|
| QCM (une ou plusieurs réponses) | Coche | Tout ou rien |
| Réponse rédigée | Écrit | À la main par un correcteur |
| Remettre dans l'ordre | Glisse des étapes (toujours servies mélangées) | Points au prorata des étapes bien placées |
| Associer | Relie chaque élément à gauche à un élément à droite (leurres possibles) | Au prorata des bonnes associations |
| Repérer | Clique des lignes de **code** (la ligne fautive), de **journal** (lignes suspectes), des indices d'un **mail de phishing**, ou des lignes d'un **tableau** | (bons repérages moins erreurs) / nombre attendu |
| Réponse courte / données | Explore un **tableau** (filtre, tri) ou un texte, et donne une réponse exacte (décodage, calcul, enquête) | Réponse exacte, espaces et casse ignorés si souhaité |
| Défi terminal | Travaille sur une machine Linux simulée et accomplit des **missions** | Au prorata des missions réussies (+ flag éventuel) |

Les bonnes réponses ne sont jamais envoyées au navigateur. Les QCM et réponses rédigées restent disponibles, on mélange librement les types dans un même examen.

### Défis terminal

Chaque candidat a **sa propre machine simulée**, sauvegardée côté serveur : il peut créer, modifier, supprimer, changer les droits, tuer des processus… et les missions se cochent en direct quand l'état de la machine est correct. Aucune vraie commande n'est exécutée et le scénario (fichiers, missions, flag) ne quitte jamais le serveur.

Commandes : `ls cd pwd cat head tail stat file tree touch mkdir cp mv rm rmdir chmod chown grep find wc sort uniq cut tr sed rev base64 md5sum sha256sum ps pgrep kill pkill ss ip whoami id hostname uname env export crontab sudo history`, avec `|`, `;`, `&&`, `>` et `>>`. Droits Unix respectés (propriétaire, rwx), `sudo` limité à la liste du scénario. Recherche `grep` littérale (anti-ReDoS), état limité en taille, 30 commandes par 15 s.

Format du scénario (JSON, dans l'éditeur de question) :

```json
{
  "user": "candidat", "hostname": "srv-admission", "home": "/home/candidat",
  "motd": "Message d'accueil",
  "files": {
    "/home/candidat/MISSION.txt": "1. Arrête le mineur\n2. Protège secret.txt\n",
    "/home/candidat/secret.txt": { "content": "...", "mode": "644" },
    "/tmp/.x/run.sh": { "content": "#!/bin/bash\n...", "mode": "755", "owner": "candidat" }
  },
  "dirs": [{ "path": "/tmp/.x", "owner": "candidat" }],
  "denied": ["/root"],
  "processes": [{ "pid": 4242, "user": "candidat", "cmd": "./minerd --donate", "cpu": 95 }],
  "listen": [{ "port": 4444, "process": "minerd" }],
  "crontab": "*/5 * * * * /tmp/.x/run.sh",
  "sudo": ["cat"],
  "objectives": [
    { "id": "kill", "title": "Arrêter le mineur", "check": { "type": "process_absent", "name": "minerd" } },
    { "id": "perm", "title": "Protéger secret.txt", "check": { "type": "mode", "path": "/home/candidat/secret.txt", "mode": "600" } }
  ]
}
```

Vérifications de missions disponibles : `exists` (avec `kind` file ou dir), `absent`, `contains`, `equals`, `mode`, `process_absent`, `process_present`, `ran` (la commande a été utilisée). Un flag (facultatif) peut s'ajouter aux missions. Un modèle complet est inséré quand on ajoute un défi terminal, et la démo (`lib/terminal/demo.ts`) montre une enquête « serveur compromis » de bout en bout.

### API REST et webhooks

- API v1 (`/api/v1`) : examens, questions, invitations, résultats (JSON ou CSV), détail des tentatives, actions de surveillance.
- Clés d'API hachées, à portées, avec expiration, révocation, quota par minute et journal d'appels.
- **Signature HMAC-SHA256 de chaque requête** (activée par défaut) : horodatage à ±5 min et nonce à usage unique (anti-rejeu). Le secret de signature est chiffré en base (AES-256-GCM, clé `API_SECRETS_KEY` hors base).
- **Liste d'IP autorisées par clé**. Une clé cesse de fonctionner si son créateur n'est plus admin.
- Client d'exemple : `scripts/api-client.mjs`.
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
`SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `CRON_SECRET` et `API_SECRETS_KEY` sont obligatoires. Pour générer les secrets :
```bash
openssl rand -hex 32
```

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
À la connexion suivante, `/mfa` demande d'enrôler une application d'authentification (vérifier que le TOTP est activé dans Supabase, Authentication > Multi-Factor). Le premier enrôlement est accordé à quiconque connaît le mot de passe : donner le rôle staff juste avant que la personne se connecte, vérifier qu'elle a bien enrôlé elle-même son téléphone, et activer dans Supabase les e-mails de notification de sécurité (ajout d'un facteur MFA).

### 6. Tâche planifiée
Appeler `/api/cron/maintenance` **toutes les minutes** avec l'en-tête `Authorization: Bearer <CRON_SECRET>` (cron système, Vercel Cron, n8n…). Elle clôt les épreuves expirées, envoie les webhooks et purge les photos arrivées en fin de conservation.

## Safe Exam Browser

1. Dans l'admin du test, cocher « Safe Exam Browser obligatoire » et définir un mot de passe de sortie.
2. Télécharger le `.seb` depuis la page du test (réservé aux admins). Il contient un **sel propre à l'examen** : les clés ne sont pas réutilisables d'un examen à l'autre.
3. L'ouvrir dans l'outil de configuration SEB, onglet **Exam**, copier la **Browser Exam Key** et la coller dans les réglages du test. Elle dépend de la version et du système de SEB : ajouter une clé par combinaison utilisée par les candidats (imposer une version de SEB simplifie tout).
4. Réenregistrer le `.seb` **chiffré par mot de passe** depuis l'outil SEB, puis le distribuer.

Sans clé configurée, un test « SEB obligatoire » est **refusé à tous** (échec en mode fermé), et la page admin le signale.

La Config Key n'est acceptée que si le test l'autorise explicitement : elle se recalcule à partir du `.seb`, donc un candidat qui obtient le fichier en clair pourrait forger les en-têtes hors de SEB.

## Limites à connaître

Aucune surveillance à distance n'est parfaite. SEB lui-même n'est pas inviolable : ses en-têtes ne contiennent ni horodatage ni nonce, et un attaquant qui rétro-conçoit le calcul de la Browser Exam Key peut les reproduire. Un second appareil hors champ de la caméra reste possible : le meilleur dispositif reste SEB en salle avec un surveillant. La détection des outils de développement et des écrans multiples repose sur le navigateur et sert d'indice, pas de preuve. La CNIL impose de proposer une alternative en présentiel aux épreuves télésurveillées et encadre la conservation des images.

## Licence

MIT. Projet d'origine © ExPl0iT-29 ; modifications © Cybersup.
