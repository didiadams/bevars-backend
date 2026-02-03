import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVerificationTier1780000000000 implements MigrationInterface {
    name = 'AddVerificationTier1780000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type for exporter verification tier if it doesn't exist
        const exporterEnumExists = await queryRunner.query(`
            SELECT 1 FROM pg_type WHERE typname = 'exporter_verificationtier_enum'
        `);
        if (exporterEnumExists.length === 0) {
            await queryRunner.query(`CREATE TYPE "public"."exporter_verificationtier_enum" AS ENUM('none', 'basic', 'full')`);
        }
        
        // Check if global_buyer enum exists and has correct values
        const buyerEnumExists = await queryRunner.query(`
            SELECT 1 FROM pg_type WHERE typname = 'global_buyer_verificationtier_enum'
        `);
        
        // Check if global_buyer table has verificationTier column
        const globalBuyerHasTier = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'global_buyer' AND column_name = 'verificationTier'
        `);
        
        if (buyerEnumExists.length > 0) {
            // Check if 'full' value exists in the enum
            const hasFullValue = await queryRunner.query(`
                SELECT 1 FROM pg_enum 
                WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'global_buyer_verificationtier_enum')
                AND enumlabel = 'full'
            `);
            
            if (hasFullValue.length === 0) {
                // Need to add new values to the enum
                // First drop the column if it exists
                if (globalBuyerHasTier.length > 0) {
                    await queryRunner.query(`ALTER TABLE "global_buyer" DROP COLUMN "verificationTier"`);
                }
                // Drop the old enum
                await queryRunner.query(`DROP TYPE "public"."global_buyer_verificationtier_enum"`);
                // Create new enum with correct values
                await queryRunner.query(`CREATE TYPE "public"."global_buyer_verificationtier_enum" AS ENUM('none', 'basic', 'full')`);
                // Add the column back
                await queryRunner.query(`ALTER TABLE "global_buyer" ADD "verificationTier" "public"."global_buyer_verificationtier_enum" NOT NULL DEFAULT 'none'`);
            } else if (globalBuyerHasTier.length === 0) {
                // Enum exists with correct values, just add the column
                await queryRunner.query(`ALTER TABLE "global_buyer" ADD "verificationTier" "public"."global_buyer_verificationtier_enum" NOT NULL DEFAULT 'none'`);
            }
        } else {
            // Create new enum
            await queryRunner.query(`CREATE TYPE "public"."global_buyer_verificationtier_enum" AS ENUM('none', 'basic', 'full')`);
            if (globalBuyerHasTier.length === 0) {
                await queryRunner.query(`ALTER TABLE "global_buyer" ADD "verificationTier" "public"."global_buyer_verificationtier_enum" NOT NULL DEFAULT 'none'`);
            }
        }
        
        // Add verificationTier column to exporter table if it doesn't exist
        const exporterHasTier = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'exporter' AND column_name = 'verificationTier'
        `);
        if (exporterHasTier.length === 0) {
            await queryRunner.query(`ALTER TABLE "exporter" ADD "verificationTier" "public"."exporter_verificationtier_enum" NOT NULL DEFAULT 'none'`);
        }
        
        // Update existing verified exporters to 'full' tier
        await queryRunner.query(`UPDATE "exporter" SET "verificationTier" = 'full' WHERE "isVerified" = true`);
        
        // Update existing verified global buyers to 'full' tier (based on status column)
        await queryRunner.query(`UPDATE "global_buyer" SET "verificationTier" = 'full' WHERE "status" = 'approved'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove verificationTier column from exporter
        await queryRunner.query(`ALTER TABLE "exporter" DROP COLUMN "verificationTier"`);
        
        // Remove verificationTier column from global_buyer
        await queryRunner.query(`ALTER TABLE "global_buyer" DROP COLUMN "verificationTier"`);
        
        // Drop enum types
        await queryRunner.query(`DROP TYPE "public"."exporter_verificationtier_enum"`);
        await queryRunner.query(`DROP TYPE "public"."global_buyer_verificationtier_enum"`);
    }
}
