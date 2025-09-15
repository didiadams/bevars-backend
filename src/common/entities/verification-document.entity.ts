import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Exporter } from 'src/exporter/entities/exporter.entity';
import { GlobalBuyer } from 'src/global-buyer/entities/global-buyer.entity';
// Avoid importing VerificationStatus from exporter.entity to prevent circular
// dependency during runtime (migrations, ts-node). Use literal enum values
// at the DB column level and keep the TypeScript type as `string` so callers
// can assign either the Exporter.VerificationStatus values or plain strings.

@Entity('verification_document')
export class VerificationDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable owner relations: a document belongs either to an exporter or a buyer
  @ManyToOne(() => Exporter, (exporter) => (exporter as any).verificationDocuments, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  exporter?: Exporter;

  @ManyToOne(() => GlobalBuyer, (buyer) => (buyer as any).verificationDocuments, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  buyer?: GlobalBuyer;

  // Convenience owner id (denormalized) for faster queries
  @Column({ nullable: true })
  ownerId?: string;

  @Column({ nullable: false })
  documentType: string; // canonical type key e.g. 'cac_certificate', 'passport'

  @Column({ nullable: false })
  fileUrl: string;

  @Column({ nullable: true })
  fileName?: string;

  @Column({ nullable: true })
  mimeType?: string;

  @Column({ nullable: true })
  fileSize?: number;

  // Allowed status values (kept in sync with Exporter.VerificationStatus)
  // Note: use string typing to avoid tight coupling with other entity enums.
  @Column({ type: 'enum', enum: ['pending', 'under_review', 'approved', 'rejected'], default: 'pending' })
  @Index()
  status: string;

  @Column({ nullable: true })
  uploadedBy?: string;

  @Column({ nullable: true })
  reviewedBy?: string;

  @Column({ nullable: true, type: 'text' })
  reviewNotes?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  uploadedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
