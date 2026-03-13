#!/bin/sh
set -e

./scripts/verify-db-config.sh
npx prisma migrate deploy
node ./scripts/bootstrap-super-admin.js
node ./scripts/docker-startup-check.js
exec npm start
