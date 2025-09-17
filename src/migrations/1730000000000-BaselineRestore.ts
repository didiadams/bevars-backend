import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineRestore1730000000000 implements MigrationInterface {
  name = 'BaselineRestore1730000000000';

  // no DB changes in this baseline migration — used to align repo with DB
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // intentionally left blank
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // intentionally left blank
  }
}
