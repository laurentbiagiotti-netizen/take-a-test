#!/usr/bin/env bash
# Déploiement de Cybersup Examen (exam.cybersup.ai) sur le serveur.
# Même principe que Cybersup-OS : le build Next.js tourne en NATIF sur le
# serveur (le Docker du serveur ne peut pas exécuter les binaires de build),
# puis Docker ne fait que lancer l'application et la tâche planifiée.
#
# Usage :
#   ./deploy.sh             build + déploiement
#   ./deploy.sh --no-cache  force la reconstruction de l'image Docker
#
# Configuration : si un fichier .env.production existe à côté de ce script
# (jamais versionné), il est envoyé sur le serveur comme .env.local. Sinon,
# le .env.local déjà présent sur le serveur est gardé tel quel.
# Le secret partagé avec Crime GeoGuess (EXTERNAL_CRIME_SECRET) est aussi
# recopié dans ~/crime-geoguess/.env (EXAM_SHARED_SECRET) et l'API de Crime
# GeoGuess est relancée si la valeur a changé.

set -euo pipefail

BUILD_FLAGS=""
if [[ "${1:-}" == "--no-cache" ]]; then BUILD_FLAGS="--no-cache"; fi

REMOTE_USER="apagon"
REMOTE_HOST="195.154.246.214"
REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_DIR="/home/${REMOTE_USER}/cybersup-examen"
ARCHIVE_NAME="cybersup-examen-deploy.tar.gz"
LOCAL_ARCHIVE="/tmp/${ARCHIVE_NAME}"
REMOTE_ARCHIVE="/home/${REMOTE_USER}/${ARCHIVE_NAME}"
EXAM_PORT="${EXAM_PORT:-31340}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "==> Archivage des sources…"
rm -f "${LOCAL_ARCHIVE}"
# Pas d'exclusion « tests » : le tar de macOS l'appliquerait aussi à app/admin/tests.
COPYFILE_DISABLE=1 tar czf "${LOCAL_ARCHIVE}" \
    --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./.next' \
    --exclude='./.env.local' \
    --exclude='./.env' \
    --exclude='./_transfert_claude_*' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    --exclude='._*' \
    --exclude='**/._*' \
    .
echo "    Archive : ${LOCAL_ARCHIVE} ($(du -h "${LOCAL_ARCHIVE}" | cut -f1))"

echo "==> Upload vers ${REMOTE_TARGET}…"
scp "${LOCAL_ARCHIVE}" "${REMOTE_TARGET}:${REMOTE_ARCHIVE}"
if [ -f .env.production ]; then
    echo "==> Envoi de la configuration (.env.production)…"
    ssh "${REMOTE_TARGET}" "mkdir -p ${REMOTE_DIR} && umask 077 && cat > ${REMOTE_DIR}/.env.local" < .env.production
fi

echo "==> Build et déploiement distant…"
ssh "${REMOTE_TARGET}" \
    REMOTE_DIR="${REMOTE_DIR}" \
    REMOTE_ARCHIVE="${REMOTE_ARCHIVE}" \
    BUILD_FLAGS="${BUILD_FLAGS}" \
    EXAM_PORT="${EXAM_PORT}" \
    bash <<'EOF'
set -euo pipefail

mkdir -p "${REMOTE_DIR}"
tar xzf "${REMOTE_ARCHIVE}" -C "${REMOTE_DIR}" --overwrite
rm -f "${REMOTE_ARCHIVE}"
cd "${REMOTE_DIR}"
find . -name "._*" -type f -delete 2>/dev/null || true

# Configuration : créée au premier passage, à remplir une fois sur le serveur
if [ ! -f .env.local ]; then
    cp .env.local.example .env.local
    chmod 600 .env.local
    echo ""
    echo "    [remote] Premier déploiement : ${REMOTE_DIR}/.env.local vient d'être créé."
    echo "    [remote] Remplis-le (clés Supabase, CRON_SECRET, API_SECRETS_KEY, secrets des outils), puis relance ./deploy.sh"
    exit 2
fi
for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY APP_URL CRON_SECRET API_SECRETS_KEY; do
    if ! grep -qE "^${v}=.+" .env.local; then
        echo "    [remote] ERREUR : ${v} est vide dans ${REMOTE_DIR}/.env.local" >&2
        exit 1
    fi
done
if grep -q "xxxx.supabase.co" .env.local; then
    echo "    [remote] ERREUR : NEXT_PUBLIC_SUPABASE_URL contient encore l'exemple" >&2
    exit 1
fi
echo "    [remote] Configuration présente ✓"

NODE_MAJOR=$(node -v 2>/dev/null | grep -oP 'v\K[0-9]+' || echo "0")
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "    [remote] Node 20 ou plus requis (actuel : $(node -v 2>/dev/null || echo absent))" >&2
    exit 1
fi
echo "    [remote] Node $(node -v) ✓"

echo "    [remote] Installation des dépendances…"
npm ci --no-audit --no-fund

echo "    [remote] Build Next.js (les variables NEXT_PUBLIC_ sont lues maintenant)…"
rm -rf .next
set -a; . ./.env.local; set +a
npm run build

echo "    [remote] Dépendances de production seulement…"
npm prune --omit=dev --no-audit --no-fund

if docker compose version >/dev/null 2>&1; then DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"
else echo "    [remote] ERREUR : docker compose introuvable" >&2; exit 1; fi

echo "    [remote] Image Docker et redémarrage…"
$DC build ${BUILD_FLAGS}
$DC up -d --force-recreate --remove-orphans
sleep 5
$DC ps

# Secret partagé avec Crime GeoGuess
CRIME_SECRET=$(grep -E '^EXTERNAL_CRIME_SECRET=' .env.local | cut -d= -f2- || true)
CRIME_DIR="$HOME/crime-geoguess"
if [ -n "${CRIME_SECRET}" ] && [ -d "${CRIME_DIR}" ]; then
    touch "${CRIME_DIR}/.env"
    CURRENT=$(grep -E '^EXAM_SHARED_SECRET=' "${CRIME_DIR}/.env" | cut -d= -f2- || true)
    if [ "${CURRENT}" != "${CRIME_SECRET}" ]; then
        grep -vE '^EXAM_SHARED_SECRET=' "${CRIME_DIR}/.env" > "${CRIME_DIR}/.env.tmp" || true
        echo "EXAM_SHARED_SECRET=${CRIME_SECRET}" >> "${CRIME_DIR}/.env.tmp"
        mv "${CRIME_DIR}/.env.tmp" "${CRIME_DIR}/.env"
        chmod 600 "${CRIME_DIR}/.env"
        echo "    [remote] Secret Crime GeoGuess mis à jour, relance de son API…"
        (cd "${CRIME_DIR}" && $DC up -d --force-recreate api) || echo "    [remote] Relance de Crime GeoGuess à faire à la main" >&2
    else
        echo "    [remote] Secret Crime GeoGuess déjà en place ✓"
    fi
fi

if curl -fsS -o /dev/null "http://127.0.0.1:${EXAM_PORT}/login"; then
    echo "    [remote] Application en ligne sur le port ${EXAM_PORT} ✓"
else
    echo "    [remote] L'application ne répond pas encore : ${DC} logs --tail 50 app" >&2
fi
EOF

rm -f "${LOCAL_ARCHIVE}"
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  Déploiement terminé"
echo "  Interne : http://${REMOTE_HOST}:${EXAM_PORT}/"
echo "  Public  : https://exam.cybersup.ai (via le proxy HTTPS du serveur)"
echo "════════════════════════════════════════════════════════════════════"
