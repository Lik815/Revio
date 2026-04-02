FROM node:20-slim

RUN npm install -g pnpm@10.6.3

WORKDIR /app

# Copy workspace config files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/

# Install all dependencies (admin package.json not needed for API build)
RUN pnpm install --frozen-lockfile --filter @revio/api...

# Copy source
COPY apps/api/ ./apps/api/

# Generate Prisma client for PostgreSQL
RUN cd apps/api && npx prisma generate --schema prisma/schema.production.prisma

# Build TypeScript
RUN cd apps/api && npx tsc -p tsconfig.json

# Create uploads directory (required by @fastify/static, not in .dockerignore)
RUN mkdir -p /app/apps/api/uploads

EXPOSE 4000

WORKDIR /app/apps/api
CMD ["sh", "start.sh"]
