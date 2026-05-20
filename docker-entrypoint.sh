#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set. Exiting."
  exit 1
fi

echo "Running Prisma migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "Starting Next.js server..."
exec node server.js
