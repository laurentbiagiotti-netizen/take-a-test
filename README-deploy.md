# Déploiement de Cybersup Examen

Même fonctionnement que Cybersup-OS : `./deploy.sh` envoie le code sur `apagon@195.154.246.214`, le build Next.js tourne en natif sur le serveur, puis Docker lance l'application (port **31340**) et la tâche planifiée (toutes les minutes).

## Une seule fois

1. **Supabase** : créer un projet, ouvrir l'éditeur SQL et exécuter tout `supabase/schema.sql`. Dans Authentication, activer la confirmation d'e-mail et le MFA (TOTP).
2. **Port** : ouvrir le port 31340 seulement pour le proxy HTTPS (pas pour tout Internet).
3. **Configuration** : remplir `.env.production` à côté de `deploy.sh` (jamais versionné). `./deploy.sh` l'envoie sur le serveur comme `.env.local` et recopie le secret de Crime GeoGuess. Sans ce fichier, le `.env.local` du serveur est gardé (créé vide au premier passage).
4. **Nom de domaine** : faire pointer `exam.cybersup.ai` vers `http://127.0.0.1:31340` dans le proxy HTTPS du serveur (le même que pour crime.cybersup.ai et win95.cybersup.ai). L'application refuse de fonctionner sans HTTPS : les cookies d'examen sont en mode sécurisé.
5. **Premier admin** : s'inscrire sur `https://exam.cybersup.ai/signup`, puis dans l'éditeur SQL Supabase : `update profiles set role = 'admin' where email = 'laurent@cybersup.ai';`
6. **Épreuves** : exécuter `supabase/seed/admission-2026.sql` dans l'éditeur SQL (B1, B3, Mastère, non publiées).

## Le fichier .env.local du serveur

Il ne quitte jamais le serveur et `./deploy.sh` ne l'écrase pas. À remplir :

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` : Supabase, Settings, API.
- `APP_URL=https://exam.cybersup.ai`
- `CRON_SECRET`, `API_SECRETS_KEY` : `openssl rand -hex 32` pour chacun.
- `EXTERNAL_CRIME_SECRET` : la même valeur que `EXAM_SHARED_SECRET` sur Crime GeoGuess.
- `EXTERNAL_WIN95_SECRET` : `openssl rand -hex 32`.
- Les mentions `NEXT_PUBLIC_LEGAL_*` de la notice candidats.

Pour l'éditer : `ssh -t apagon@195.154.246.214 'nano /home/apagon/cybersup-examen/.env.local'`

## Au quotidien

- Déployer : `./deploy.sh`
- Journaux : `ssh apagon@195.154.246.214 'cd /home/apagon/cybersup-examen && docker compose logs -f app'`
- Redémarrer : `ssh apagon@195.154.246.214 'cd /home/apagon/cybersup-examen && docker compose restart'`
- Vérifier : `curl -I http://195.154.246.214:31340/login`
