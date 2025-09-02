import { GlobalBuyer } from 'src/global-buyer/entities/global-buyer.entity';
import { Exporter } from 'src/exporter/entities/exporter.entity';
import { Order } from 'src/order/entities/order.entity';
import { User } from 'src/user/entities/user.entity';
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

export enum ChatStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  CLOSED = 'closed',
}

@Entity('chat')
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order)
  @JoinColumn()
  order: Order;

  @Column({ nullable: false })
  orderId: string;

  @ManyToOne(() => GlobalBuyer)
  @JoinColumn()
  globalBuyer: GlobalBuyer;

  @Column({ nullable: false })
  globalBuyerId: string;

  @ManyToOne(() => Exporter)
  @JoinColumn()
  exporter: Exporter;

  @Column({ nullable: false })
  exporterId: string;

  @Column({ type: 'enum', enum: ChatStatus, default: ChatStatus.ACTIVE })
  status: ChatStatus;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string;

  @OneToMany(() => ChatMessage, (message) => message.chat)
  messages: ChatMessage[];

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('chat_message')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Chat, (chat) => chat.messages)
  @JoinColumn()
  chat: Chat;

  @Column({ nullable: false })
  chatId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  sender: User;

  @Column({ nullable: true })
  senderId: string;

  @Column({ type: 'text', nullable: false })
  message: string;

  @Column({ type: 'simple-array', nullable: true })
  attachments: string[];

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date;

  @Column({ default: false })
  isSystemMessage: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
