const { AppDataSource } = require('../dist/ormconfig.js');

async function markMigrationExecuted() {
  await AppDataSource.initialize();
  
  try {
    // Mark InitiateSchema as executed without running it
    await AppDataSource.query(`
      INSERT INTO migrations (timestamp, name) 
      VALUES ($1, $2) 
      ON CONFLICT (timestamp) DO NOTHING
    `, [1758246408501, 'InitiateSchema1758246408501']);
    
    console.log('✅ InitiateSchema marked as executed');
    
    // Check migration status
    const migrations = await AppDataSource.query(
      'SELECT * FROM migrations ORDER BY timestamp'
    );
    console.log(`\n📊 Total executed migrations: ${migrations.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await AppDataSource.destroy();
}

markMigrationExecuted().catch(console.error);