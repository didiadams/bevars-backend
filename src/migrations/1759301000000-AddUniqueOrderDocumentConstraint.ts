import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Cleans up duplicate (orderId, type) rows in order_document, keeping the most recently uploaded
 * document (by uploadedAt desc, then id desc) before adding a UNIQUE constraint to enforce future
 * integrity. Safe to re-run because the DELETE only targets rn > 1 and the constraint block checks existence.
 */
export class AddUniqueOrderDocumentConstraint1759301000000 implements MigrationInterface {
  name = 'AddUniqueOrderDocumentConstraint1759301000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Deduplicate existing rows (keep latest) to avoid 23505 on constraint creation
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id,
               "orderId",
               type,
               ROW_NUMBER() OVER (PARTITION BY "orderId", type ORDER BY "uploadedAt" DESC NULLS LAST, id DESC) AS rn
        FROM order_document
      )
      DELETE FROM order_document
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    `);

    // 2. Add unique constraint if not already present
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_order_document_order_type'
      ) THEN
        ALTER TABLE "order_document" ADD CONSTRAINT "uq_order_document_order_type" UNIQUE ("orderId","type");
      END IF;
    END $$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_order_document_order_type'
      ) THEN
        ALTER TABLE "order_document" DROP CONSTRAINT "uq_order_document_order_type";
      END IF;
    END $$;`);
  }
}
