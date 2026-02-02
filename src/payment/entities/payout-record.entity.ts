import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { Exporter } from '../../exporter/entities/exporter.entity';
import { EscrowTransaction } from './escrow-transaction.entity';

export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
  ON_HOLD = 'on_hold', // Manual review required
}

@Entity('payout_record')
export class PayoutRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order)
  @JoinColumn()
  order: Order;

  @Column({ nullable: false })
  orderId: string;

  @ManyToOne(() => Exporter)
  @JoinColumn()
  exporter: Exporter;

  @Column({ nullable: false })
  exporterId: string;

  // Link to the escrow transaction that triggered this payout
  @ManyToOne(() => EscrowTransaction, { nullable: true })
  @JoinColumn()
  escrowTransaction: EscrowTransaction;

  @Column({ nullable: true })
  escrowTransactionId: string;

  // Amount in source currency (USD)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: false })
  sourceAmount: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  sourceCurrency: string;

  // FX rate used
  @Column({ type: 'decimal', precision: 15, scale: 6, nullable: true })
  exchangeRate: number;

  // Amount in destination currency (NGN)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: false })
  destinationAmount: number;

  @Column({ type: 'varchar', length: 10, default: 'NGN' })
  destinationCurrency: string;

  // Platform fee deducted
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  platformFee: number;

  // Net amount after fees
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: false })
  netAmount: number;

  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  status: PayoutStatus;

  // Bank details snapshot at time of payout
  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  bankCode: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  accountNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  accountName: string;

  // Flutterwave transfer reference
  @Column({ type: 'varchar', length: 255, nullable: true })
  flutterwaveTransferId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  flutterwaveReference: string;

  // Retry tracking
  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastRetryAt: Date;

  // Error tracking
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  // Raw provider response
  @Column({ type: 'json', nullable: true })
  providerResponse: any;

  // Notes
  @Column({ type: 'text', nullable: true })
  notes: string;

  // Who initiated/processed
  @Column({ type: 'varchar', length: 255, nullable: true })
  processedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
