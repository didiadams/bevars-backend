import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { GlobalBuyer } from 'src/global-buyer/entities/global-buyer.entity';
import { Exporter } from 'src/exporter/entities/exporter.entity';

export enum UserRole {
  GLOBAL_BUYER = 'global_buyer',
  EXPORTER = 'exporter',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  BLOCKED = 'blocked',
}

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  companyName: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ nullable: true })
  countryName: string;

  @Column({ nullable: true })
  countryCode: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ default: false })
  tokenVersion: number;

  @OneToOne(() => GlobalBuyer, { cascade: true, onDelete: 'CASCADE' })
  globalBuyer: GlobalBuyer;

  @OneToOne(() => Exporter, { cascade: true, onDelete: 'CASCADE' })
  exporter: Exporter;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
