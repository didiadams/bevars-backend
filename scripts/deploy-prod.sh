#!/bin/bash

echo "🚀 Production Migration Deployment Script"
echo "========================================"

# Set production environment
export NODE_ENV=production

# Step 1: Build the application
echo "📦 Building application..."
yarn build

# Step 2: Check current migration status
echo "📊 Checking current migration status..."
yarn migration:show

# Step 3: Run migrations with error handling
echo "🔄 Running migrations..."
if yarn migration:run:prod; then
    echo "✅ All migrations executed successfully!"
    
    # Verify final state
    echo "📊 Final migration status:"
    yarn migration:show
    
    # Count tables
    node -e "
    const { AppDataSource } = require('./dist/ormconfig.js');
    async function countTables() {
      await AppDataSource.initialize();
      try {
        const result = await AppDataSource.query(\`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        \`);
        console.log(\`📊 Total tables in database: \${result[0].count}\`);
      } catch (error) {
        console.error('Error:', error.message);
      }
      await AppDataSource.destroy();
    }
    countTables().catch(console.error);
    "
    
else
    echo "❌ Migration failed. Check logs above."
    echo "💡 Possible solutions:"
    echo "   1. Use: yarn migration:reset:prod (for fresh deployment)"
    echo "   2. Use: node scripts/mark-migration-executed.js (for existing DB)"
    exit 1
fi

echo "🎉 Production deployment completed successfully!"