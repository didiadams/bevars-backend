const { AppDataSource } = require('../dist/ormconfig.js');

async function verifyProduction() {
  await AppDataSource.initialize();
  
  try {
    console.log('🔍 Production Database Verification');
    console.log('==================================');
    
    // Check migrations
    const migrations = await AppDataSource.query('SELECT * FROM migrations ORDER BY timestamp');
    console.log(`✅ Executed migrations: ${migrations.length}/10`);
    
    // Check tables
    const tables = await AppDataSource.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename != 'migrations'
      ORDER BY tablename
    `);
    console.log(`✅ Application tables: ${tables.length}`);
    
    // Check key tables exist
    const keyTables = ['user', 'exporter', 'global_buyer', 'offer', 'sourcing_request', 'order'];
    const existingTables = tables.map(t => t.tablename);
    
    console.log('\n📊 Key Tables Status:');
    keyTables.forEach(table => {
      const exists = existingTables.includes(table);
      console.log(`${exists ? '✅' : '❌'} ${table}: ${exists ? 'EXISTS' : 'MISSING'}`);
    });
    
    // Check enum types
    const enums = await AppDataSource.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typcategory = 'E' 
      ORDER BY typname
    `);
    console.log(`\n✅ Enum types: ${enums.length}`);
    
    console.log('\n🎉 Production verification completed!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
  
  await AppDataSource.destroy();
}

verifyProduction().catch(console.error);