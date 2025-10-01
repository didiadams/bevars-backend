import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpenAccountToPaymentTerms1696099200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the new enum value to the existing Postgres enum. This uses a safe
    // ALTER TYPE ... ADD VALUE IF NOT EXISTS pattern (supported on newer PG
    // versions). If your Postgres version doesn't support IF NOT EXISTS you
    // may need to wrap in conditional logic.
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'offer_paymentterms_enum' AND e.enumlabel = 'open_account') THEN
        ALTER TYPE "public"."offer_paymentterms_enum" ADD VALUE 'open_account';
      END IF;
    END$$;`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Removing values from a Postgres enum is non-trivial; leave as noop.
    // If you need to rollback, create a new enum without the value and
    // alter the column to use it, then drop the old type. That is a
    // destructive operation and should be handled manually in production.
  }
}
