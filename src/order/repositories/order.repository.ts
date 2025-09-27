import { Repository, SelectQueryBuilder } from 'typeorm';
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
    // Helper to apply exporter/global buyer filters to a fresh query builder
    const applyFilters = (qb: SelectQueryBuilder<Order>) => {
      let first = true;
      if (exporterId) {
        qb.where('order.exporterId = :exporterId', { exporterId });
        first = false;
      }
      if (globalBuyerId) {
        if (first) {
          qb.where('order.globalBuyerId = :globalBuyerId', { globalBuyerId });
        } else {
          qb.andWhere('order.globalBuyerId = :globalBuyerId', { globalBuyerId });
        }
      }
      return qb;
    };

    // Use fresh builders for each count so additional .andWhere() calls don't accumulate
    const totalQb = applyFilters(this.createQueryBuilder('order'));
    const pendingQb = applyFilters(this.createQueryBuilder('order')).andWhere('order.status = :status', { status: OrderStatus.PENDING });
    const confirmedQb = applyFilters(this.createQueryBuilder('order')).andWhere('order.status = :status', { status: OrderStatus.CONFIRMED });
    const completedQb = applyFilters(this.createQueryBuilder('order')).andWhere('order.status = :status', { status: OrderStatus.COMPLETED });
    const cancelledQb = applyFilters(this.createQueryBuilder('order')).andWhere('order.status = :status', { status: OrderStatus.CANCELLED });

    const [total, pending, confirmed, completed, cancelled] = await Promise.all([
      totalQb.getCount(),
      pendingQb.getCount(),
      confirmedQb.getCount(),
      completedQb.getCount(),
      cancelledQb.getCount(),
    ]);

    return { total, pending, confirmed, completed, cancelled };
  }
}
