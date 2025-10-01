import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

export enum ReviewRole {
  EXPORTER = 'exporter',
  GLOBAL_BUYER = 'global_buyer',
}

@Entity('order_review')
export class OrderReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: string;

  // Rating 1-5
  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  // role of reviewer (exporter or global_buyer)
  @Column({ type: 'enum', enum: ReviewRole })
  role: ReviewRole;

  // user id who authored the review
  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
