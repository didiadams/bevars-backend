import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

export enum OrderDocumentType {
  PROFORMA_INVOICE = 'proforma_invoice',
  INVOICE = 'invoice',
  PURCHASE_ORDER = 'purchase_order',
  PRODUCTION_REPORT = 'production_report',
  PACKING_LIST = 'packing_list',
  CERTIFICATE_OF_ORIGIN = 'certificate_of_origin',
  BILL_OF_LADING = 'bill_of_lading',
  DELIVERY_NOTE = 'delivery_note',
  FINAL_INVOICE = 'final_invoice',
  CANCELLATION_NOTICE = 'cancellation_notice',
  DISPUTE_DOC = 'dispute_document',
}

@Entity('order_document')
export class OrderDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: string;

  @Column({ type: 'enum', enum: OrderDocumentType })
  type: OrderDocumentType;

  // Location/URL where the file is stored (could be Cloudinary/S3 path)
  @Column({ type: 'text' })
  url: string;

  // user id who uploaded (usually exporter.userId)
  @Column({ nullable: true })
  uploadedByUserId: string;

  @CreateDateColumn()
  uploadedAt: Date;
}
