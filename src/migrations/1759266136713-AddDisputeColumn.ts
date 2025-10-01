import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDisputeColumn1759266136713 implements MigrationInterface {
    name = 'AddDisputeColumn1759266136713'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" ADD "disputeOpenedBy" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "disputeOpenedBy"`);
    }

}
