import { GlobalBuyer } from 'src/global-buyer/entities/global-buyer.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Offer } from 'src/offer/entities/offer.entity';

export enum RequestStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  DRAFT = 'draft',
  EXPIRED = 'expired',
}

export enum UrgencyLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum QualityStandards {
  ORGANIC = 'organic',
  FAIR_TRADE = 'fair_trade',
  NON_GMO = 'non_gmo',
  HALAL = 'halal',
  KOSHER = 'kosher',
  EU_STANDARD = 'eu_standard',
  US_STANDARD = 'us_standard',
  HACCP = 'haccp',
  ISO_22000 = 'iso_22000',
  BRC = 'brc',
  SQF = 'sqf',
}

export enum IncoTerms {
  EXW = 'exw', // Ex Works
  FCA = 'fca', // Free Carrier
  CPT = 'cpt', // Carriage Paid To
  CIP = 'cip', // Carriage and Insurance Paid To
  DAP = 'dap', // Delivered at Place
  DPU = 'dpu', // Delivered at Place Unloaded
  DDP = 'ddp', // Delivered Duty Paid
  FAS = 'fas', // Free Alongside Ship
  FOB = 'fob', // Free on Board
  CFR = 'cfr', // Cost and Freight
  CIF = 'cif', // Cost, Insurance and Freight
}

@Entity('sourcing_request')
export class SourcingRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GlobalBuyer, (globalBuyer) => globalBuyer.sourcingRequests)
  @JoinColumn()
  globalBuyer: GlobalBuyer;

  @Column({ nullable: false })
  globalBuyerId: string;

  @Column({ nullable: false })
  title: string;

  @Column({ type: 'text', nullable: false })
  description: string;

  @Column({ nullable: false })
  productName: string;

  @Column({ nullable: true })
  productCategory: string;

  @Column({ nullable: true })
  productVariety: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  quantity: number;

  @Column({ nullable: false })
  unit: string; // kg, tons, pieces, etc.

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  budgetMin: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  budgetMax: number;

  @Column({ nullable: true })
  currency: string;

  @Column({ nullable: false })
  deliveryCountry: string;

  @Column({ nullable: true })
  deliveryCity: string;

  @Column({ nullable: true })
  deliveryAddress: string;

  @Column({ nullable: true })
  deliveryPostalCode: string;

  @Column({ type: 'date', nullable: false })
  requiredDeliveryDate: Date;

  @Column({ type: 'date', nullable: true })
  latestDeliveryDate: Date;

  @Column({ type: 'date', nullable: false })
  quotationDeadline: Date;

  @Column({ type: 'enum', enum: IncoTerms, nullable: true })
  preferredIncoTerms: IncoTerms;

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Required quality standards and certifications',
  })
  qualityStandards: QualityStandards[];

  @Column({ type: 'text', nullable: true })
  qualitySpecifications: string;

  @Column({ type: 'text', nullable: true })
  packagingRequirements: string;

  @Column({ type: 'text', nullable: true })
  shippingInstructions: string;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.ACTIVE })
  status: RequestStatus;

  @Column({ type: 'enum', enum: UrgencyLevel, default: UrgencyLevel.MEDIUM })
  urgencyLevel: UrgencyLevel;

  @Column({ default: false })
  isPublic: boolean; // true = visible to all exporters, false = invite only

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Invited exporter IDs for private requests',
  })
  invitedExporters: string[];

  @Column({ type: 'date', nullable: true })
  expiresAt: Date;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  offerCount: number;

  @Column({ type: 'text', nullable: true })
  additionalNotes: string;

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Attachment URLs for product samples, specifications, etc.',
  })
  attachments: string[];

  // Relationships
  @OneToMany(() => Offer, (offer) => offer.sourcingRequest)
  offers: Offer[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
