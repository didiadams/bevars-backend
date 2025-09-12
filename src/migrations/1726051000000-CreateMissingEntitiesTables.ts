import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMissingEntitiesTables1726051000000 implements MigrationInterface {
    name = 'CreateMissingEntitiesTables1726051000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enums for sourcing request (if they don't exist)
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "request_status_enum" AS ENUM('active', 'closed', 'draft', 'expired');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE "urgency_level_enum" AS ENUM('low', 'medium', 'high', 'urgent');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE "quality_standards_enum" AS ENUM('organic', 'fair_trade', 'non_gmo', 'halal', 'kosher', 'eu_standard', 'us_standard', 'haccp', 'iso_22000');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create sourcing_request table
        await queryRunner.query(`
            CREATE TABLE "sourcing_request" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "globalBuyerId" uuid NOT NULL,
                "title" character varying NOT NULL,
                "description" text NOT NULL,
                "productName" character varying NOT NULL,
                "productCategory" character varying,
                "productVariety" character varying,
                "quantity" decimal(10,2) NOT NULL,
                "unit" character varying NOT NULL,
                "budgetMin" decimal(15,2),
                "budgetMax" decimal(15,2),
                "currency" character varying DEFAULT 'USD',
                "deliveryCountry" character varying NOT NULL,
                "deliveryCity" character varying,
                "deliveryAddress" text,
                "requiredDeliveryDate" date NOT NULL,
                "quotationDeadline" timestamp NOT NULL,
                "qualityStandards" text,
                "qualitySpecifications" text,
                "packagingRequirements" text,
                "shippingInstructions" text,
                "status" "request_status_enum" DEFAULT 'active',
                "urgencyLevel" "urgency_level_enum" DEFAULT 'medium',
                "isPublic" boolean DEFAULT false,
                "invitedExporters" text,
                "expiresAt" date,
                "viewCount" integer DEFAULT 0,
                "additionalNotes" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_sourcing_request_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_sourcing_request_globalBuyerId" FOREIGN KEY ("globalBuyerId") REFERENCES "global_buyer"("id") ON DELETE CASCADE
            )
        `);

        // Create enums for offer (if they don't exist)
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "offer_status_enum" AS ENUM('pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'under_negotiation');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE "payment_terms_enum" AS ENUM('advance_payment', 'payment_on_delivery', 'letter_of_credit', 'telegraphic_transfer', 'escrow', 'net_30', 'net_60', 'net_90');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create offer table
        await queryRunner.query(`
            CREATE TABLE "offer" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "sourcingRequestId" uuid NOT NULL,
                "exporterId" uuid NOT NULL,
                "pricePerUnit" decimal(15,2) NOT NULL,
                "totalPrice" decimal(15,2) NOT NULL,
                "currency" character varying DEFAULT 'USD',
                "availableQuantity" decimal(10,2) NOT NULL,
                "leadTime" integer,
                "validUntil" timestamp,
                "productSpecifications" text,
                "qualityAssurance" text,
                "packagingDetails" text,
                "shippingDetails" text,
                "paymentTerms" "payment_terms_enum" DEFAULT 'advance_payment',
                "status" "offer_status_enum" DEFAULT 'pending',
                "additionalNotes" text,
                "attachments" text,
                "isCounterOffer" boolean DEFAULT false,
                "parentOfferId" uuid,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_offer_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_offer_sourcingRequestId" FOREIGN KEY ("sourcingRequestId") REFERENCES "sourcing_request"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_offer_exporterId" FOREIGN KEY ("exporterId") REFERENCES "exporter"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_offer_parentOfferId" FOREIGN KEY ("parentOfferId") REFERENCES "offer"("id") ON DELETE SET NULL
            )
        `);

        // Create enums for order (if they don't exist)
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "order_status_enum" AS ENUM('pending', 'confirmed', 'in_production', 'ready_for_shipment', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE "order_type_enum" AS ENUM('direct_purchase', 'negotiated_deal', 'contract_farming');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create order table
        await queryRunner.query(`
            CREATE TABLE "order" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "orderNumber" character varying NOT NULL,
                "offerId" uuid NOT NULL,
                "globalBuyerId" uuid NOT NULL,
                "exporterId" uuid NOT NULL,
                "status" "order_status_enum" DEFAULT 'pending',
                "type" "order_type_enum" DEFAULT 'direct_purchase',
                "totalAmount" decimal(15,2) NOT NULL,
                "currency" character varying DEFAULT 'USD',
                "quantity" decimal(10,2) NOT NULL,
                "unit" character varying NOT NULL,
                "shippingAddress" text,
                "billingAddress" text,
                "expectedDeliveryDate" date,
                "actualDeliveryDate" date,
                "trackingNumber" character varying,
                "shippingMethod" character varying,
                "paymentMethod" character varying,
                "paymentStatus" character varying DEFAULT 'pending',
                "specialInstructions" text,
                "qualityInspectionRequired" boolean DEFAULT false,
                "qualityInspectionDate" date,
                "qualityInspectionResults" text,
                "rating" integer,
                "review" text,
                "disputeReason" text,
                "disputeResolution" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_order_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_order_orderNumber" UNIQUE ("orderNumber"),
                CONSTRAINT "FK_order_offerId" FOREIGN KEY ("offerId") REFERENCES "offer"("id") ON DELETE RESTRICT,
                CONSTRAINT "FK_order_globalBuyerId" FOREIGN KEY ("globalBuyerId") REFERENCES "global_buyer"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_order_exporterId" FOREIGN KEY ("exporterId") REFERENCES "exporter"("id") ON DELETE CASCADE
            )
        `);

        // Create enum for chat (if it doesn't exist)
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "chat_status_enum" AS ENUM('active', 'archived', 'closed');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create chat table
        await queryRunner.query(`
            CREATE TABLE "chat" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "orderId" uuid NOT NULL,
                "globalBuyerId" uuid NOT NULL,
                "exporterId" uuid NOT NULL,
                "title" character varying,
                "status" "chat_status_enum" DEFAULT 'active',
                "lastMessageAt" TIMESTAMP,
                "isReadByBuyer" boolean DEFAULT true,
                "isReadByExporter" boolean DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_chat_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_chat_orderId" UNIQUE ("orderId"),
                CONSTRAINT "FK_chat_orderId" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_chat_globalBuyerId" FOREIGN KEY ("globalBuyerId") REFERENCES "global_buyer"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_chat_exporterId" FOREIGN KEY ("exporterId") REFERENCES "exporter"("id") ON DELETE CASCADE
            )
        `);

        // Create chat_message table
        await queryRunner.query(`
            CREATE TABLE "chat_message" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "chatId" uuid NOT NULL,
                "senderId" uuid NOT NULL,
                "message" text NOT NULL,
                "attachments" text,
                "isRead" boolean DEFAULT false,
                "isSystemMessage" boolean DEFAULT false,
                "replyToMessageId" uuid,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_chat_message_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_chat_message_chatId" FOREIGN KEY ("chatId") REFERENCES "chat"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_chat_message_senderId" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_chat_message_replyToMessageId" FOREIGN KEY ("replyToMessageId") REFERENCES "chat_message"("id") ON DELETE SET NULL
            )
        `);

        // Create enum for email logs (if it doesn't exist)
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "email_status_enum" AS ENUM('queued', 'sent', 'failed');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create email_logs table
        await queryRunner.query(`
            CREATE TABLE "email_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying NOT NULL,
                "subject" character varying NOT NULL,
                "status" "email_status_enum" DEFAULT 'queued',
                "jobId" character varying,
                "messageId" character varying,
                "metadata" jsonb,
                "error" text,
                "sentAt" TIMESTAMP,
                "lastAttempt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_email_logs_id" PRIMARY KEY ("id")
            )
        `);

        // Create buyer_verification_document table
        await queryRunner.query(`
            CREATE TABLE "buyer_verification_document" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "globalBuyerId" uuid NOT NULL,
                "documentType" character varying NOT NULL,
                "fileUrl" character varying NOT NULL,
                "status" character varying DEFAULT 'uploaded',
                "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_buyer_verification_document_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_buyer_verification_document_globalBuyerId" FOREIGN KEY ("globalBuyerId") REFERENCES "global_buyer"("id") ON DELETE CASCADE
            )
        `);

        // Create performance indexes
        await queryRunner.query(`CREATE INDEX "IDX_sourcing_request_globalBuyerId" ON "sourcing_request" ("globalBuyerId")`);
        await queryRunner.query(`CREATE INDEX "IDX_sourcing_request_status" ON "sourcing_request" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_sourcing_request_quotationDeadline" ON "sourcing_request" ("quotationDeadline")`);
        await queryRunner.query(`CREATE INDEX "IDX_sourcing_request_isPublic" ON "sourcing_request" ("isPublic")`);
        
        await queryRunner.query(`CREATE INDEX "IDX_offer_sourcingRequestId" ON "offer" ("sourcingRequestId")`);
        await queryRunner.query(`CREATE INDEX "IDX_offer_exporterId" ON "offer" ("exporterId")`);
        await queryRunner.query(`CREATE INDEX "IDX_offer_status" ON "offer" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_offer_validUntil" ON "offer" ("validUntil")`);
        
        await queryRunner.query(`CREATE INDEX "IDX_order_globalBuyerId" ON "order" ("globalBuyerId")`);
        await queryRunner.query(`CREATE INDEX "IDX_order_exporterId" ON "order" ("exporterId")`);
        await queryRunner.query(`CREATE INDEX "IDX_order_status" ON "order" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_order_orderNumber" ON "order" ("orderNumber")`);
        
        await queryRunner.query(`CREATE INDEX "IDX_chat_orderId" ON "chat" ("orderId")`);
        await queryRunner.query(`CREATE INDEX "IDX_chat_globalBuyerId" ON "chat" ("globalBuyerId")`);
        await queryRunner.query(`CREATE INDEX "IDX_chat_exporterId" ON "chat" ("exporterId")`);
        
        await queryRunner.query(`CREATE INDEX "IDX_chat_message_chatId" ON "chat_message" ("chatId")`);
        await queryRunner.query(`CREATE INDEX "IDX_chat_message_senderId" ON "chat_message" ("senderId")`);
        await queryRunner.query(`CREATE INDEX "IDX_chat_message_isRead" ON "chat_message" ("isRead")`);
        
        await queryRunner.query(`CREATE INDEX "IDX_email_logs_status" ON "email_logs" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_email_logs_email" ON "email_logs" ("email")`);
        
        await queryRunner.query(`CREATE INDEX "IDX_buyer_verification_document_globalBuyerId" ON "buyer_verification_document" ("globalBuyerId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "IDX_buyer_verification_document_globalBuyerId"`);
        await queryRunner.query(`DROP INDEX "IDX_email_logs_email"`);
        await queryRunner.query(`DROP INDEX "IDX_email_logs_status"`);
        await queryRunner.query(`DROP INDEX "IDX_chat_message_isRead"`);
        await queryRunner.query(`DROP INDEX "IDX_chat_message_senderId"`);
        await queryRunner.query(`DROP INDEX "IDX_chat_message_chatId"`);
        await queryRunner.query(`DROP INDEX "IDX_chat_exporterId"`);
        await queryRunner.query(`DROP INDEX "IDX_chat_globalBuyerId"`);
        await queryRunner.query(`DROP INDEX "IDX_chat_orderId"`);
        await queryRunner.query(`DROP INDEX "IDX_order_orderNumber"`);
        await queryRunner.query(`DROP INDEX "IDX_order_status"`);
        await queryRunner.query(`DROP INDEX "IDX_order_exporterId"`);
        await queryRunner.query(`DROP INDEX "IDX_order_globalBuyerId"`);
        await queryRunner.query(`DROP INDEX "IDX_offer_validUntil"`);
        await queryRunner.query(`DROP INDEX "IDX_offer_status"`);
        await queryRunner.query(`DROP INDEX "IDX_offer_exporterId"`);
        await queryRunner.query(`DROP INDEX "IDX_offer_sourcingRequestId"`);
        await queryRunner.query(`DROP INDEX "IDX_sourcing_request_isPublic"`);
        await queryRunner.query(`DROP INDEX "IDX_sourcing_request_quotationDeadline"`);
        await queryRunner.query(`DROP INDEX "IDX_sourcing_request_status"`);
        await queryRunner.query(`DROP INDEX "IDX_sourcing_request_globalBuyerId"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "buyer_verification_document"`);
        await queryRunner.query(`DROP TABLE "email_logs"`);
        await queryRunner.query(`DROP TABLE "chat_message"`);
        await queryRunner.query(`DROP TABLE "chat"`);
        await queryRunner.query(`DROP TABLE "order"`);
        await queryRunner.query(`DROP TABLE "offer"`);
        await queryRunner.query(`DROP TABLE "sourcing_request"`);

        // Drop enums
        await queryRunner.query(`DROP TYPE "email_status_enum"`);
        await queryRunner.query(`DROP TYPE "chat_status_enum"`);
        await queryRunner.query(`DROP TYPE "order_type_enum"`);
        await queryRunner.query(`DROP TYPE "order_status_enum"`);
        await queryRunner.query(`DROP TYPE "payment_terms_enum"`);
        await queryRunner.query(`DROP TYPE "offer_status_enum"`);
        await queryRunner.query(`DROP TYPE "quality_standards_enum"`);
        await queryRunner.query(`DROP TYPE "urgency_level_enum"`);
        await queryRunner.query(`DROP TYPE "request_status_enum"`);
    }
}
