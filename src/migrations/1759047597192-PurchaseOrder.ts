import { MigrationInterface, QueryRunner } from "typeorm";

export class PurchaseOrder1759047597192 implements MigrationInterface {
    name = 'PurchaseOrder1759047597192'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."order_document_type_enum" RENAME TO "order_document_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."order_document_type_enum" AS ENUM('proforma_invoice', 'invoice', 'purchase_order', 'production_report', 'packing_list', 'certificate_of_origin', 'bill_of_lading', 'delivery_note', 'final_invoice', 'cancellation_notice', 'dispute_document')`);
        await queryRunner.query(`ALTER TABLE "order_document" ALTER COLUMN "type" TYPE "public"."order_document_type_enum" USING "type"::"text"::"public"."order_document_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."order_document_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."order_document_type_enum_old" AS ENUM('proforma_invoice', 'invoice', 'production_report', 'packing_list', 'certificate_of_origin', 'bill_of_lading', 'delivery_note', 'final_invoice', 'cancellation_notice', 'dispute_document')`);
        await queryRunner.query(`ALTER TABLE "order_document" ALTER COLUMN "type" TYPE "public"."order_document_type_enum_old" USING "type"::"text"::"public"."order_document_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."order_document_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."order_document_type_enum_old" RENAME TO "order_document_type_enum"`);
    }

}
