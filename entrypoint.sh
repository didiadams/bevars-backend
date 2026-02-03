#!/bin/sh
set -e

echo "=== Starting Bevars Backend ==="

# Validate required env
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is required"
  exit 1
fi

MAX_RETRIES=5
RETRY_DELAY=5

# Wait for database to be ready
echo "Checking database connection..."
count=0
until node -e "
  const { Client } = require('pg');
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  client.connect()
    .then(() => { client.end(); process.exit(0); })
    .catch(() => process.exit(1));
" 2>/dev/null; do
  count=$((count + 1))
  if [ "$count" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: Database not ready after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Database not ready, retry $count/$MAX_RETRIES in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
done
echo "Database connected!"

# Run migrations
echo "Running database migrations..."
count=0
until yarn migration:run:prod; do
  count=$((count + 1))
  if [ "$count" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: Migrations failed after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Migration failed, retry $count/$MAX_RETRIES in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
done
echo "Migrations complete!"

# Start the app
echo "Starting application on port ${PORT:-3000}..."
exec node dist/src/main.js
