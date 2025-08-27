import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SourcingRequest } from 'src/sourcing-request/entities/sourcing-request.entity';
import { BuyerVerificationDocument } from './buyer-verification-document.entity';

export enum BuyerType {
  RETAILER = 'retailer',
  WHOLESALER = 'wholesaler',
  DISTRIBUTOR = 'distributor',
  PROCESSOR = 'processor',
  RESTAURANT_CHAIN = 'restaurant_chain',
  SUPERMARKET_CHAIN = 'supermarket_chain',
  TRADING_COMPANY = 'trading_company',
  GOVERNMENT_ENTITY = 'government_entity',
  NON_PROFIT = 'non_profit',
  INDIVIDUAL = 'individual',
}

export enum PreferredPaymentMethod {
  LETTER_OF_CREDIT = 'letter_of_credit',
  TELEGRAPHIC_TRANSFER = 'telegraphic_transfer',
  ESCROW = 'escrow',
  CASH_ON_DELIVERY = 'cash_on_delivery',
  ADVANCE_PAYMENT = 'advance_payment',
  DOCUMENTARY_COLLECTION = 'documentary_collection',
}

@Entity('global_buyer')
export class GlobalBuyer {
  // Verification document URLs (one column per type)
  @Column({ nullable: true })
  passportUrl: string;

  @Column({ nullable: true })
  certificateUrl: string;

    // New column for industry certifications
    @Column({ nullable: true })
    industryCertificationsUrl: string;

  @Column({ nullable: true })
  taxIdUrl: string;

  @Column({ nullable: true })
  businessLicenseUrl: string;

  @Column({ nullable: true })
  photoUrl: string;

  // Optional documents
  @Column({ nullable: true })
  optionalDoc1Url: string;

  @Column({ nullable: true })
  optionalDoc2Url: string;
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.globalBuyer, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ nullable: true })
  userId: string;

  @Column({ type: 'enum', enum: BuyerType, nullable: true })
  buyerType: BuyerType;

  @Column({ nullable: true })
  businessRegistrationNumber: string;

  @Column({ nullable: true })
  taxIdentificationNumber: string;

  @Column({ nullable: true })
  importLicenseNumber: string;

  @Column({ nullable: true })
  businessDescription: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  linkedinProfile: string;

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Product categories this buyer is interested in',
  })
  interestedCategories: string[];

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Countries this buyer operates in or imports to',
  })
  operatingCountries: string[];

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  averageOrderValue: number;

  @Column({ type: 'enum', enum: PreferredPaymentMethod, nullable: true })
  preferredPaymentMethod: PreferredPaymentMethod;

  @Column({ nullable: true })
  creditLimit: number;

  @Column({ default: 0 })
  totalOrdersPlaced: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalValueOrdered: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  averageRating: number;

  @Column({ default: 0 })
  totalReviews: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPremium: boolean;

  @Column({ nullable: true })
  timezone: string;

  @Column({ nullable: true })
  preferredCommunicationMethod: string; // email, phone, whatsapp, etc.

  // Relationships
  @OneToMany(() => SourcingRequest, (request) => request.globalBuyer)
  sourcingRequests: SourcingRequest[];

  @OneToMany(() => BuyerVerificationDocument, (doc) => doc.buyer)
  verificationDocuments: BuyerVerificationDocument[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
