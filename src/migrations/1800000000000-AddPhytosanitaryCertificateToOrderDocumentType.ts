import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhytosanitaryCertificateToOrderDocumentType1800000000000 implements MigrationInterface {
  name = 'AddPhytosanitaryCertificateToOrderDocumentType1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add phytosanitary_certificate to the order_document_type_enum
    // This is required for agricultural product exports during the SHIPPED status
    await queryRunner.query(`
      ALTER TYPE "public"."order_document_type_enum" 
      ADD VALUE IF NOT EXISTS 'phytosanitary_certificate'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from an enum type directly.
    // To fully reverse this, you would need to:
    // 1. Create a new enum type without the value
    // 2. Update all columns using the old enum to use the new enum
    // 3. Drop the old enum and rename the new one
    // For safety, we log a warning instead of attempting this complex operation.
    console.warn(
      'Rolling back phytosanitary_certificate enum value is not supported. ' +
      'The value will remain in the enum but can be safely ignored if not used.'
    );
  }
}
