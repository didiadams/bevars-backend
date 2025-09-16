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
import { Offer } from 'src/offer/entities/offer.entity';
import { VerificationDocument } from 'src/common/entities/verification-document.entity';

export enum ExportLicense {
  EXPORT_LICENSE = 'exportLicense',
  PHYTOSANITARY_CERTIFICATE = 'phytosanitaryCertificate',
  QUALITY_CERTIFICATE = 'qualityCertificate',
  ORIGIN_CERTIFICATE = 'originCertificate',
}

export enum VerificationStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ExporterCategory {
  AGRICULTURAL_PRODUCTS = 'agricultural_products',
  PROCESSED_FOODS = 'processed_foods',
  SPICES_HERBS = 'spices_herbs',
  FRUITS_VEGETABLES = 'fruits_vegetables',
  GRAINS_CEREALS = 'grains_cereals',
  LIVESTOCK_PRODUCTS = 'livestock_products',
  SEAFOOD = 'seafood',
  BEVERAGES = 'beverages',
}

@Entity('exporter')
export class Exporter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.exporter, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  companyRegistrationNumber: string;

  @Column({ nullable: true })
  businessLicenseNumber: string;

  @Column({ nullable: true })
  taxIdentificationNumber: string;

  @Column({
    nullable: true,
    type: 'text',
    transformer: {
      to: (value) => (value ? JSON.stringify(value) : null),
      from: (value) => (value ? JSON.parse(value) : null),
    },
    comment: 'Stores paths to verification documents',
  })
  // legacy JSON blob removed - verification documents are stored in `VerificationDocument` table

  @Column({ type: 'enum', enum: VerificationStatus, default: VerificationStatus.PENDING })
  verificationStatus: VerificationStatus;

  @Column({
    type: 'boolean',
    default: false,
  })
  isVerified: boolean;

  @Column({ nullable: true })
  verificationReviewedBy: string;

  @Column({ nullable: true })
  verificationReviewedAt: Date;

  @Column({ nullable: true })
  verificationNotes: string;

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Product categories this exporter specializes in',
  })
  productCategories: ExporterCategory[];

  @Column({ nullable: true })
  businessDescription: string;

  @Column({ nullable: true })
  yearsInBusiness: number;

  @Column({ nullable: true })
  exportCapacityPerMonth: number; // in tons or relevant unit

  @Column({ nullable: true })
  minimumOrderQuantity: number;

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Countries this exporter can ship to',
  })
  exportDestinations: string[];

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  averageRating: number;

  @Column({ default: 0 })
  completedOrders: number;

  @Column({ default: 0 })
  totalReviews: number;

  @Column({ default: 0 })
  positiveReviews: number;

  @Column({ default: 0 })
  negativeReviews: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isFeatured: boolean;

  // Relationships
  @OneToMany(() => Offer, (offer) => offer.exporter)
  offers: Offer[];

  @OneToMany(() => VerificationDocument, (doc) => doc.exporter)
  verificationDocuments: VerificationDocument[];

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Primary crops selected by exporter for their specialization',
  })
  primaryCrops: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
