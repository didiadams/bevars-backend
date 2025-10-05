import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
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
  @Exclude()
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
  isEmailVerified: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'integer', default: 0 }) 
  tokenVersion: number;

  // Notification Preferences
  @Column({ type: 'json', nullable: true })
  emailNotificationPreferences: {
    negotiationStarted: boolean;
    counterOfferReceived: boolean;
    negotiationAccepted: boolean;
    negotiationDeclined: boolean;
    orderCreated: boolean;
    orderStatusUpdated: boolean;
    marketTrends: boolean;
    platformUpdates: boolean;
  };

  @Column({ type: 'json', nullable: true })
  pushNotificationPreferences: {
    negotiationStarted: boolean;
    counterOfferReceived: boolean;
    negotiationAccepted: boolean;
    negotiationDeclined: boolean;
    orderCreated: boolean;
    orderStatusUpdated: boolean;
  };

  @Column({ type: 'enum', enum: ['immediate', 'daily', 'weekly'], default: 'immediate' })
  notificationFrequency: 'immediate' | 'daily' | 'weekly';                    

  @OneToOne(() => GlobalBuyer, (globalBuyer) => globalBuyer.user)
  globalBuyer: GlobalBuyer;

  @OneToOne(() => Exporter, (exporter) => exporter.user)
  exporter: Exporter;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
