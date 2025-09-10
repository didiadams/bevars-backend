#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/bevars/backups"
mkdir -p $BACKUP_DIR

echo "📦 Creating backup for Bevars Exporters..."

# Database backup
echo "🗄️ Backing up database..."
pg_dump -h localhost -U bevars_user -d bevars_exporters > "$BACKUP_DIR/db_backup_$DATE.sql"

# Compress database backup
gzip "$BACKUP_DIR/db_backup_$DATE.sql"

# Application backup (without node_modules)
echo "📁 Backing up application files..."
tar --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='*.log' --exclude='.next' \
    -czf "$BACKUP_DIR/app_backup_$DATE.tar.gz" -C /home/bevars bevars-exporters

# Environment backup
echo "⚙️ Backing up configuration..."
if [ -f "/home/bevars/bevars-exporters/backend/.env.production" ]; then
    cp /home/bevars/bevars-exporters/backend/.env.production "$BACKUP_DIR/env_backup_$DATE"
fi
if [ -f "/home/bevars/bevars-exporters/frontend/.env.production" ]; then
    cp /home/bevars/bevars-exporters/frontend/.env.production "$BACKUP_DIR/frontend_env_backup_$DATE"
fi
if [ -f "/home/bevars/bevars-exporters/ecosystem.config.js" ]; then
    cp /home/bevars/bevars-exporters/ecosystem.config.js "$BACKUP_DIR/pm2_config_backup_$DATE.js"
fi

# Keep only last 7 days of backups
echo "🧹 Cleaning old backups..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "env_backup_*" -mtime +7 -delete
find $BACKUP_DIR -name "pm2_config_backup_*" -mtime +7 -delete

# Show backup size
BACKUP_SIZE=$(du -sh $BACKUP_DIR | cut -f1)
echo "✅ Backup completed successfully!"
echo "📊 Total backup size: $BACKUP_SIZE"
echo "📁 Latest files:"
ls -lah $BACKUP_DIR/*$DATE*
