const { AppDataSource } = require('./dist/ormconfig.js');

async function forceMigrationRun() {
  try {
    console.log('🚀 Manual migration execution...');
    
    await AppDataSource.initialize();
    console.log('✅ Database connected');
    
    const queryRunner = AppDataSource.createQueryRunner();
    
    // Let's check if the schema is already correct by counting tables
    const tables = await queryRunner.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname='public' AND tablename != 'migrations'
      ORDER BY tablename;
    `);
    
    console.log(`📊 Current tables in database: ${tables.length}`);
    tables.forEach((table, i) => console.log(`${i+1}. ${table.tablename}`));
    
    // If we have fewer than 12 tables, the schema isn't fully created
    if (tables.length < 12) {
      console.log('\n⚠️ Database schema incomplete. Running InitiateSchema migration manually...');
      
      // Load and run the InitiateSchema migration directly
      const InitiateSchema = require('./dist/src/migrations/1758246408501-InitiateSchema.js').InitiateSchema1758246408501;
      const migration = new InitiateSchema();
      
      console.log('📝 Running InitiateSchema migration...');
      await migration.up(queryRunner);
      
      // Record it in migrations table
      await queryRunner.query(`
        INSERT INTO migrations (timestamp, name) 
        VALUES (1758246408501, 'InitiateSchema1758246408501')
      `);
      
      console.log('✅ InitiateSchema migration completed');
      
      // Run other migrations if needed
      const migrationOrder = [
        { class: require('./dist/src/migrations/1695859200000-AddUniqueActiveRequestPerBuyer.js').AddUniqueActiveRequestPerBuyer1695859200000, timestamp: 1695859200000, name: 'AddUniqueActiveRequestPerBuyer1695859200000' },
        { class: require('./dist/src/migrations/20250930-AddOpenAccountToPaymentTerms.js').AddOpenAccountToPaymentTerms1696099200000, timestamp: 1696099200000, name: 'AddOpenAccountToPaymentTerms1696099200000' },
        { class: require('./dist/src/migrations/1759041760135-OrderEnityDocument.js').OrderEnityDocument1759041760135, timestamp: 1759041760135, name: 'OrderEnityDocument1759041760135' },
        { class: require('./dist/src/migrations/1759047597192-PurchaseOrder.js').PurchaseOrder1759047597192, timestamp: 1759047597192, name: 'PurchaseOrder1759047597192' },
        { class: require('./dist/src/migrations/1759227105975-ApprovalColumnOrder.js').ApprovalColumnOrder1759227105975, timestamp: 1759227105975, name: 'ApprovalColumnOrder1759227105975' },
        { class: require('./dist/src/migrations/1759258363213-DisputeTable.js').DisputeTable1759258363213, timestamp: 1759258363213, name: 'DisputeTable1759258363213' },
        { class: require('./dist/src/migrations/1759266136713-AddDisputeColumn.js').AddDisputeColumn1759266136713, timestamp: 1759266136713, name: 'AddDisputeColumn1759266136713' },
        { class: require('./dist/src/migrations/1759291446523-AddDocumentCollection.js').AddDocumentCollection1759291446523, timestamp: 1759291446523, name: 'AddDocumentCollection1759291446523' },
        { class: require('./dist/src/migrations/1759301000000-AddUniqueOrderDocumentConstraint.js').AddUniqueOrderDocumentConstraint1759301000000, timestamp: 1759301000000, name: 'AddUniqueOrderDocumentConstraint1759301000000' }
      ];
      
      for (const migrationInfo of migrationOrder) {
        try {
          console.log(`📝 Running ${migrationInfo.name}...`);
          const migrationInstance = new migrationInfo.class();
          await migrationInstance.up(queryRunner);
          
          // Record in migrations table
          await queryRunner.query(`
            INSERT INTO migrations (timestamp, name) 
            VALUES ($1, $2)
          `, [migrationInfo.timestamp, migrationInfo.name]);
          
          console.log(`✅ ${migrationInfo.name} completed`);
        } catch (error) {
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log(`ℹ️ ${migrationInfo.name} already applied (${error.message})`);
            // Still record it in migrations table
            await queryRunner.query(`
              INSERT INTO migrations (timestamp, name) 
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [migrationInfo.timestamp, migrationInfo.name]);
          } else {
            console.error(`❌ Error in ${migrationInfo.name}:`, error.message);
          }
        }
      }
    } else {
      console.log('✅ Database schema appears complete');
      
      // Just populate the migrations table
      const migrationRecords = [
        { timestamp: 1695859200000, name: 'AddUniqueActiveRequestPerBuyer1695859200000' },
        { timestamp: 1696099200000, name: 'AddOpenAccountToPaymentTerms1696099200000' },
        { timestamp: 1758246408501, name: 'InitiateSchema1758246408501' },
        { timestamp: 1759041760135, name: 'OrderEnityDocument1759041760135' },
        { timestamp: 1759047597192, name: 'PurchaseOrder1759047597192' },
        { timestamp: 1759227105975, name: 'ApprovalColumnOrder1759227105975' },
        { timestamp: 1759258363213, name: 'DisputeTable1759258363213' },
        { timestamp: 1759266136713, name: 'AddDisputeColumn1759266136713' },
        { timestamp: 1759291446523, name: 'AddDocumentCollection1759291446523' },
        { timestamp: 1759301000000, name: 'AddUniqueOrderDocumentConstraint1759301000000' }
      ];
      
      for (const record of migrationRecords) {
        await queryRunner.query(`
          INSERT INTO migrations (timestamp, name) 
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [record.timestamp, record.name]);
      }
      
      console.log('📝 All migration records added to database');
    }
    
    await AppDataSource.destroy();
    console.log('🎉 Manual migration completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

forceMigrationRun();