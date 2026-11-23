#!/usr/bin/env bash
# Enregistre le client OAuth Google (mails et agenda) dans .env.production, sans
# jamais afficher le secret, puis propose de redéployer.
# Usage : ./scripts/google-oauth.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
ENV_FILE=".env.production"
[ -f "$ENV_FILE" ] || { echo "Fichier $ENV_FILE introuvable dans $(pwd)."; exit 1; }

printf "Client ID Google (se termine par .apps.googleusercontent.com) : "
read -r CID
CID="$(printf '%s' "$CID" | tr -d '[:space:]')"
case "$CID" in
  *.apps.googleusercontent.com) ;;
  *) echo "Ce n'est pas un client ID Google. Rien n'a été modifié."; exit 1 ;;
esac

printf "Client secret (la saisie reste masquée) : "
read -rs CSEC
echo
CSEC="$(printf '%s' "$CSEC" | tr -d '[:space:]')"
[ "${#CSEC}" -ge 20 ] || { echo "Secret trop court. Rien n'a été modifié."; exit 1; }

# Réécrit le fichier sans les anciennes lignes, puis ajoute les nouvelles
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
grep -v -E '^(GOOGLE_OAUTH_CLIENT_ID|GOOGLE_OAUTH_CLIENT_SECRET)=' "$ENV_FILE" > "$TMP" || true
[ -z "$(tail -c1 "$TMP")" ] || echo >> "$TMP"
printf 'GOOGLE_OAUTH_CLIENT_ID=%s\nGOOGLE_OAUTH_CLIENT_SECRET=%s\n' "$CID" "$CSEC" >> "$TMP"
umask 077
cat "$TMP" > "$ENV_FILE"
unset CSEC
echo "Client OAuth enregistré dans $ENV_FILE."

if ! grep -q -E '^API_SECRETS_KEY=.{32,}' "$ENV_FILE"; then
  echo "Attention : API_SECRETS_KEY est absente de $ENV_FILE. Elle chiffre le jeton du compte relié."
  printf "La générer maintenant ? (o/n) : "
  read -r GEN
  if [ "$GEN" = "o" ]; then
    printf 'API_SECRETS_KEY=%s\n' "$(openssl rand -hex 32)" >> "$ENV_FILE"
    echo "API_SECRETS_KEY générée."
  else
    echo "Sans elle, la page « Mails et agenda » restera en attente de configuration."
  fi
fi

echo
echo "À vérifier dans Google Cloud, sur ce client OAuth :"
echo "  - adresse de redirection : https://exam.cybersup.ai/api/admin/google/callback"
echo "  - API Gmail et Google Calendar activées"
echo
printf "Redéployer maintenant ? (o/n) : "
read -r GO
if [ "$GO" = "o" ]; then ./deploy.sh; else echo "Pas de déploiement. À lancer plus tard : ./deploy.sh"; fi
