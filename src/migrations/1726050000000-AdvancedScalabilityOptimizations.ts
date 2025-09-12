import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvancedScalabilityOptimizations1726050000000 implements MigrationInterface {
  name = 'AdvancedScalabilityOptimizations1726050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Partitioning support for chat messages (by date)
    await queryRunner.query(`
      -- Add created_at index for partitioning
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_chat_message_created_at_month" 
      ON "chat_message" (date_trunc('month', "createdAt"))
    `);

    // 2. Advanced composite indexes for complex queries
    await queryRunner.query(`
      -- Order status and date filtering
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_order_status_created" 
      ON "order" ("status", "createdAt" DESC)
    `);

    await queryRunner.query(`
      -- Sourcing request filtering
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sourcing_request_status_deadline" 
      ON "sourcing_request" ("status", "quotationDeadline" DESC)
      WHERE "status" = 'active'
    `);

    // 3. JSON field optimization for PostgreSQL
    await queryRunner.query(`
      -- Exporter verification documents search
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exporter_verification_docs" 
      ON "exporter" USING GIN ("verificationDocuments")
    `);

    // 4. Performance analytics indexes
    await queryRunner.query(`
      -- Email logs performance
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_log_status_created" 
      ON "email_logs" ("status", "createdAt" DESC)
    `);

    await queryRunner.query(`
      -- Offer performance tracking
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_offer_status_created" 
      ON "offer" ("status", "createdAt" DESC)
    `);

    // 5. Add database-level constraints for data integrity
    await queryRunner.query(`
      -- Ensure positive values for critical business metrics
      ALTER TABLE "exporter" 
      ADD CONSTRAINT "chk_exporter_positive_rating" 
      CHECK ("averageRating" >= 0 AND "averageRating" <= 5)
    `);

    await queryRunner.query(`
      ALTER TABLE "exporter" 
      ADD CONSTRAINT "chk_exporter_positive_orders" 
      CHECK ("completedOrders" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "offer" 
      ADD CONSTRAINT "chk_offer_positive_price" 
      CHECK ("pricePerUnit" > 0 AND "totalPrice" > 0)
    `);

    // 6. Create materialized view for dashboard analytics
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_exporter_analytics" AS
      SELECT 
        e.id as exporter_id,
        e."isActive",
        e."isVerified",
        e."averageRating",
        e."completedOrders",
        u."countryName",
        u."countryCode",
        COUNT(DISTINCT o.id) as total_offers,
        COUNT(DISTINCT CASE WHEN o.status = 'accepted' THEN o.id END) as accepted_offers,
        MAX(o."createdAt") as last_offer_date,
        e."createdAt",
        e."updatedAt"
      FROM "exporter" e
      LEFT JOIN "user" u ON e."userId" = u.id
      LEFT JOIN "offer" o ON e.id = o."exporterId"
      GROUP BY e.id, u."countryName", u."countryCode"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX ON "mv_exporter_analytics" (exporter_id)
    `);

    await queryRunner.query(`
      CREATE INDEX ON "mv_exporter_analytics" ("countryName")
    `);

    await queryRunner.query(`
      CREATE INDEX ON "mv_exporter_analytics" ("averageRating" DESC)
    `);

    // 7. Add refresh function for materialized view
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION refresh_exporter_analytics()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_exporter_analytics";
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 8. Create sequence for order numbers (better than UUID for ordering)
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS order_number_seq START 100000;
    `);

    // 9. Add VACUUM and ANALYZE automation
    await queryRunner.query(`
      -- Add table statistics for query optimization
      ANALYZE "exporter";
      ANALYZE "user";
      ANALYZE "offer";
      ANALYZE "sourcing_request";
      ANALYZE "order";
      ANALYZE "chat_message";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order
    await queryRunner.query(`DROP SEQUENCE IF EXISTS order_number_seq`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS refresh_exporter_analytics()`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "mv_exporter_analytics"`);
    
    await queryRunner.query(`ALTER TABLE "offer" DROP CONSTRAINT IF EXISTS "chk_offer_positive_price"`);
    await queryRunner.query(`ALTER TABLE "exporter" DROP CONSTRAINT IF EXISTS "chk_exporter_positive_orders"`);
    await queryRunner.query(`ALTER TABLE "exporter" DROP CONSTRAINT IF EXISTS "chk_exporter_positive_rating"`);
    
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_offer_status_created"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_email_log_status_created"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_exporter_verification_docs"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_sourcing_request_status_deadline"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_order_status_created"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_chat_message_created_at_month"`);
  }
}
