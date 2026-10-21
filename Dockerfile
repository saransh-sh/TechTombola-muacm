# ==============================================================================
# Stage 1: Build Frontend (React + Vite + GSAP)
# ==============================================================================
FROM oven/bun:1.4.2 AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build

# ==============================================================================
# Stage 2: Build Backend (Fastify + Bun + Drizzle)
# ==============================================================================
FROM oven/bun:1.4.2 AS backend-build
WORKDIR /app/backend

COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile

COPY backend/src ./src
RUN bun build src/server.ts --outfile dist/server.js --target bun --external argon2 \
 && bun build src/db/migrate.ts --outfile dist/migrate.js --target bun \
 && bun build src/db/check.ts --outfile dist/check.js --target bun

# Prepare production dependencies
RUN bun install --frozen-lockfile --production

# ==============================================================================
# Stage 3: Unified Runtime (Frontend Nginx + Backend Bun + Embedded PostgreSQL)
# ==============================================================================
FROM oven/bun:1.4.2 AS runtime
WORKDIR /app

# Install system dependencies: PostgreSQL, Nginx, gettext (envsubst), curl, procps
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql \
    postgresql-contrib \
    nginx \
    gettext-base \
    curl \
    procps \
 && rm -rf /var/lib/apt/lists/*

# Setup PostgreSQL run and data directories
RUN mkdir -p /var/lib/postgresql/data /var/run/postgresql /var/log \
 && chown -R postgres:postgres /var/lib/postgresql /var/run/postgresql

# Copy compiled frontend SPA to Nginx document root
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Copy backend production bundle and migrations
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./
COPY --from=backend-build /app/backend/src/db/migrations ./migrations
COPY --from=backend-build /app/backend/package.json ./package.json

# Copy Nginx template and startup entrypoint
COPY docker/render/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/render/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Default environment configuration
ENV NODE_ENV=production \
    HOST=127.0.0.1 \
    PORT=10000 \
    LOG_LEVEL=info \
    PGDATA=/var/lib/postgresql/data

# Render exposes the port dynamically specified by $PORT (defaults to 10000)
EXPOSE 10000

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT:-10000}/ready || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
