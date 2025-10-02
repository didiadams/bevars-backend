const { AppDataSource } = require('./dist/ormconfig.js');
const path = require('path');
const fs = require('fs');

async function debugMigrations() {
  try {
    console.log('🔍 Debugging migration paths...');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('__dirname from dist:', __dirname);
    
    // Get the actual migration path
    const config = AppDataSource.options;
    console.log('\n📋 TypeORM Configuration:');
    console.log('Migration paths:', config.migrations);
    console.log('Entity paths:', config.entities);
    
    // Check if migration files exist
    const migrationPaths = Array.isArray(config.migrations) ? config.migrations : [config.migrations];
    
    for (const migPath of migrationPaths) {
      console.log(`\n📁 Checking migration path: ${migPath}`);
      
      // Try to resolve the glob pattern
      const glob = require('glob');
      try {
        const files = glob.sync(migPath);
        console.log(`Found ${files.length} migration files:`);
        files.forEach(file => console.log(`  - ${file}`));
        
        if (files.length === 0) {
          // Check if directory exists
          const dir = path.dirname(migPath);
          console.log(`Directory exists: ${fs.existsSync(dir)}`);
          if (fs.existsSync(dir)) {
            const dirFiles = fs.readdirSync(dir);
            console.log(`Files in directory:`, dirFiles);
          }
        }
      } catch (error) {
        console.error(`Error reading path: ${error.message}`);
      }
    }
    
    // Try to initialize and see what TypeORM finds
    console.log('\n🔌 Testing database connection...');
    await AppDataSource.initialize();
    console.log('✅ Connected successfully');
    
    // Use TypeORM's internal migration finder
    const migrations = AppDataSource.migrations;
    console.log(`\n📊 TypeORM found ${migrations.length} migration classes:`);
    migrations.forEach((migration, i) => {
      console.log(`${i + 1}. ${migration.name}`);
    });
    
    await AppDataSource.destroy();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugMigrations();