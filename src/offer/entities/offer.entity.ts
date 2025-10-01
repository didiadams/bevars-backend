import { Exporter } from 'src/exporter/entities/exporter.entity';
import { SourcingRequest } from 'src/sourcing-request/entities/sourcing-request.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OfferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  EXPIRED = 'expired',
  UNDER_NEGOTIATION = 'under_negotiation',
}

export enum PaymentTerms {
  ADVANCE_PAYMENT = 'advance_payment',
  PAYMENT_ON_DELIVERY = 'payment_on_delivery',
  LETTER_OF_CREDIT = 'letter_of_credit',
  TELEGRAPHIC_TRANSFER = 'telegraphic_transfer',
  OPEN_ACCOUNT = 'open_account',
  ESCROW = 'escrow',
  NET_30 = 'net_30',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
}

@Entity('offer')
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SourcingRequest, (request) => request.offers)
  @JoinColumn()
  sourcingRequest: SourcingRequest;

  @Column({ nullable: false })
  sourcingRequestId: string;

  @ManyToOne(() => Exporter, (exporter) => exporter.offers)
  @JoinColumn()
  exporter: Exporter;

  @Column({ nullable: false })
  exporterId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: false })
  pricePerUnit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: false })
  totalPrice: number;

  @Column({ nullable: false })
  currency: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  availableQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minimumOrderQuantity: number;

  @Column({ nullable: true })
  leadTime: number; // in days

  @Column({ type: 'date', nullable: true })
  estimatedDeliveryDate: Date;

  @Column({ type: 'enum', enum: PaymentTerms, nullable: false })
  paymentTerms: PaymentTerms;

  @Column({ type: 'text', nullable: true })
  qualityAssurance: string;

  @Column({ type: 'text', nullable: true })
  productSpecifications: string;

  @Column({ type: 'text', nullable: true })
  packagingDetails: string;

  @Column({ type: 'text', nullable: true })
  shippingDetails: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  shippingCost: number;

  @Column({ type: 'text', nullable: true })
  insuranceDetails: string;

  @Column({ type: 'text', nullable: true })
  certifications: string;

  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.PENDING })
  status: OfferStatus;

  @Column({ type: 'date', nullable: true })
  validUntil: Date;

  @Column({ type: 'text', nullable: true })
  additionalNotes: string;

  @Column({ type: 'text', nullable: true })
  termsAndConditions: string;

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Attachment URLs for product samples, certifications, etc.',
  })
  attachments: string[];

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ nullable: true })
  negotiationNotes: string;

  @Column({ default: false })
  isCounterOffer: boolean;

  @Column({ nullable: true })
  originalOfferId: string; // If this is a counter-offer

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
