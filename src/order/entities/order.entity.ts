import { Exporter } from 'src/exporter/entities/exporter.entity';
import { GlobalBuyer } from 'src/global-buyer/entities/global-buyer.entity';
import { Offer } from 'src/offer/entities/offer.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
