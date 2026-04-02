FROM node:20-alpine

RUN npm install -g pnpm@10.6.3

WORKDIR /app

# Copy workspace config files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/
COPY apps/admin/package.json ./apps/admin/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/api/ ./apps/api/
COPY apps/admin/ ./apps/admin/

# Generate Prisma client for PostgreSQL
RUN cd apps/api && npx prisma generate --schema prisma/schema.production.prisma

# Build TypeScript
RUN cd apps/api && npx tsc -p tsconfig.json

EXPOSE 4000

CMD ["sh", "-c", "cd apps/api && npx prisma db push --schema prisma/schema.production.prisma --skip-generate && node dist/server.js"]
