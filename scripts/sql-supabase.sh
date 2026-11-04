#!/usr/bin/env bash
# Exécute un ou plusieurs fichiers SQL sur la base Supabase, par l'API de gestion
# (POST https://api.supabase.com/v1/projects/<ref>/database/query), sans passer par l'éditeur SQL.
#
# Usage : ./scripts/sql-supabase.sh fichier1.sql [fichier2.sql …]
#
# Il faut un jeton personnel Supabase (sbp_…), créé une fois dans Supabase :
# avatar en haut à droite, Account preferences, Access Tokens, Generate new token.
# Au premier lancement, copiez le jeton puis appuyez sur Entrée : il est lu dans le
# presse-papiers (macOS), rangé dans .env.production (droits 600) et jamais affiché.
set -euo pipefail
cd "$(dirname "$0")/.."
F=.env.production
[ -f "$F" ] || { echo "Fichier $F introuvable." >&2; exit 1; }
[ $# -ge 1 ] || { echo "Usage : $0 fichier.sql [autre.sql …]" >&2; exit 1; }

get() { grep -E "^$1=" "$F" | tail -1 | cut -d= -f2- | tr -d "\"'[:space:]" || true; }

TOKEN="$(get SUPABASE_ACCESS_TOKEN)"
if [[ "$TOKEN" != sbp_* ]]; then
  while true; do
    read -r -p "Copiez votre jeton personnel Supabase (sbp_…), puis appuyez sur Entrée… " _
    v="$(pbpaste | tr -d '[:space:]')"
    if [[ "$v" == sbp_* ]]; then
      awk -v v="$v" 'BEGIN{d=0} /^SUPABASE_ACCESS_TOKEN=/ {print "SUPABASE_ACCESS_TOKEN="v; d=1; next} {print} END{if(!d) print "SUPABASE_ACCESS_TOKEN="v}' "$F" > "$F.tmp"
      mv "$F.tmp" "$F"; chmod 600 "$F"; printf '' | pbcopy
      TOKEN="$v"; echo "  ✓ jeton enregistré, presse-papiers vidé"; break
    fi
    echo "  Ce n'est pas un jeton personnel Supabase (il commence par sbp_). Réessayez."
  done
fi

URL="$(get NEXT_PUBLIC_SUPABASE_URL)"
REF="$(printf '%s' "$URL" | sed -E 's#https://([a-z0-9]+)\.supabase\.co.*#\1#')"
[ -n "$REF" ] && [ "$REF" != "$URL" ] || { echo "Référence du projet introuvable dans NEXT_PUBLIC_SUPABASE_URL." >&2; exit 1; }

for SQL in "$@"; do
  [ -f "$SQL" ] || { echo "Fichier introuvable : $SQL" >&2; exit 1; }
  echo "→ $SQL"
  CODE=$(node -e 'process.stdout.write(JSON.stringify({ query: require("fs").readFileSync(process.argv[1], "utf8") }))' "$SQL" \
    | curl -sS -o /tmp/sql-supabase.out -w '%{http_code}' -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @-)
  if [ "$CODE" -ge 200 ] && [ "$CODE" -lt 300 ]; then
    echo "  ✓ exécuté"
  else
    echo "  ✗ erreur $CODE :"; head -c 2000 /tmp/sql-supabase.out; echo; rm -f /tmp/sql-supabase.out; exit 1
  fi
done
rm -f /tmp/sql-supabase.out
echo "Terminé."
