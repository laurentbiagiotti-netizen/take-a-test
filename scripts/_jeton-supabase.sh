#!/usr/bin/env bash
# Commun aux scripts Supabase : jeton personnel (sbp_…) et référence du projet.
# Le jeton est lu dans le presse-papiers (macOS), rangé dans .env.production (600), jamais affiché.
F=.env.production
[ -f "$F" ] || { echo "Fichier $F introuvable." >&2; exit 1; }
get() { grep -E "^$1=" "$F" | tail -1 | cut -d= -f2- | tr -d "\"'[:space:]" || true; }

ask_token() {
  echo "Jeton Supabase à créer : supabase.com, avatar en haut à droite, Account preferences, Access Tokens, Generate new token."
  while true; do
    read -r -p "Copiez votre jeton personnel Supabase (sbp_…), puis appuyez sur Entrée… " _
    v="$(pbpaste | tr -d '[:space:]')"
    if [[ "$v" == sbp_* ]]; then
      awk -v v="$v" 'BEGIN{d=0} /^SUPABASE_ACCESS_TOKEN=/ {print "SUPABASE_ACCESS_TOKEN="v; d=1; next} {print} END{if(!d) print "SUPABASE_ACCESS_TOKEN="v}' "$F" > "$F.tmp"
      mv "$F.tmp" "$F"; chmod 600 "$F"; printf '' | pbcopy
      TOKEN="$v"; echo "  ✓ jeton enregistré, presse-papiers vidé"; return
    fi
    echo "  Ce n'est pas un jeton personnel Supabase (il commence par sbp_). Réessayez."
  done
}

URL="$(get NEXT_PUBLIC_SUPABASE_URL)"
REF="$(printf '%s' "$URL" | sed -E 's#https://([a-z0-9]+)\.supabase\.co.*#\1#')"
[ -n "$REF" ] && [ "$REF" != "$URL" ] || { echo "Référence du projet introuvable dans NEXT_PUBLIC_SUPABASE_URL." >&2; exit 1; }

TOKEN="$(get SUPABASE_ACCESS_TOKEN)"
[[ "$TOKEN" == sbp_* ]] || ask_token
# Jeton expiré ou révoqué : on en redemande un.
if [ "$(curl -sS -o /dev/null -w '%{http_code}' "https://api.supabase.com/v1/projects/$REF" -H "Authorization: Bearer $TOKEN")" = "401" ]; then
  echo "  Le jeton enregistré n'est plus valide."; ask_token
fi
