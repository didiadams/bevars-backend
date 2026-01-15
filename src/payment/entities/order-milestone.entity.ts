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
import { EscrowAccount } from './escrow-account.entity';

export enum MilestoneType {
  DEPOSIT = 'deposit',           // Buyer funds escrow
  PRODUCTION = 'production',     // Production complete
  SHIPMENT = 'shipment',         // Bill of Lading issued - 70% release
  DELIVERY = 'delivery',         // Goods delivered - 30% release
}

export enum MilestoneStatus {
  PENDING = 'pending',
  AWAITING_PAYMENT = 'awaiting_payment',  // For deposit milestone
  PAYMENT_RECEIVED = 'payment_received',  // Deposit received
  AWAITING_VERIFICATION = 'awaiting_verification', // Document pending
  VERIFIED = 'verified',                  // Document approved
  RELEASED = 'released',                  // Funds released
  SKIPPED = 'skipped',                    // N/A for this order
  DISPUTED = 'disputed',                  // Under dispute
}

@Entity('order_milestone')
export class OrderMilestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order)
  @JoinColumn()
  order: Order;

  @Column({ nullable: false })
  orderId: string;

  @ManyToOne(() => EscrowAccount)
  @JoinColumn()
  escrowAccount: EscrowAccount;

  @Column({ nullable: true })
  escrowAccountId: string;

  @Column({ type: 'enum', enum: MilestoneType, nullable: false })
  type: MilestoneType;

  @Column({ type: 'enum', enum: MilestoneStatus, default: MilestoneStatus.PENDING })
  status: MilestoneStatus;

  // Sequence order for display
  @Column({ type: 'int', default: 0 })
  sequenceOrder: number;

  // What percentage of total escrow this milestone releases (0 for deposit, 70 for shipment, 30 for delivery)
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  releasePercentage: number;

  // Calculated release amount based on percentage
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  releaseAmount: number;

  // Due date for this milestone (optional)
  @Column({ type: 'timestamp', nullable: true })
  dueAt: Date;

  // When the milestone was completed/verified
  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  // When funds were released for this milestone
  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date;

  // Reference to verification document (if applicable)
  @Column({ type: 'varchar', length: 255, nullable: true })
  verificationDocumentId: string;

  // Who verified/approved this milestone
  @Column({ type: 'varchar', length: 255, nullable: true })
  verifiedBy: string;

  // Notes
  @Column({ type: 'text', nullable: true })
  notes: string;

  // Was this auto-approved (48hr rule)
  @Column({ type: 'boolean', default: false })
  autoApproved: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
