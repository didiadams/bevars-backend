import { Exporter } from 'src/exporter/entities/exporter.entity';
import { GlobalBuyer } from 'src/global-buyer/entities/global-buyer.entity';
import { Offer } from 'src/offer/entities/offer.entity';
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
import { OrderDocument } from './order-document.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PRODUCTION = 'in_production',
  READY_FOR_SHIPMENT = 'ready_for_shipment',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
}


export enum OrderType {
  DIRECT_PURCHASE = 'direct_purchase',
  NEGOTIATED_DEAL = 'negotiated_deal',
  CONTRACT_FARMING = 'contract_farming',
}

export enum PaymentStatus {
  PENDING = 'pending',
  AWAITING_DEPOSIT = 'awaiting_deposit',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  RELEASED = 'released',
  REFUNDED = 'refunded',
}

@Entity('order')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Offer)
  @JoinColumn()
  offer: Offer;

  @Column({ nullable: false })
  offerId: string;

  @ManyToOne(() => GlobalBuyer)
  @JoinColumn()
  globalBuyer: GlobalBuyer;

  @Column({ nullable: false })
  globalBuyerId: string;

  @ManyToOne(() => Exporter)
  @JoinColumn()
  exporter: Exporter;

  @Column({ nullable: false })
  exporterId: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  orderNumber: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'enum', enum: OrderType, default: OrderType.DIRECT_PURCHASE })
  type: OrderType;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: false })
  totalAmount: number;

  @Column({ nullable: false })
  currency: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: false })
  unitPrice: number;

  @Column({ type: 'date', nullable: true })
  expectedDeliveryDate: Date;

  @Column({ type: 'date', nullable: true })
  actualDeliveryDate: Date;

  @Column({ type: 'text', nullable: true })
  shippingAddress: string;

  @Column({ type: 'text', nullable: true })
  billingAddress: string;

  @Column({ type: 'text', nullable: true })
  specialInstructions: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'simple-array', nullable: true })
  attachments: string[];

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ type: 'date', nullable: true })
  confirmedAt: Date;

  @Column({ type: 'date', nullable: true })
  shippedAt: Date;

  @Column({ type: 'date', nullable: true })
  deliveredAt: Date;

  @Column({ type: 'date', nullable: true })
  completedAt: Date;

  @Column({ type: 'date', nullable: true })
  cancelledAt: Date;

  // Approval workflow: which status the order is awaiting buyer approval for
  @Column({ type: 'enum', enum: OrderStatus, nullable: true })
  awaitingApprovalFor: OrderStatus;

  // When the approval was requested (used for auto-complete after timeout)
  @Column({ type: 'timestamp', nullable: true })
  awaitingApprovalAt: Date;

  // Keep the previous status when order enters a dispute so it can be restored
  // if the dispute is withdrawn or resolved in favor of continuing the order.
  @Column({ type: 'enum', enum: OrderStatus, nullable: true })
  previousStatus: OrderStatus;

  // When the dispute should be escalated to Bevars mediation team if no
  // action is taken by buyer/exporter before this timestamp.
  @Column({ type: 'timestamp', nullable: true })
  disputeEscalationAt: Date;

  // Optional mediation assignment (user id of Bevars mediator)
  @Column({ type: 'varchar', length: 255, nullable: true })
  mediationAssignedTo: string;

  // The user id who opened the current dispute (if any)
  @Column({ type: 'varchar', length: 255, nullable: true })
  disputeOpenedBy: string;

  // When dispute was resolved, outcome note (e.g., 'buyer_accepted', 'exporter_accepted', 'cancelled', 'refund')
  @Column({ type: 'text', nullable: true })
  disputeResolutionOutcome: string;

  @Column({ type: 'timestamp', nullable: true })
  disputeResolvedAt: Date;

  // Payment tracking
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  paidAmount: number;

  // Reference to escrow account (if using escrow payment)
  @Column({ type: 'uuid', nullable: true })
  escrowAccountId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => OrderDocument, (d) => d.order)
  documents: OrderDocument[];
}
