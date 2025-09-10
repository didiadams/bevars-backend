#!/bin/bash

# Migration Helper Script
# Usage: ./migrate.sh [command] [migration-name]

set -e

case "$1" in
  "generate")
    if [ -z "$2" ]; then
      echo "Usage: ./migrate.sh generate MigrationName"
      exit 1
    fi
    echo "Generating migration: $2"
    yarn migration:generate "src/migrations/$2"
    ;;
  
  "create")
    if [ -z "$2" ]; then
      echo "Usage: ./migrate.sh create MigrationName"
      exit 1
    fi
    echo "Creating empty migration: $2"
    yarn migration:create "src/migrations/$2"
    ;;
  
  "run")
    echo "Running pending migrations..."
    yarn migration:run
    ;;
  
  "revert")
    echo "Reverting last migration..."
    yarn migration:revert
    ;;
  
  "status")
    echo "Showing migration status..."
    yarn migration:show
    ;;
  
  "reset")
    echo "WARNING: This will revert ALL migrations!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "Reverting all migrations..."
      while yarn migration:revert 2>/dev/null; do
        echo "Reverted migration"
      done
      echo "All migrations reverted"
    else
      echo "Cancelled"
    fi
    ;;
  
  "fresh")
    echo "WARNING: This will reset and re-run all migrations!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "Resetting migrations..."
      while yarn migration:revert 2>/dev/null; do
        echo "Reverted migration"
      done
      echo "Running all migrations..."
      yarn migration:run
      echo "Database refreshed"
    else
      echo "Cancelled"
    fi
    ;;
  
  *)
    echo "Migration Helper Script"
    echo ""
    echo "Usage:"
    echo "  ./migrate.sh generate MigrationName  - Generate migration from entity changes"
    echo "  ./migrate.sh create MigrationName    - Create empty migration"
    echo "  ./migrate.sh run                     - Run pending migrations"
    echo "  ./migrate.sh revert                  - Revert last migration"
    echo "  ./migrate.sh status                  - Show migration status"
    echo "  ./migrate.sh reset                   - Revert ALL migrations (dangerous)"
    echo "  ./migrate.sh fresh                   - Reset and re-run all migrations (dangerous)"
    echo ""
    echo "Examples:"
    echo "  ./migrate.sh generate AddEmailToUser"
    echo "  ./migrate.sh create AddIndexes"
    echo "  ./migrate.sh run"
    ;;
esac
