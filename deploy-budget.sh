#!/bin/bash
set -e

echo "🚀 Starting Bevars Exporters Deployment..."

# Check if we're in the right directory
if [ ! -d "backend" ] && [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the bevars-exporters root directory"
    echo "Expected structure: backend/ and frontend/ directories"
    exit 1
fi

# Navigate to application directory
cd /home/bevars/bevars-exporters

# Pull latest changes for backend
echo "📥 Pulling latest backend changes..."
cd backend
git pull origin main

# Pull latest changes for frontend
echo "📥 Pulling latest frontend changes..."
cd ../frontend
git pull origin main

# Backend deployment
echo "🔧 Deploying Backend..."
cd ../backend
yarn install --production
yarn build

# Frontend deployment
echo "🎨 Deploying Frontend..."
cd ../frontend
yarn install --production
yarn build

# Run database migrations
echo "🗄️ Running database migrations..."
cd ../backend
if [ -f "package.json" ] && grep -q "migration:run" package.json; then
    yarn migration:run
else
    echo "⚠️ No migration script found, skipping..."
fi

# Restart applications
echo "🔄 Restarting applications..."
cd ..
pm2 restart all
pm2 save

# Health check
echo "✅ Health check..."
sleep 5
pm2 status

echo "🎉 Deployment completed successfully!"
