import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddPaymentEscrowTables1760000000000 implements MigrationInterface {
  name = 'AddPaymentEscrowTables1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create escrow_account table
    await queryRunner.createTable(
      new Table({
        name: 'escrow_account',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'orderId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'buyerId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'exporterId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'totalAmount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'fundedAmount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'releasedAmount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'refundedAmount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'platformFeePercent',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 2.0,
          },
          {
            name: 'platformFeeCollected',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '10',
            default: "'USD'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['awaiting_deposit', 'partially_funded', 'funded', 'partially_released', 'released', 'refunded', 'frozen', 'cancelled'],
            default: "'awaiting_deposit'",
          },
          {
            name: 'virtualAccountRef',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'virtualAccountNumber',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'virtualAccountBank',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'flutterwaveOrderRef',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'previousStatus',
            type: 'enum',
            enum: ['awaiting_deposit', 'partially_funded', 'funded', 'partially_released', 'released', 'refunded', 'frozen', 'cancelled'],
            isNullable: true,
          },
          {
            name: 'adminNotes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'lastModifiedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'fundedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'releasedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'refundedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create escrow_transaction table
    await queryRunner.createTable(
      new Table({
        name: 'escrow_transaction',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'escrowAccountId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['deposit', 'release', 'refund', 'platform_fee', 'adjustment'],
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'failed', 'reversed'],
            default: "'pending'",
          },
          {
            name: 'trigger',
            type: 'enum',
            enum: ['buyer_deposit', 'milestone_release', 'manual_release', 'dispute_refund', 'cancellation_refund', 'admin_action', 'auto_release'],
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '10',
            default: "'USD'",
          },
          {
            name: 'milestoneId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'flutterwaveRef',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'flutterwaveTransactionId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'flutterwaveTransferId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'exchangeRate',
            type: 'decimal',
            precision: 15,
            scale: 6,
            isNullable: true,
          },
          {
            name: 'destinationAmount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'destinationCurrency',
            type: 'varchar',
            length: '10',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'initiatedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'providerResponse',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create order_milestone table
    await queryRunner.createTable(
      new Table({
        name: 'order_milestone',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'orderId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'escrowAccountId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['deposit', 'production', 'shipment', 'delivery'],
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'awaiting_payment', 'payment_received', 'awaiting_verification', 'verified', 'released', 'skipped', 'disputed'],
            default: "'pending'",
          },
          {
            name: 'sequenceOrder',
            type: 'int',
            default: 0,
          },
          {
            name: 'releasePercentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'releaseAmount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'dueAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'releasedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'verificationDocumentId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'verifiedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'autoApproved',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create payout_record table
    await queryRunner.createTable(
      new Table({
        name: 'payout_record',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'orderId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'exporterId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'escrowTransactionId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'sourceAmount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'sourceCurrency',
            type: 'varchar',
            length: '10',
            default: "'USD'",
          },
          {
            name: 'exchangeRate',
            type: 'decimal',
            precision: 15,
            scale: 6,
            isNullable: true,
          },
          {
            name: 'destinationAmount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'destinationCurrency',
            type: 'varchar',
            length: '10',
            default: "'NGN'",
          },
          {
            name: 'platformFee',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'netAmount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'failed', 'reversed', 'on_hold'],
            default: "'pending'",
          },
          {
            name: 'bankName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'bankCode',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'accountNumber',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'accountName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'flutterwaveTransferId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'flutterwaveReference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'retryCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'lastRetryAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'providerResponse',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'processedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'escrow_account',
      new TableForeignKey({
        columnNames: ['orderId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'order',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'escrow_account',
      new TableForeignKey({
        columnNames: ['buyerId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'global_buyer',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'escrow_account',
      new TableForeignKey({
        columnNames: ['exporterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'exporter',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'escrow_transaction',
      new TableForeignKey({
        columnNames: ['escrowAccountId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'escrow_account',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'order_milestone',
      new TableForeignKey({
        columnNames: ['orderId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'order',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'order_milestone',
      new TableForeignKey({
        columnNames: ['escrowAccountId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'escrow_account',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'payout_record',
      new TableForeignKey({
        columnNames: ['orderId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'order',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'payout_record',
      new TableForeignKey({
        columnNames: ['exporterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'exporter',
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex('escrow_account', new TableIndex({ columnNames: ['orderId'] }));
    await queryRunner.createIndex('escrow_account', new TableIndex({ columnNames: ['buyerId'] }));
    await queryRunner.createIndex('escrow_account', new TableIndex({ columnNames: ['exporterId'] }));
    await queryRunner.createIndex('escrow_account', new TableIndex({ columnNames: ['status'] }));
    await queryRunner.createIndex('escrow_account', new TableIndex({ columnNames: ['flutterwaveOrderRef'] }));

    await queryRunner.createIndex('escrow_transaction', new TableIndex({ columnNames: ['escrowAccountId'] }));
    await queryRunner.createIndex('escrow_transaction', new TableIndex({ columnNames: ['type'] }));
    await queryRunner.createIndex('escrow_transaction', new TableIndex({ columnNames: ['status'] }));

    await queryRunner.createIndex('order_milestone', new TableIndex({ columnNames: ['orderId'] }));
    await queryRunner.createIndex('order_milestone', new TableIndex({ columnNames: ['escrowAccountId'] }));
    await queryRunner.createIndex('order_milestone', new TableIndex({ columnNames: ['type'] }));
    await queryRunner.createIndex('order_milestone', new TableIndex({ columnNames: ['status'] }));

    await queryRunner.createIndex('payout_record', new TableIndex({ columnNames: ['orderId'] }));
    await queryRunner.createIndex('payout_record', new TableIndex({ columnNames: ['exporterId'] }));
    await queryRunner.createIndex('payout_record', new TableIndex({ columnNames: ['status'] }));

    // Add payment-related columns to order table
    await queryRunner.query(`
      ALTER TABLE "order" 
      ADD COLUMN IF NOT EXISTS "paymentStatus" varchar(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS "paidAmount" decimal(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "escrowAccountId" uuid
    `);

    // Add bank details to exporter table
    await queryRunner.query(`
      ALTER TABLE "exporter"
      ADD COLUMN IF NOT EXISTS "bankName" varchar(100),
      ADD COLUMN IF NOT EXISTS "bankCode" varchar(20),
      ADD COLUMN IF NOT EXISTS "accountNumber" varchar(50),
      ADD COLUMN IF NOT EXISTS "accountName" varchar(255),
      ADD COLUMN IF NOT EXISTS "bankVerified" boolean DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns from exporter
    await queryRunner.query(`
      ALTER TABLE "exporter"
      DROP COLUMN IF EXISTS "bankName",
      DROP COLUMN IF EXISTS "bankCode",
      DROP COLUMN IF EXISTS "accountNumber",
      DROP COLUMN IF EXISTS "accountName",
      DROP COLUMN IF EXISTS "bankVerified"
    `);

    // Remove columns from order
    await queryRunner.query(`
      ALTER TABLE "order"
      DROP COLUMN IF EXISTS "paymentStatus",
      DROP COLUMN IF EXISTS "paidAmount",
      DROP COLUMN IF EXISTS "escrowAccountId"
    `);

    // Drop tables in reverse order
    await queryRunner.dropTable('payout_record', true);
    await queryRunner.dropTable('order_milestone', true);
    await queryRunner.dropTable('escrow_transaction', true);
    await queryRunner.dropTable('escrow_account', true);
  }
}
