import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOtpTable1700000000001 implements MigrationInterface {
    name = 'CreateOtpTable1700000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."otp_type_enum" AS ENUM('email_verification', 'password_reset', 'account_activation')`);
        await queryRunner.query(`CREATE TYPE "public"."otp_status_enum" AS ENUM('active', 'used', 'expired', 'revoked')`);
        await queryRunner.query(`CREATE TABLE "otp" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "type" "public"."otp_type_enum" NOT NULL, "status" "public"."otp_status_enum" NOT NULL DEFAULT 'active', "userId" uuid NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "ipAddress" character varying, "userAgent" character varying, "attempts" integer NOT NULL DEFAULT '0', "maxAttempts" integer NOT NULL DEFAULT '3', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_32556d9d7b22031d7d0e1fd6723" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "otp" ADD CONSTRAINT "FK_db724db1bc3d94ad5ba38518433" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "otp" DROP CONSTRAINT "FK_db724db1bc3d94ad5ba38518433"`);
        await queryRunner.query(`DROP TABLE "otp"`);
        await queryRunner.query(`DROP TYPE "public"."otp_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."otp_type_enum"`);
    }

}
