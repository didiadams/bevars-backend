import { MigrationInterface, QueryRunner } from "typeorm";

export class DisputeTable1759258363213 implements MigrationInterface {
    name = 'DisputeTable1759258363213'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."order_previousstatus_enum" AS ENUM('pending', 'confirmed', 'in_production', 'ready_for_shipment', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed')`);
        await queryRunner.query(`ALTER TABLE "order" ADD "previousStatus" "public"."order_previousstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "order" ADD "disputeEscalationAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "order" ADD "mediationAssignedTo" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "order" ADD "disputeResolutionOutcome" text`);
        await queryRunner.query(`ALTER TABLE "order" ADD "disputeResolvedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "disputeResolvedAt"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "disputeResolutionOutcome"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "mediationAssignedTo"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "disputeEscalationAt"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "previousStatus"`);
        await queryRunner.query(`DROP TYPE "public"."order_previousstatus_enum"`);
    }

}
