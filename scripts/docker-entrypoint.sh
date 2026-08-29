#!/bin/sh
# Applique les migrations Prisma puis demarre le serveur Next.js.
# Le CLI Prisma vit dans /app/migrator (arbre de deps de prod complet).
set -e

echo "[start] prisma migrate deploy"
cd /app/migrator
node_modules/.bin/prisma migrate deploy

echo "[start] starting Next.js server"
cd /app
exec node server.js
