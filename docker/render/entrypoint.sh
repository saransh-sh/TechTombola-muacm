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

# Ensure mandatory production secrets exist
if [ -z "$JWT_SECRET" ] || [ "${#JWT_SECRET}" -lt 32 ]; then
  echo "=> Notice: Generating secure 32-character JWT_SECRET for this instance..."
  export JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
fi

if [ -z "$SESSION_SECRET" ] || [ "${#SESSION_SECRET}" -lt 32 ]; then
  echo "=> Notice: Generating secure 32-character SESSION_SECRET for this instance..."
  export SESSION_SECRET=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
fi

if [ -n "$RENDER_EXTERNAL_URL" ]; then
  export APP_URL="${APP_URL:-$RENDER_EXTERNAL_URL}"
  export CORS_ORIGIN="${CORS_ORIGIN:-$RENDER_EXTERNAL_URL}"
fi

# 1. Database Initialization
# Check if external DATABASE_URL is provided, else run embedded PostgreSQL
if [ -z "$DATABASE_URL" ] || echo "$DATABASE_URL" | grep -qE "(127\.0\.0\.1|localhost)"; then
  echo "=> [1/4] No external DATABASE_URL detected. Setting up embedded PostgreSQL..."
  
  PGDATA="${PGDATA:-/var/lib/postgresql/data}"
  PGLOG_DIR="/var/log/postgresql"
  PGLOG_FILE="$PGLOG_DIR/postgresql.log"

  mkdir -p "$PGDATA" /var/run/postgresql "$PGLOG_DIR"
  chown -R postgres:postgres "$PGDATA" /var/run/postgresql "$PGLOG_DIR"
  chmod 0700 "$PGDATA"
  chmod 0777 /var/run/postgresql
  chmod 0777 "$PGLOG_DIR"
  touch "$PGLOG_FILE" 2>/dev/null || true
  chown postgres:postgres "$PGLOG_FILE" 2>/dev/null || true

  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "=> Initializing new PostgreSQL cluster in $PGDATA..."
    # Ensure directory is empty for initdb if no initialized cluster exists yet
    rm -rf "$PGDATA"/* "$PGDATA"/.[!.]* 2>/dev/null || true
    su - postgres -c "$PG_BIN/initdb -D '$PGDATA' --auth-local=trust --auth-host=trust -E UTF8"
  fi

  echo "=> Starting embedded PostgreSQL server..."
  su - postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' -o '-c listen_addresses=127.0.0.1 -c port=5432 -c unix_socket_directories=/var/run/postgresql' -l '$PGLOG_FILE' start" || {
    echo "ERROR: pg_ctl failed to start PostgreSQL. Log output:"
    cat "$PGLOG_FILE" 2>/dev/null || true
    exit 1
  }

  echo "=> Waiting for PostgreSQL to be ready..."
  PG_READY=0
  for i in $(seq 1 30); do
    if su - postgres -c "$PG_BIN/pg_isready -h 127.0.0.1 -p 5432" >/dev/null 2>&1; then
      echo "=> PostgreSQL is ready!"
      PG_READY=1
      break
    fi
    sleep 1
  done

  if [ "$PG_READY" -eq 0 ]; then
    echo "ERROR: PostgreSQL was not ready within 30 seconds. Log output:"
    cat "$PGLOG_FILE" 2>/dev/null || true
    exit 1
  fi

  # Ensure techtombola database exists and user is configured
  su - postgres -c "$PG_BIN/psql -h 127.0.0.1 -p 5432 -U postgres -tc \"SELECT 1 FROM pg_database WHERE datname = 'techtombola'\" | grep -q 1 || $PG_BIN/psql -h 127.0.0.1 -p 5432 -U postgres -c \"CREATE DATABASE techtombola;\""
  su - postgres -c "$PG_BIN/psql -h 127.0.0.1 -p 5432 -U postgres -c \"ALTER USER postgres WITH PASSWORD 'postgres';\""

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

# Automated Seeding (10 Default Accounts, Event, Round & Tickets)
if [ "${AUTO_SEED:-true}" = "true" ]; then
  echo "=> [2.5/4] Seeding initial accounts and live event..."
  bun seed.js || {
    echo "WARNING: Seeding encountered a warning or already seeded. Continuing..."
  }
fi

# 3. Nginx Configuration
PUBLIC_PORT="${PORT:-10000}"
echo "=> [3/4] Configuring Nginx to listen on public port $PUBLIC_PORT..."
mkdir -p /etc/nginx/conf.d
PORT="$PUBLIC_PORT" envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# 4. Start Backend Server
echo "=> [4/4] Starting Tech Tombola Fastify backend on 127.0.0.1:3000..."
export HOST="127.0.0.1"
export PORT="3000"
bun server.js &
BACKEND_PID=$!

# Wait for backend readiness probe
echo "=> Probing backend startup..."
BACKEND_READY=0
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/ready >/dev/null 2>&1; then
    echo "=> Backend is up and healthy!"
    BACKEND_READY=1
    break
  fi
  sleep 1
done

if [ "$BACKEND_READY" -eq 0 ]; then
  echo "ERROR: Backend did not pass readiness probe on 127.0.0.1:3000."
  exit 1
fi

# Start Nginx in foreground
echo "=> Starting Nginx reverse proxy..."
nginx -g "daemon off;" &
NGINX_PID=$!

echo "========================================================"
echo " Tech Tombola successfully launched on Render port $PUBLIC_PORT "
echo "========================================================"
echo "=> Demo Accounts Available (Password: ${SEED_DEFAULT_PASSWORD:-Tombola@2026}):"
echo "   - Super Admin: superadmin@techtombola.com"
echo "   - Admins (3):  admin1@techtombola.com, admin2@techtombola.com, admin3@techtombola.com"
echo "   - Players (6): player1@techtombola.com ... player6@techtombola.com"
echo "========================================================"

# Graceful shutdown handler
cleanup() {
  echo "=> Received shutdown signal. Terminating processes..."
  kill -TERM "$NGINX_PID" "$BACKEND_PID" 2>/dev/null || true
  if [ -n "$PGDATA" ] && [ -f "$PGDATA/postmaster.pid" ]; then
    echo "=> Stopping PostgreSQL..."
    su - postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' -m fast stop" 2>/dev/null || true
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
