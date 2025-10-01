import { MigrationInterface, QueryRunner } from "typeorm";

export class ApprovalColumnOrder1759227105975 implements MigrationInterface {
    name = 'ApprovalColumnOrder1759227105975'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."order_awaitingapprovalfor_enum" AS ENUM('pending', 'confirmed', 'in_production', 'ready_for_shipment', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed')`);
        await queryRunner.query(`ALTER TABLE "order" ADD "awaitingApprovalFor" "public"."order_awaitingapprovalfor_enum"`);
        await queryRunner.query(`ALTER TABLE "order" ADD "awaitingApprovalAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "awaitingApprovalAt"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "awaitingApprovalFor"`);
        await queryRunner.query(`DROP TYPE "public"."order_awaitingapprovalfor_enum"`);
    }

}
