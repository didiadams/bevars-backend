import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { GlobalBuyer } from './global-buyer.entity';

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

  @Column({ default: 'uploaded' })
  status: string; // 'uploaded', 'approved', 'rejected', etc.

  @CreateDateColumn()
  uploadedAt: Date;
}
