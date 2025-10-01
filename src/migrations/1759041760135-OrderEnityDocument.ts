import { MigrationInterface, QueryRunner } from "typeorm";

export class OrderEnityDocument1759041760135 implements MigrationInterface {
    name = 'OrderEnityDocument1759041760135'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_unique_active_request_per_buyer"`);
        await queryRunner.query(`CREATE TYPE "public"."order_document_type_enum" AS ENUM('proforma_invoice', 'invoice', 'production_report', 'packing_list', 'certificate_of_origin', 'bill_of_lading', 'delivery_note', 'final_invoice', 'cancellation_notice', 'dispute_document')`);
        await queryRunner.query(`CREATE TABLE "order_document" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "type" "public"."order_document_type_enum" NOT NULL, "url" text NOT NULL, "uploadedByUserId" character varying, "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bbaf97b70f821e3ca4c8a87ed5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."order_review_role_enum" AS ENUM('exporter', 'global_buyer')`);
        await queryRunner.query(`CREATE TABLE "order_review" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "rating" integer NOT NULL, "comment" text, "role" "public"."order_review_role_enum" NOT NULL, "userId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_59c426f683eb876b8be2f033fd3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "order_document" ADD CONSTRAINT "FK_7423534d4f0ea2a3e3a568eb203" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_review" ADD CONSTRAINT "FK_d2b82986ad264b7f66d2cc649b6" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_review" DROP CONSTRAINT "FK_d2b82986ad264b7f66d2cc649b6"`);
        await queryRunner.query(`ALTER TABLE "order_document" DROP CONSTRAINT "FK_7423534d4f0ea2a3e3a568eb203"`);
        await queryRunner.query(`DROP TABLE "order_review"`);
        await queryRunner.query(`DROP TYPE "public"."order_review_role_enum"`);
        await queryRunner.query(`DROP TABLE "order_document"`);
        await queryRunner.query(`DROP TYPE "public"."order_document_type_enum"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_unique_active_request_per_buyer" ON "sourcing_request" ("globalBuyerId") WHERE (status = 'active'::sourcing_request_status_enum)`);
    }

}
