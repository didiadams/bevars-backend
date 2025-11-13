import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1731456789012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Order table indexes for faster queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_order_status" ON "order" ("status");
      CREATE INDEX IF NOT EXISTS "idx_order_exporter_id" ON "order" ("exporterId");
      CREATE INDEX IF NOT EXISTS "idx_order_global_buyer_id" ON "order" ("globalBuyerId");
      CREATE INDEX IF NOT EXISTS "idx_order_created_at" ON "order" ("createdAt");
      CREATE INDEX IF NOT EXISTS "idx_order_awaiting_approval" ON "order" ("awaitingApprovalFor") WHERE "awaitingApprovalFor" IS NOT NULL;
      CREATE INDEX IF NOT EXISTS "idx_order_dispute_escalation" ON "order" ("disputeEscalationAt") WHERE "disputeEscalationAt" IS NOT NULL;
    `);

    // Sourcing request indexes for marketplace search
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sourcing_request_status" ON "sourcing_request" ("status");
      CREATE INDEX IF NOT EXISTS "idx_sourcing_request_product_category" ON "sourcing_request" ("productCategory");
      CREATE INDEX IF NOT EXISTS "idx_sourcing_request_created_at" ON "sourcing_request" ("createdAt");
      CREATE INDEX IF NOT EXISTS "idx_sourcing_request_quotation_deadline" ON "sourcing_request" ("quotationDeadline") WHERE "quotationDeadline" IS NOT NULL;
      CREATE INDEX IF NOT EXISTS "idx_sourcing_request_buyer_id" ON "sourcing_request" ("globalBuyerId");
    `);

    // Offer indexes for faster negotiation queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_offer_status" ON "offer" ("status");
      CREATE INDEX IF NOT EXISTS "idx_offer_sourcing_request_id" ON "offer" ("sourcingRequestId");
      CREATE INDEX IF NOT EXISTS "idx_offer_exporter_id" ON "offer" ("exporterId");
      CREATE INDEX IF NOT EXISTS "idx_offer_created_at" ON "offer" ("createdAt");
    `);

    // Order document indexes for compliance checks
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_order_document_order_id" ON "order_document" ("orderId");
      CREATE INDEX IF NOT EXISTS "idx_order_document_type" ON "order_document" ("type");
      CREATE INDEX IF NOT EXISTS "idx_order_document_uploaded_at" ON "order_document" ("uploadedAt");
    `);

    // User indexes for auth and search
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_email" ON "user" ("email");
      CREATE INDEX IF NOT EXISTS "idx_user_role" ON "user" ("role");
      CREATE INDEX IF NOT EXISTS "idx_user_email_verified" ON "user" ("isEmailVerified");
    `);

    // Composite indexes for common queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_order_buyer_status" ON "order" ("globalBuyerId", "status");
      CREATE INDEX IF NOT EXISTS "idx_order_exporter_status" ON "order" ("exporterId", "status");
      CREATE INDEX IF NOT EXISTS "idx_offer_request_status" ON "offer" ("sourcingRequestId", "status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all indexes in reverse order
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_offer_request_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_exporter_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_buyer_status";`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_email_verified";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_role";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_email";`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_document_uploaded_at";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_document_type";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_document_order_id";`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_offer_created_at";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_offer_exporter_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_offer_sourcing_request_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_offer_status";`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sourcing_request_buyer_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sourcing_request_quotation_deadline";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sourcing_request_created_at";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sourcing_request_product_category";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sourcing_request_status";`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_dispute_escalation";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_awaiting_approval";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_created_at";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_global_buyer_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_exporter_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_status";`);
  }
}
