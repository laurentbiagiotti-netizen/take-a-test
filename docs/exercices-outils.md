# Exercices dans les outils de l'école

Une question « Exercice dans un outil » ouvre Crime GeoGuess ou Cybersup OS dans un cadre de l'épreuve. Le plein écran, la caméra et le journal continuent de tourner autour, et la note compte dans la copie comme n'importe quelle question : points de la question multipliés par la réussite dans l'outil (de 0 à 1).

## Les deux façons de noter

| Outil | Qui note | Comment |
| --- | --- | --- |
| Crime GeoGuess | son serveur | Il tire les enquêtes, compte le temps, accepte un essai par enquête, puis envoie la note signée à `POST /api/external/result`. |
| Cybersup OS | la plateforme | La page de l'outil reçoit le contenu sans les réponses (`GET /api/external/session`) et renvoie les choix du candidat (`POST /api/external/answers`). Le corrigé reste en base. |

Dans les deux cas, l'outil reçoit un jeton de lancement signé (HMAC-SHA256) dans le fragment de l'adresse (`/exam#t=…`). Il est lié à la session de l'exercice par un nonce et expire à la fin de l'exercice. Chaque envoi porte un compteur `seq` strictement croissant : un ancien envoi rejoué est refusé. Plus rien n'est accepté après la remise de la copie.

## Réglages

Plateforme (`.env`) :

```
EXTERNAL_CRIME_URL=https://crime.cybersup.ai
EXTERNAL_CRIME_SECRET=<openssl rand -hex 32>
EXTERNAL_WIN95_URL=https://win95.cybersup.ai
EXTERNAL_WIN95_SECRET=<openssl rand -hex 32>
```

Crime GeoGuess (`.env` du projet, lu par `docker-compose.yml`) :

```
EXAM_SHARED_SECRET=<le même que EXTERNAL_CRIME_SECRET>
EXAM_PLATFORM_URL=https://exam.cybersup.ai
```

Cybersup OS n'a pas de secret : il ne fait qu'afficher et transmettre.

Les deux outils n'acceptent d'être affichés en cadre que sur leur page `/exam`, et seulement par `https://exam.cybersup.ai` (`frame-ancestors` dans leur `nginx.conf`). À changer si l'adresse de la plateforme change.

## Préparer un exercice Cybersup OS

Dans le projet Cybersup OS :

```
npm run export:exam -- --mails 6 --sms 0 --urls 0
```

Le scénario (`exam-export/scenario.json`) et le corrigé (`exam-export/answer_key.json`) se collent dans l'éditeur de l'épreuve. Le dossier `exam-export/` n'est jamais publié (exclu du déploiement et de git).

## Crime GeoGuess : scénario

`{"count": 2, "difficulty": "normal", "with_flag": true}` tire 2 enquêtes pour chaque candidat (les moins servies d'abord, donc des enquêtes différentes d'un candidat à l'autre). `case_ids` impose des enquêtes précises. `scoring: "standard"` reprend le barème du jeu ; par défaut le barème est celui du Hack Sprint, plus exigeant sur la distance. Il faut assez d'enquêtes en base pour la difficulté choisie, sinon l'exercice affiche une erreur.
