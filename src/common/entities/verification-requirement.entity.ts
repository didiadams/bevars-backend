import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type OwnerType = 'exporter' | 'buyer';

@Entity('verification_requirement')
export class VerificationRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  ownerType: OwnerType; // 'exporter' | 'buyer'

  @Column({ type: 'varchar' })
  documentType: string; // canonical key

  @Column({ type: 'varchar' })
  label: string; // display label

  @Column({ default: true })
  required: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'simple-array', nullable: true })
  allowedMimeTypes?: string[];

  @Column({ type: 'bigint', nullable: true })
  maxFileSizeBytes?: number;

  @Column({ type: 'json', nullable: true })
  tiers?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
