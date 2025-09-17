import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchIndexesForScalability1726047600000 implements MigrationInterface {
  name = 'AddSearchIndexesForScalability1726047600000';
 public transaction = false;
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Critical indexes for exporter search performance with millions of records
    
    // 1. Exporter status and verification indexes
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exporter_active" ON "exporter" ("isActive") WHERE "isActive" = true`
    );
    
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exporter_verified" ON "exporter" ("isVerified")`
    );
    
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exporter_featured" ON "exporter" ("isFeatured")`
    );

    // 2. Performance metrics indexes for ordering
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exporter_rating" ON "exporter" ("averageRating" DESC)`
    );
    
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exporter_orders" ON "exporter" ("completedOrders" DESC)`
    );
    
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exporter_updated" ON "exporter" ("updatedAt" DESC)`
    );

    // 3. Search-specific indexes
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exporter_primary_crops" ON "exporter" USING GIN ("primaryCrops")`
    );
    
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exporter_categories" ON "exporter" USING GIN ("productCategories")`
    );

    // 4. User country indexes for location filtering
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_country_name" ON "user" ("countryName")`
    );
    
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_country_code" ON "user" ("countryCode")`
    );

    // 5. Composite index for most common query pattern
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exporter_active_verified_rating" 
       ON "exporter" ("isActive", "isVerified", "averageRating" DESC) 
       WHERE "isActive" = true`
    );

    // 6. Text search optimization (if using PostgreSQL full-text search)
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exporter_business_description_fts" 
       ON "exporter" USING GIN (to_tsvector('english', "businessDescription"))`
    );
    
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_company_name_fts" 
       ON "user" USING GIN (to_tsvector('english', "companyName"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_user_company_name_fts"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_exporter_business_description_fts"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_exporter_active_verified_rating"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_user_country_code"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_user_country_name"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_exporter_categories"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_exporter_primary_crops"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_exporter_updated"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_exporter_orders"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_exporter_rating"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_exporter_featured"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_exporter_verified"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_exporter_active"`);
  }
}
