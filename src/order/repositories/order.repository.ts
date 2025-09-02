import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus } from '../entities/order.entity';

@Injectable()
export class OrderRepository extends Repository<Order> {
  constructor(
    @InjectRepository(Order)
    private repository: Repository<Order>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async findByGlobalBuyerId(globalBuyerId: string): Promise<Order[]> {
    return this.find({
      where: { globalBuyerId },
      relations: ['offer', 'exporter', 'exporter.user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByExporterId(exporterId: string): Promise<Order[]> {
    return this.find({
      where: { exporterId },
      relations: ['offer', 'globalBuyer', 'globalBuyer.user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    return this.find({
      where: { status },
      relations: ['offer', 'globalBuyer', 'exporter'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    return this.findOne({
      where: { orderNumber },
      relations: ['offer', 'globalBuyer', 'exporter', 'globalBuyer.user', 'exporter.user'],
    });
  }

  async generateOrderNumber(): Promise<string> {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }

  async getOrderStatistics(exporterId?: string, globalBuyerId?: string): Promise<any> {
    const query = this.createQueryBuilder('order');
    
    if (exporterId) {
      query.where('order.exporterId = :exporterId', { exporterId });
    }
    
    if (globalBuyerId) {
      query.where('order.globalBuyerId = :globalBuyerId', { globalBuyerId });
    }

    const total = await query.getCount();
    const pending = await query.andWhere('order.status = :status', { status: OrderStatus.PENDING }).getCount();
    const confirmed = await query.andWhere('order.status = :status', { status: OrderStatus.CONFIRMED }).getCount();
    const completed = await query.andWhere('order.status = :status', { status: OrderStatus.COMPLETED }).getCount();
    const cancelled = await query.andWhere('order.status = :status', { status: OrderStatus.CANCELLED }).getCount();

    return {
      total,
      pending,
      confirmed,
      completed,
      cancelled,
    };
  }
}
