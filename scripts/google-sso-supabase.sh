#!/usr/bin/env bash
# Active la connexion Google (SSO) dans Supabase avec le client OAuth téléchargé depuis Google Cloud
# (code secret lu dans le presse-papiers, ou fichier client_secret_….json passé en argument), et ajoute l'URL de retour du site.
# Le secret n'est jamais affiché ; le presse-papiers est vidé et le fichier supprimé une fois la configuration faite.
#
# Usage : ./scripts/google-sso-supabase.sh            (copier d'abord le code secret GOCSPX-…)
#         ./scripts/google-sso-supabase.sh fichier.json
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_jeton-supabase.sh

CLIENT_ID="${GOOGLE_CLIENT_ID:-505370948041-lvhm2vp0fktqqmdis172l7sa6rgsn356.apps.googleusercontent.com}"
J="${1:-}"
if [ -z "$J" ]; then
  read -r -p "Copiez le code secret du client Google (GOCSPX-…), puis appuyez sur Entrée… " _
  SECRET="$(pbpaste | tr -d '[:space:]')"; printf '' | pbcopy
  [[ "$SECRET" == GOCSPX-* ]] || { echo "Ce n'est pas un code secret Google (il commence par GOCSPX-)." >&2; exit 1; }
  J="$(mktemp)"; chmod 600 "$J"
  printf '{"web":{"client_id":"%s","client_secret":"%s"}}' "$CLIENT_ID" "$SECRET" > "$J"; unset SECRET
fi
[ -f "$J" ] || { echo "Fichier introuvable : $J" >&2; exit 1; }
APP="$(get APP_URL)"; APP="${APP:-https://exam.cybersup.ai}"
CB="$APP/auth/callback"
API="https://api.supabase.com/v1/projects/$REF/config/auth"

CUR=$(curl -sS "$API" -H "Authorization: Bearer $TOKEN")
BODY=$(J="$J" CB="$CB" CUR="$CUR" node -e '
  const f = JSON.parse(require("fs").readFileSync(process.env.J, "utf8")); const c = f.web || f.installed || {};
  if (!c.client_id || !c.client_secret) { console.error("Fichier JSON sans client_id ou client_secret."); process.exit(1); }
  let cur = {}; try { cur = JSON.parse(process.env.CUR); } catch {}
  const list = String(cur.uri_allow_list || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.includes(process.env.CB)) list.push(process.env.CB);
  process.stdout.write(JSON.stringify({ external_google_enabled: true, external_google_client_id: c.client_id,
    external_google_secret: c.client_secret, uri_allow_list: list.join(",") }));')
CODE=$(printf '%s' "$BODY" | curl -sS -o /tmp/sso.out -w '%{http_code}' -X PATCH "$API" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @-)
if [ "$CODE" -ge 200 ] && [ "$CODE" -lt 300 ]; then
  rm -f /tmp/sso.out "$J"
  echo "  ✓ Google activé dans Supabase, URL de retour $CB autorisée, fichier du secret supprimé."
else
  echo "  ✗ erreur $CODE :"; head -c 800 /tmp/sso.out | sed -E 's/"external_google_secret":"[^"]*"/"external_google_secret":"***"/g'; echo; rm -f /tmp/sso.out; exit 1
fi
