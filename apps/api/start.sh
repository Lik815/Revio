#!/bin/sh
set -e

echo "Running prisma db push..."
npx prisma db push --schema prisma/schema.production.prisma --skip-generate

echo "Starting server..."
exec node dist/server.js
