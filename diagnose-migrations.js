const { AppDataSource } = require('./dist/ormconfig.js');
const fs = require('fs');
const path = require('path');

async function diagnoseMigrations() {
  try {
    console.log('🔍 Diagnosing migration loading...');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
    
    // Check migration files in dist
    const migrationDir = path.join(__dirname, 'dist/src/migrations');
    console.log(`\n📁 Checking migration directory: ${migrationDir}`);
    
    if (!fs.existsSync(migrationDir)) {
      console.error('❌ Migration directory does not exist!');
      return;
    }
    
    const files = fs.readdirSync(migrationDir);
    const jsFiles = files.filter(f => f.endsWith('.js') && !f.endsWith('.map'));
    console.log(`Found ${jsFiles.length} JS migration files:`);
    jsFiles.forEach((file, i) => console.log(`${i+1}. ${file}`));
    
    // Test loading each migration file
    console.log('\n🧪 Testing migration file loading:');
    const loadedMigrations = [];
    
    for (const file of jsFiles) {
      try {
        const migrationPath = path.join(migrationDir, file);
        const migrationModule = require(migrationPath);
        const exportedItems = Object.keys(migrationModule);
        
        console.log(`📄 ${file}:`);
        console.log(`   Exports: ${exportedItems.join(', ')}`);
        
        // Try to get the migration class
        const migrationClass = Object.values(migrationModule)[0];
        if (migrationClass && typeof migrationClass === 'function') {
          const instance = new migrationClass();
          console.log(`   ✅ Class: ${migrationClass.name}`);
          console.log(`   ✅ Instance name: ${instance.name || 'undefined'}`);
          loadedMigrations.push(migrationClass);
        } else {
          console.log(`   ❌ No valid migration class found`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Successfully loaded ${loadedMigrations.length} migration classes`);
    
    // Test TypeORM configuration
    console.log('\n🔧 Testing TypeORM configuration...');
    const config = AppDataSource.options;
    console.log('Migrations in config:', config.migrations?.length || 0);
    
    // Try to initialize
    console.log('\n🔌 Testing database connection...');
    await AppDataSource.initialize();
    console.log('✅ Database connected');
    
    // Check what TypeORM found
    const migrations = AppDataSource.migrations;
    console.log(`TypeORM loaded ${migrations.length} migrations:`);
    migrations.forEach((migration, i) => {
      console.log(`${i+1}. ${migration.name}`);
    });
    
    await AppDataSource.destroy();
    console.log('\n✅ Diagnosis complete');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error.message);
    console.error('Stack:', error.stack);
  }
}

diagnoseMigrations();