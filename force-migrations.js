const { AppDataSource } = require('./dist/ormconfig.js');

async function resetMigrationsTable() {
  try {
    console.log('�️  Resetting migrations table...');
    
    await AppDataSource.initialize();
    console.log('✅ Database connected');
    
    const queryRunner = AppDataSource.createQueryRunner();
    
    // Check if migrations table exists
    const tableCheck = await queryRunner.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname='public' AND tablename='migrations';
    `);
    
    if (tableCheck.length > 0) {
      console.log('� Found existing migrations table');
      
      // Show current migrations before deletion
      const existingMigrations = await queryRunner.query(`
        SELECT name FROM migrations ORDER BY timestamp ASC;
      `);
      console.log(`📊 Current migrations in table: ${existingMigrations.length}`);
      
      if (existingMigrations.length > 0) {
        console.log('Current migrations:');
        existingMigrations.forEach((m, i) => console.log(`${i+1}. ${m.name}`));
      }
      
      // Drop the migrations table
      console.log('�️  Dropping migrations table...');
      await queryRunner.query('DROP TABLE migrations;');
      console.log('✅ Migrations table dropped');
    } else {
      console.log('ℹ️  Migrations table does not exist');
    }
    
    await AppDataSource.destroy();
    console.log('🎉 Reset completed!');
    console.log('\n🚀 Now run: yarn migration:run:prod');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

resetMigrationsTable();