#!/bin/sh
set -e

# Simple wait-for-db and migration runner with retries
: ${DATABASE_URL:?Need to set DATABASE_URL}

max_retries=5
retry_delay=3
count=0

echo "Waiting for database..."
until node -e "require('pg').Client({connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }}).connect().then(c=>c.end()).catch(()=>{process.exit(1)})"; do
  count=$((count+1))
  if [ "$count" -ge "$max_retries" ]; then
    echo "Database not ready after $count attempts"
    exit 1
  fi
  echo "Database not ready, retrying in $retry_delay seconds... ($count/$max_retries)"
  sleep $retry_delay
done

# Run migrations with retries
count=0
until yarn migration:run:prod; do
  count=$((count+1))
  if [ "$count" -ge "$max_retries" ]; then
    echo "Migrations failed after $count attempts"
    exit 1
  fi
  echo "Migration failed, retrying in $retry_delay seconds... ($count/$max_retries)"
  sleep $retry_delay
done

# Start the application
exec yarn start:prod
