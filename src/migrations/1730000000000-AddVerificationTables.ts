import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVerificationTables1730000000000 implements MigrationInterface {
  name = 'AddVerificationTables1730000000000';
public transaction = false;
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "verification_document" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "exporterId" uuid,
        "buyerId" uuid,
        "ownerId" varchar,
        "documentType" varchar NOT NULL,
        "fileUrl" varchar NOT NULL,
        "fileName" varchar,
        "mimeType" varchar,
        "fileSize" bigint,
        "status" varchar DEFAULT 'pending',
        "uploadedBy" varchar,
        "reviewedBy" varchar,
        "reviewNotes" text,
        "metadata" json,
        "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verification_document_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "verification_requirement" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerType" varchar NOT NULL,
        "documentType" varchar NOT NULL,
        "label" varchar NOT NULL,
        "required" boolean DEFAULT true,
        "displayOrder" integer DEFAULT 0,
        "allowedMimeTypes" text,
        "maxFileSizeBytes" bigint,
        "tiers" json,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verification_requirement_id" PRIMARY KEY ("id")
      );
    `);

    // Foreign keys
    await queryRunner.query(`ALTER TABLE "verification_document" ADD CONSTRAINT "FK_ver_doc_exporter" FOREIGN KEY ("exporterId") REFERENCES "exporter"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "verification_document" ADD CONSTRAINT "FK_ver_doc_buyer" FOREIGN KEY ("buyerId") REFERENCES "global_buyer"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "verification_document" DROP CONSTRAINT IF EXISTS "FK_ver_doc_buyer"`);
    await queryRunner.query(`ALTER TABLE "verification_document" DROP CONSTRAINT IF EXISTS "FK_ver_doc_exporter"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "verification_requirement"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "verification_document"`);
  }
}
