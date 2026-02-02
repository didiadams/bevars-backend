import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EscrowAccount } from './escrow-account.entity';
import { OrderMilestone } from './order-milestone.entity';

export enum TransactionType {
  DEPOSIT = 'deposit',
  RELEASE = 'release',
  REFUND = 'refund',
  PLATFORM_FEE = 'platform_fee',
  ADJUSTMENT = 'adjustment', // Manual admin adjustment
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

export enum TransactionTrigger {
  BUYER_DEPOSIT = 'buyer_deposit',
  MILESTONE_RELEASE = 'milestone_release',
  MANUAL_RELEASE = 'manual_release',
  DISPUTE_REFUND = 'dispute_refund',
  CANCELLATION_REFUND = 'cancellation_refund',
  ADMIN_ACTION = 'admin_action',
  AUTO_RELEASE = 'auto_release', // 48hr auto-approval
}

@Entity('escrow_transaction')
export class EscrowTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => EscrowAccount, (escrow) => escrow.transactions)
  @JoinColumn()
  escrowAccount: EscrowAccount;

  @Column({ nullable: false })
  escrowAccountId: string;

  @Column({ type: 'enum', enum: TransactionType, nullable: false })
  type: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Column({ type: 'enum', enum: TransactionTrigger, nullable: false })
  trigger: TransactionTrigger;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: false })
  amount: number;

  @Column({ nullable: false, default: 'USD' })
  currency: string;

  // For releases - which milestone triggered this
  @ManyToOne(() => OrderMilestone, { nullable: true })
  @JoinColumn()
  milestone: OrderMilestone;

  @Column({ nullable: true })
  milestoneId: string;

  // Flutterwave transaction reference
  @Column({ type: 'varchar', length: 255, nullable: true })
  flutterwaveRef: string;

  // Flutterwave transaction ID
  @Column({ type: 'varchar', length: 255, nullable: true })
  flutterwaveTransactionId: string;

  // For payouts - Flutterwave transfer ID
  @Column({ type: 'varchar', length: 255, nullable: true })
  flutterwaveTransferId: string;

  // FX rate used (for USD to NGN conversions)
  @Column({ type: 'decimal', precision: 15, scale: 6, nullable: true })
  exchangeRate: number;

  // Amount in destination currency (for payouts)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  destinationAmount: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  destinationCurrency: string;

  // Description/notes
  @Column({ type: 'text', nullable: true })
  description: string;

  // Who initiated this transaction
  @Column({ type: 'varchar', length: 255, nullable: true })
  initiatedBy: string;

  // Error message if failed
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  // Raw response from payment provider (for debugging)
  @Column({ type: 'json', nullable: true })
  providerResponse: any;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
