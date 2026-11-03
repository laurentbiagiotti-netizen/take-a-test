# Image d'exécution seulement : le build Next.js est fait en natif sur le
# serveur par deploy.sh (le Docker du serveur ne peut pas exécuter les
# binaires de build). Aucune commande RUN ici.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY package.json next.config.js ./
COPY node_modules ./node_modules
COPY .next ./.next
COPY public ./public
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
