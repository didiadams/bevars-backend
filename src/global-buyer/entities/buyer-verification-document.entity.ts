import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { GlobalBuyer } from './global-buyer.entity';
import { VerificationStatus } from 'src/exporter/entities/exporter.entity';

@Entity('buyer_verification_document')
export class BuyerVerificationDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GlobalBuyer, (buyer) => buyer.verificationDocuments, { onDelete: 'CASCADE' })
  buyer: GlobalBuyer;

  @Column()
  documentType: string; // e.g., 'passport', 'certificate', etc.

  @Column()
  fileUrl: string; // Cloudinary URL

  // Use the shared VerificationStatus enum so buyer documents use the same lifecycle
  @Column({ type: 'enum', enum: VerificationStatus, default: VerificationStatus.PENDING })
  status: VerificationStatus;

  @CreateDateColumn()
  uploadedAt: Date;
}
