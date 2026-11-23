#!/usr/bin/env bash
# Applique sur la base Supabase les migrations qui manquent, dans l'ordre du fichier
# supabase/migrations/ORDRE, et note chacune dans la table schema_migrations.
# Lancé automatiquement par deploy.sh : le code ne part plus sans sa base.
#
# Usage : ./scripts/migrer.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_jeton-supabase.sh
DIR="supabase/migrations"
SUIVI="2026-11-23-suivi.sql"

run_sql() { # $1 = requête ; réponse dans /tmp/migrer.out ; renvoie le code HTTP
  node -e 'process.stdout.write(JSON.stringify({ query: process.argv[1] }))' "$1" \
    | curl -sS -o /tmp/migrer.out -w '%{http_code}' -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @-
}
run_file() {
  node -e 'process.stdout.write(JSON.stringify({ query: require("fs").readFileSync(process.argv[1], "utf8") }))' "$1" \
    | curl -sS -o /tmp/migrer.out -w '%{http_code}' -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @-
}
apply() { # $1 = nom du fichier
  echo "→ $1"
  CODE=$(run_file "$DIR/$1")
  if [ "$CODE" -lt 200 ] || [ "$CODE" -ge 300 ]; then echo "  ✗ erreur $CODE :"; head -c 2000 /tmp/migrer.out; echo; rm -f /tmp/migrer.out; exit 1; fi
  CODE=$(run_sql "insert into schema_migrations(name) values ('$1') on conflict do nothing; notify pgrst, 'reload schema';")
  [ "$CODE" -ge 200 ] && [ "$CODE" -lt 300 ] || { echo "  ✗ migration passée mais non notée ($CODE)"; exit 1; }
  echo "  ✓ appliquée"
}

# Première fois : la table de suivi n'existe pas encore
CODE=$(run_sql "select name from schema_migrations")
if [ "$CODE" -lt 200 ] || [ "$CODE" -ge 300 ]; then
  echo "Table de suivi absente : mise en place."
  apply "$SUIVI"
  CODE=$(run_sql "select name from schema_migrations")
  [ "$CODE" -ge 200 ] && [ "$CODE" -lt 300 ] || { echo "Lecture du suivi impossible ($CODE)."; exit 1; }
fi
DONE="$(node -e 'try { const r = JSON.parse(require("fs").readFileSync("/tmp/migrer.out", "utf8")); console.log(r.map((x) => x.name).join("\n")); } catch { process.exit(1); }')"

N=0
while IFS= read -r F; do
  [ -n "$F" ] || continue
  [ -f "$DIR/$F" ] || { echo "Migration listée dans ORDRE mais absente : $F" >&2; exit 1; }
  if ! printf '%s\n' "$DONE" | grep -qxF "$F"; then apply "$F"; N=$((N + 1)); fi
done < "$DIR/ORDRE"
rm -f /tmp/migrer.out
if [ "$N" -eq 0 ]; then echo "Base à jour : aucune migration à appliquer."; else echo "$N migration(s) appliquée(s)."; fi
