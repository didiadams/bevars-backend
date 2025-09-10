import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1694268000000 implements MigrationInterface {
    name = 'InitialMigration1694268000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create User table
        await queryRunner.query(`
            CREATE TYPE "user_role_enum" AS ENUM('global_buyer', 'exporter', 'admin');
            CREATE TYPE "user_status_enum" AS ENUM('active', 'inactive', 'suspended');
        `);

        await queryRunner.query(`
            CREATE TABLE "user" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying NOT NULL,
                "password" character varying NOT NULL,
                "firstName" character varying,
                "lastName" character varying,
                "phoneNumber" character varying,
                "countryCode" character varying,
                "countryName" character varying,
                "role" "user_role_enum" NOT NULL,
                "companyName" character varying,
                "isVerified" boolean NOT NULL DEFAULT false,
                "isActive" boolean NOT NULL DEFAULT true,
                "status" "user_status_enum" NOT NULL DEFAULT 'active',
                "lastLoginAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_user_email" UNIQUE ("email"),
                CONSTRAINT "PK_user_id" PRIMARY KEY ("id")
            )
        `);

        // Create Global Buyer table
        await queryRunner.query(`
            CREATE TYPE "verification_tier_enum" AS ENUM('standard', 'premium', 'enterprise');
            CREATE TYPE "buyer_type_enum" AS ENUM('manufacturer', 'distributor', 'retailer', 'wholesaler', 'other');
            CREATE TYPE "preferred_payment_method_enum" AS ENUM('bank_transfer', 'letter_of_credit', 'escrow', 'trade_finance', 'other');
        `);

        await queryRunner.query(`
            CREATE TABLE "global_buyer" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "companyDescription" text,
                "verificationSubmittedAt" timestamp,
                "verificationCompletedAt" timestamp,
                "businessRegistrationNumber" character varying,
                "verificationTier" "verification_tier_enum" DEFAULT 'standard',
                "certificateUrl" character varying,
                "businessLicenseUrl" character varying,
                "taxIdUrl" character varying,
                "passportUrl" character varying,
                "photoUrl" character varying,
                "optionalDoc1Url" character varying,
                "optionalDoc2Url" character varying,
                "industryCertificationsUrl" character varying,
                "linkedinProfile" character varying,
                "interestedCategories" text,
                "operatingCountries" text,
                "buyerType" "buyer_type_enum",
                "preferredPaymentMethod" "preferred_payment_method_enum",
                "averageOrderValue" decimal(15,2) DEFAULT 0,
                "totalValueOrdered" decimal(15,2) DEFAULT 0,
                "numberOfOrders" integer DEFAULT 0,
                "isPremium" boolean DEFAULT false,
                "isActive" boolean DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_global_buyer_userId" UNIQUE ("userId"),
                CONSTRAINT "PK_global_buyer_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_global_buyer_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);

        // Create Exporter table
        await queryRunner.query(`
            CREATE TYPE "verification_status_enum" AS ENUM('pending', 'approved', 'rejected');
        `);

        await queryRunner.query(`
            CREATE TABLE "exporter" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "companyRegistrationNumber" character varying,
                "businessLicenseUrl" character varying,
                "exportLicenseUrl" character varying,
                "taxCertificateUrl" character varying,
                "qualityCertificatesUrl" character varying,
                "facilityPhotosUrl" character varying,
                "passportUrl" character varying,
                "photoUrl" character varying,
                "verificationStatus" "verification_status_enum" NOT NULL DEFAULT 'pending',
                "companyDescription" text,
                "operationalCapacity" integer,
                "yearsInBusiness" integer,
                "exportDestinations" text,
                "averageRating" decimal(5,2) DEFAULT 0,
                "completedOrders" integer DEFAULT 0,
                "isFeatured" boolean DEFAULT false,
                "isActive" boolean DEFAULT true,
                "verificationNotes" text,
                "verifiedAt" TIMESTAMP,
                "verifiedBy" character varying,
                "primaryCrops" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_exporter_userId" UNIQUE ("userId"),
                CONSTRAINT "PK_exporter_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_exporter_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);

        // Create indexes for better performance
        await queryRunner.query(`CREATE INDEX "IDX_user_email" ON "user" ("email")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_role" ON "user" ("role")`);
        await queryRunner.query(`CREATE INDEX "IDX_global_buyer_userId" ON "global_buyer" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_exporter_userId" ON "exporter" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_exporter_verificationStatus" ON "exporter" ("verificationStatus")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "IDX_exporter_verificationStatus"`);
        await queryRunner.query(`DROP INDEX "IDX_exporter_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_global_buyer_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_user_role"`);
        await queryRunner.query(`DROP INDEX "IDX_user_email"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "exporter"`);
        await queryRunner.query(`DROP TABLE "global_buyer"`);
        await queryRunner.query(`DROP TABLE "user"`);

        // Drop enums
        await queryRunner.query(`DROP TYPE "verification_status_enum"`);
        await queryRunner.query(`DROP TYPE "preferred_payment_method_enum"`);
        await queryRunner.query(`DROP TYPE "buyer_type_enum"`);
        await queryRunner.query(`DROP TYPE "verification_tier_enum"`);
        await queryRunner.query(`DROP TYPE "user_status_enum"`);
        await queryRunner.query(`DROP TYPE "user_role_enum"`);
    }
}
