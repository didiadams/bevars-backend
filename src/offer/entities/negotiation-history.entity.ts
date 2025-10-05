import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Offer } from './offer.entity';

export enum NegotiationType {
  BUYER_NEGOTIATION = 'buyer_negotiation',
  EXPORTER_COUNTER = 'exporter_counter',
  BUYER_ACCEPTANCE = 'buyer_acceptance',
  EXPORTER_ACCEPTANCE = 'exporter_acceptance',
  BUYER_REJECTION = 'buyer_rejection',
  EXPORTER_REJECTION = 'exporter_rejection',
}

export enum NegotiationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  SUPERSEDED = 'superseded', // When a new negotiation round starts
}

@Entity('negotiation_history')
export class NegotiationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Offer, { onDelete: 'CASCADE' })
  @JoinColumn()
  offer: Offer;

  @Column({ nullable: false })
  offerId: string;

  @Column({ type: 'enum', enum: NegotiationType, nullable: false })
  type: NegotiationType;

  @Column({ type: 'enum', enum: NegotiationStatus, default: NegotiationStatus.PENDING })
  status: NegotiationStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  proposedPricePerUnit: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  proposedQuantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  proposedTotalPrice: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: false })
  initiatedBy: string; // User ID who initiated this negotiation step

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'int', default: 1 })
  negotiationRound: number;

  @CreateDateColumn()
  createdAt: Date;
}