#!/bin/sh

echo "=== Revio API Starting ==="
echo "NODE_ENV=$NODE_ENV"
echo "PORT=$PORT"
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo NO)"
echo "PWD=$(pwd)"

if [ -f "dist/server.js" ]; then
  echo "Entrypoint found: dist/server.js"
else
  echo "ERROR: dist/server.js not found"
  echo "Contents of dist:"
  ls -R dist 2>/dev/null || echo "dist directory missing"
  exit 1
fi

export TZ=Europe/Berlin

echo "Running prisma db push..."
if ! npx prisma db push --schema prisma/schema.production.prisma --accept-data-loss; then
  echo "ERROR: prisma db push failed — server wird nicht gestartet."
  exit 1
fi

echo "Starting node server..."
exec node dist/server.js
