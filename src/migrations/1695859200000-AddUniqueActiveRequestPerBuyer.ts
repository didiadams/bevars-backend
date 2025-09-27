import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueActiveRequestPerBuyer1695859200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_request_per_buyer
      ON sourcing_request ("globalBuyerId")
      WHERE status = 'active';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_unique_active_request_per_buyer;
    `);
  }
}
