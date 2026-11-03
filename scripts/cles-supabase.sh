#!/usr/bin/env bash
# Range les deux clés Supabase dans .env.production sans les afficher :
# pour chacune, cliquer sur l'icône de copie dans Supabase (Settings, API Keys),
# puis appuyer sur Entrée ici. La clé est lue dans le presse-papiers (macOS).
# Accepte les nouvelles clés (sb_publishable_..., sb_secret_...) et les anciennes (eyJ...).
set -euo pipefail
cd "$(dirname "$0")/.."
F=.env.production
[ -f "$F" ] || { echo "Fichier $F introuvable." >&2; exit 1; }

setkey() {
  local name="$1" value="$2"
  awk -v k="$name" -v v="$value" 'BEGIN{done=0} $0 ~ "^"k"=" {print k"="v; done=1; next} {print} END{if(!done) print k"="v}' "$F" > "$F.tmp"
  mv "$F.tmp" "$F"
  chmod 600 "$F"
}

ask() {
  local name="$1" role="$2" label="$3" prefix="$4"
  while true; do
    read -r -p "Copie la clé « $label » dans Supabase, puis appuie sur Entrée… " _
    local v; v="$(pbpaste | tr -d '[:space:]')"
    if [[ "$v" == "$prefix"* ]]; then setkey "$name" "$v"; echo "  ✓ $name enregistrée"; break; fi
    local payload; payload="$(printf '%s' "$v" | cut -d. -f2 | tr '_-' '/+')"
    while [ $(( ${#payload} % 4 )) -ne 0 ]; do payload="$payload="; done
    if printf '%s' "$payload" | base64 -D 2>/dev/null | grep -q "\"role\":\"$role\""; then
      setkey "$name" "$v"; echo "  ✓ $name enregistrée"; break
    fi
    echo "  Ce n'est pas la clé « $label ». Réessaie."
  done
}

ask NEXT_PUBLIC_SUPABASE_ANON_KEY anon "Publishable key" sb_publishable_
ask SUPABASE_SERVICE_ROLE_KEY service_role "Secret key" sb_secret_
printf '' | pbcopy
echo "Terminé : presse-papiers vidé. Tu peux lancer ./deploy.sh"
