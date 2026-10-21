#!/usr/bin/env bash
set -e

echo "========================================================"
echo "    Tech Tombola — Unified Render Platform Runtime     "
echo "========================================================"

# Locate postgres binaries
PG_BIN=$(dirname "$(find /usr/lib/postgresql -name initdb 2>/dev/null | head -n 1)" 2>/dev/null || true)
if [ -z "$PG_BIN" ] || [ ! -x "$PG_BIN/initdb" ]; then
  PG_BIN="/usr/bin"
fi

# 1. Database Initialization
# Check if external DATABASE_URL is provided, else run embedded PostgreSQL
if [ -z "$DATABASE_URL" ] || echo "$DATABASE_URL" | grep -qE "(127\.0\.0\.1|localhost)"; then
  echo "=> [1/4] No external DATABASE_URL detected. Setting up embedded PostgreSQL..."
  
  PGDATA="${PGDATA:-/var/lib/postgresql/data}"
  mkdir -p "$PGDATA" /var/run/postgresql
  chown -R postgres:postgres "$PGDATA" /var/run/postgresql
  chmod 0700 "$PGDATA"

  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "=> Initializing new PostgreSQL cluster in $PGDATA..."
    su - postgres -c "$PG_BIN/initdb -D '$PGDATA' --auth-local=trust --auth-host=trust -E UTF8"
  fi

  echo "=> Starting embedded PostgreSQL server..."
  su - postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' -o '-c listen_addresses=127.0.0.1 -c port=5432' -l /var/log/postgresql.log start"

  echo "=> Waiting for PostgreSQL to be ready..."
  for i in $(seq 1 30); do
    if su - postgres -c "$PG_BIN/pg_isready -h 127.0.0.1 -p 5432" >/dev/null 2>&1; then
      echo "=> PostgreSQL is ready!"
      break
    fi
    sleep 1
  done

  # Ensure database exists
  su - postgres -c "psql -h 127.0.0.1 -p 5432 -tc \"SELECT 1 FROM pg_database WHERE datname = 'techtombola'\" | grep -q 1 || psql -h 127.0.0.1 -p 5432 -c \"CREATE DATABASE techtombola;\""

  export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/techtombola"
  echo "=> Embedded database active: techtombola on 127.0.0.1:5432"
else
  echo "=> [1/4] External DATABASE_URL detected. Skipping embedded PostgreSQL."
fi

# 2. Automated Schema Migrations
echo "=> [2/4] Executing schema migrations..."
bun migrate.js || {
  echo "ERROR: Database migrations failed! Please check DATABASE_URL."
  exit 1
}
echo "=> Migrations completed successfully."

# 3. Nginx Configuration
export PORT="${PORT:-10000}"
echo "=> [3/4] Configuring Nginx to listen on public port $PORT..."
mkdir -p /etc/nginx/conf.d
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# 4. Start Backend Server
echo "=> [4/4] Starting Tech Tombola Fastify backend on 127.0.0.1:3000..."
export HOST="127.0.0.1"
export BACKEND_PORT="3000"
bun server.js &
BACKEND_PID=$!

# Wait for backend readiness probe
echo "=> Probing backend startup..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/ready >/dev/null 2>&1; then
    echo "=> Backend is up and healthy!"
    break
  fi
  sleep 1
done

# Start Nginx in foreground
echo "=> Starting Nginx reverse proxy..."
nginx -g "daemon off;" &
NGINX_PID=$!

echo "========================================================"
echo " Tech Tombola successfully launched on Render port $PORT "
echo "========================================================"

# Graceful shutdown handler
cleanup() {
  echo "=> Received shutdown signal. Terminating processes..."
  kill -TERM "$NGINX_PID" "$BACKEND_PID" 2>/dev/null || true
  if [ -n "$PGDATA" ] && [ -f "$PGDATA/postmaster.pid" ]; then
    echo "=> Stopping PostgreSQL..."
    su - postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' -m fast stop" || true
  fi
  wait
  exit 0
}

trap cleanup SIGTERM SIGINT

# Wait for any process to exit
wait -n "$BACKEND_PID" "$NGINX_PID"
EXIT_CODE=$?
echo "=> One of the primary processes exited with code $EXIT_CODE."
cleanup
