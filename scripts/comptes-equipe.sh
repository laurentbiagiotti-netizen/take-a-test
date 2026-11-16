#!/usr/bin/env bash
# Prépare les comptes de l'équipe pour la connexion Google.
# Les inscriptions libres sont fermées sur Supabase (« Signups not allowed ») :
# un compte Google ne peut se connecter que s'il existe déjà. Ce script crée,
# sans mot de passe, le compte de chaque adresse de staff_allowlist qui n'en a
# pas encore ; à la première connexion Google, l'identité Google y est rattachée
# et le rôle vient de staff_allowlist.
#
# Usage : ./scripts/comptes-equipe.sh [adresse@cybersup.ai …]   (sans argument : toute la liste)
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_jeton-supabase.sh
KEY="$(get SUPABASE_SERVICE_ROLE_KEY)"
[ -n "$KEY" ] || { echo "SUPABASE_SERVICE_ROLE_KEY absente de $F." >&2; exit 1; }

sql() { node -e 'process.stdout.write(JSON.stringify({query:process.argv[1]}))' "$1" \
  | curl -sS -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @-; }

if [ $# -gt 0 ]; then EMAILS="$*"; else
  EMAILS=$(sql "select email from staff_allowlist a where not exists (select 1 from auth.users u where lower(u.email) = a.email) order by 1" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).map(r=>r.email).join(" ")))')
fi
[ -n "$EMAILS" ] || { echo "Tous les comptes de l'équipe existent déjà."; }

for e in $EMAILS; do
  e=$(printf '%s' "$e" | tr '[:upper:]' '[:lower:]')
  CODE=$(curl -sS -o /tmp/compte.json -w '%{http_code}' -X POST "$URL/auth/v1/admin/users" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$e\",\"email_confirm\":true}")
  if [ "$CODE" -ge 200 ] && [ "$CODE" -lt 300 ]; then echo "  ✓ $e"; else echo "  ✗ $e : $(head -c 200 /tmp/compte.json)"; fi
done
rm -f /tmp/compte.json
echo "Rôles :"
sql "select a.email, coalesce(p.role::text, 'pas de compte') as role from staff_allowlist a left join profiles p on p.email = a.email order by 1" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>JSON.parse(s).forEach(r=>console.log("  "+r.email+" : "+r.role)))'
