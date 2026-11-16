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
[ $# -ge 1 ] || { echo "Usage : $0 fichier.sql [autre.sql …]" >&2; exit 1; }
source scripts/_jeton-supabase.sh

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
