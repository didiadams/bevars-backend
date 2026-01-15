import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { GlobalBuyer } from '../../global-buyer/entities/global-buyer.entity';
import { Exporter } from '../../exporter/entities/exporter.entity';
import { EscrowTransaction } from './escrow-transaction.entity';

export enum EscrowStatus {
  AWAITING_DEPOSIT = 'awaiting_deposit',
  PARTIALLY_FUNDED = 'partially_funded',
  FUNDED = 'funded',
  PARTIALLY_RELEASED = 'partially_released',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  FROZEN = 'frozen', // During disputes
  CANCELLED = 'cancelled',
}

@Entity('escrow_account')
export class EscrowAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Order)
  @JoinColumn()
  order: Order;

  @Column({ nullable: false })
  orderId: string;

  @ManyToOne(() => GlobalBuyer)
  @JoinColumn()
  buyer: GlobalBuyer;

  @Column({ nullable: false })
  buyerId: string;

  @ManyToOne(() => Exporter)
  @JoinColumn()
  exporter: Exporter;

  @Column({ nullable: false })
  exporterId: string;

  // Total contract value to be held in escrow
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: false })
  totalAmount: number;

  // Amount currently funded by buyer
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  fundedAmount: number;

  // Amount released to exporter so far
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  releasedAmount: number;

  // Amount refunded to buyer (if any)
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  refundedAmount: number;

  // Platform fee to be deducted (percentage stored, calculated at release)
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2.0 })
  platformFeePercent: number;

  // Actual platform fee collected
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  platformFeeCollected: number;

  @Column({ nullable: false, default: 'USD' })
  currency: string;

  @Column({ type: 'enum', enum: EscrowStatus, default: EscrowStatus.AWAITING_DEPOSIT })
  status: EscrowStatus;

  // Flutterwave virtual account reference for buyer deposits
  @Column({ type: 'varchar', length: 255, nullable: true })
  virtualAccountRef: string;

  // Flutterwave virtual account number
  @Column({ type: 'varchar', length: 50, nullable: true })
  virtualAccountNumber: string;

  // Flutterwave virtual account bank name
  @Column({ type: 'varchar', length: 100, nullable: true })
  virtualAccountBank: string;

  // Flutterwave order reference for tracking
  @Column({ type: 'varchar', length: 255, nullable: true })
  flutterwaveOrderRef: string;

  // Previous status before freeze (for restoration after dispute resolution)
  @Column({ type: 'enum', enum: EscrowStatus, nullable: true })
  previousStatus: EscrowStatus;

  // Notes for admin actions
  @Column({ type: 'text', nullable: true })
  adminNotes: string;

  // Who froze or modified the escrow (admin user id)
  @Column({ type: 'varchar', length: 255, nullable: true })
  lastModifiedBy: string;

  @OneToMany(() => EscrowTransaction, (tx) => tx.escrowAccount)
  transactions: EscrowTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  fundedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date;
}
