import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDocumentCollection1759291446523 implements MigrationInterface {
    name = 'AddDocumentCollection1759291446523'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_document" DROP CONSTRAINT "uq_order_document_order_type"`);
        await queryRunner.query(`ALTER TYPE "public"."offer_paymentterms_enum" RENAME TO "offer_paymentterms_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."offer_paymentterms_enum" AS ENUM('advance_payment', 'payment_on_delivery', 'letter_of_credit', 'telegraphic_transfer', 'open_account', 'escrow', 'net_30', 'net_60', 'net_90', 'documentary_collection')`);
        await queryRunner.query(`ALTER TABLE "offer" ALTER COLUMN "paymentTerms" TYPE "public"."offer_paymentterms_enum" USING "paymentTerms"::"text"::"public"."offer_paymentterms_enum"`);
        await queryRunner.query(`DROP TYPE "public"."offer_paymentterms_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."offer_paymentterms_enum_old" AS ENUM('advance_payment', 'payment_on_delivery', 'letter_of_credit', 'telegraphic_transfer', 'escrow', 'net_30', 'net_60', 'net_90', 'open_account')`);
        await queryRunner.query(`ALTER TABLE "offer" ALTER COLUMN "paymentTerms" TYPE "public"."offer_paymentterms_enum_old" USING "paymentTerms"::"text"::"public"."offer_paymentterms_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."offer_paymentterms_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."offer_paymentterms_enum_old" RENAME TO "offer_paymentterms_enum"`);
        await queryRunner.query(`ALTER TABLE "order_document" ADD CONSTRAINT "uq_order_document_order_type" UNIQUE ("orderId", "type")`);
    }

}
