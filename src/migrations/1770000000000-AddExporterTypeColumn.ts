import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExporterTypeColumn1770000000000 implements MigrationInterface {
  name = 'AddExporterTypeColumn1738500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the exporter_type enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."exporter_exporter_type_enum" AS ENUM('trader', 'manufacturer', 'farmer_producer', 'cooperative');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add the exporterType column to the exporter table
    await queryRunner.query(`
      ALTER TABLE "exporter" 
      ADD COLUMN IF NOT EXISTS "exporterType" "public"."exporter_exporter_type_enum" DEFAULT 'trader'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the column
    await queryRunner.query(`
      ALTER TABLE "exporter" DROP COLUMN IF EXISTS "exporterType"
    `);

    // Drop the enum type
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."exporter_exporter_type_enum"
    `);
  }
}
