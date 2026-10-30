#!/usr/bin/env bash
# Rejoue chaque suite SQL sur une base neuve et compare le nombre d'erreurs
# (attaques refusées) à la valeur attendue. PSQL permet d'adapter la commande,
# par exemple PSQL="sudo -u postgres psql" en local.
set -u
cd "$(dirname "$0")"
PSQL=${PSQL:-psql}
DB=${TEST_DB:-cx_test}
fail=0
while read -r suite expected; do
  [ -z "$suite" ] && continue
  $PSQL -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null 2>&1
  if ! $PSQL -q -d "$DB" -v ON_ERROR_STOP=1 -f stub.sql -f ../../supabase/schema.sql >/dev/null 2>schema.err; then
    echo "ÉCHEC schéma"; cat schema.err; exit 1
  fi
  got=$($PSQL -d "$DB" -f "$suite" 2>&1 | grep -c "ERROR")
  if [ "$got" = "$expected" ]; then echo "ok    $suite ($got erreurs attendues)"; else echo "ÉCHEC $suite : $got erreurs au lieu de $expected"; $PSQL -d "$DB" -f "$suite" 2>&1 | grep ERROR; fail=1; fi
done < expected.txt
rm -f schema.err
exit $fail
