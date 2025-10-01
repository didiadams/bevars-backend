import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderDocument } from '../entities/order-document.entity';

@Injectable()
export class OrderDocumentRepository extends Repository<OrderDocument> {
  constructor(@InjectRepository(OrderDocument) private repo: Repository<OrderDocument>) {
    super(repo.target, repo.manager, repo.queryRunner);
  }

  async findByOrderId(orderId: string): Promise<OrderDocument[]> {
    return this.find({ where: { orderId } });
  }
}
