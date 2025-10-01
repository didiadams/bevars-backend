import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderReview } from '../entities/review.entity';

@Injectable()
export class OrderReviewRepository extends Repository<OrderReview> {
  constructor(@InjectRepository(OrderReview) private repo: Repository<OrderReview>) {
    super(repo.target, repo.manager, repo.queryRunner);
  }

  async findByOrderId(orderId: string): Promise<OrderReview[]> {
    return this.find({ where: { orderId }, order: { createdAt: 'DESC' } });
  }
}
