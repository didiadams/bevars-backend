import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminGuard } from '../guards/admin.guard';
import { ResponseService } from '../../common/services/response.service';
import { Order, OrderStatus } from '../../order/entities/order.entity';
import { OrderDocument } from '../../order/entities/order-document.entity';
import { GlobalBuyer } from '../../global-buyer/entities/global-buyer.entity';
import { Exporter } from '../../exporter/entities/exporter.entity';

@Controller('admin/orders')
@UseGuards(AdminGuard)
export class AdminOrderController {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(OrderDocument)
    private orderDocumentRepo: Repository<OrderDocument>,
    @InjectRepository(GlobalBuyer)
    private buyerRepo: Repository<GlobalBuyer>,
    @InjectRepository(Exporter)
    private exporterRepo: Repository<Exporter>,
    private responseService: ResponseService,
  ) {}

  /**
   * Get all orders with filters and pagination
   */
  @Get()
  async getAllOrders(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: OrderStatus,
    @Query('exporterId') exporterId?: string,
    @Query('buyerId') buyerId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sortBy') sortBy: string = 'createdAt',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    const query = this.orderRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.globalBuyer', 'buyer')
      .leftJoinAndSelect('buyer.user', 'buyerUser')
      .leftJoinAndSelect('order.exporter', 'exporter')
      .leftJoinAndSelect('exporter.user', 'exporterUser')
      .leftJoinAndSelect('order.offer', 'offer');

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    if (exporterId) {
      query.andWhere('order.exporterId = :exporterId', { exporterId });
    }

    if (buyerId) {
      query.andWhere('order.globalBuyerId = :buyerId', { buyerId });
    }

    if (search) {
      query.andWhere(
        '(order.orderNumber ILIKE :search OR buyerUser.email ILIKE :search OR exporterUser.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (dateFrom) {
      query.andWhere('order.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      query.andWhere('order.createdAt <= :dateTo', { dateTo });
    }

    query.orderBy(`order.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [orders, total] = await query.getManyAndCount();

    return this.responseService.sendSuccess('Orders retrieved', {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  /**
   * Get order details with full information
   */
  @Get(':orderId')
  async getOrderDetails(@Param('orderId') orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: [
        'globalBuyer',
        'globalBuyer.user',
        'exporter',
        'exporter.user',
        'offer',
        'offer.sourcingRequest',
        'documents',
      ],
    });

    if (!order) {
      return this.responseService.sendError('Order not found', HttpStatus.NOT_FOUND);
    }

    return this.responseService.sendSuccess('Order details retrieved', order);
  }

  /**
   * Get order documents
   */
  @Get(':orderId/documents')
  async getOrderDocuments(@Param('orderId') orderId: string) {
    const documents = await this.orderDocumentRepo.find({
      where: { orderId },
      order: { uploadedAt: 'DESC' },
    });

    return this.responseService.sendSuccess('Documents retrieved', documents);
  }

  /**
   * Update order status (admin override)
   */
  @Put(':orderId/status')
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body('status') status: OrderStatus,
    @Body('notes') notes: string,
    @Request() req: any,
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });

    if (!order) {
      return this.responseService.sendError('Order not found', HttpStatus.NOT_FOUND);
    }

    const previousStatus = order.status;
    order.status = status;

    // Set timestamps based on status
    const now = new Date();
    switch (status) {
      case OrderStatus.CONFIRMED:
        order.confirmedAt = now;
        break;
      case OrderStatus.SHIPPED:
        order.shippedAt = now;
        break;
      case OrderStatus.DELIVERED:
        order.deliveredAt = now;
        break;
      case OrderStatus.COMPLETED:
        order.completedAt = now;
        break;
      case OrderStatus.CANCELLED:
        order.cancelledAt = now;
        order.cancellationReason = notes || 'Admin cancelled';
        break;
    }

    if (notes) {
      order.notes = `${order.notes || ''}\n[Admin ${req.user.email}]: ${notes}`;
    }

    await this.orderRepo.save(order);

    return this.responseService.sendSuccess('Order status updated', {
      orderId,
      previousStatus,
      newStatus: status,
    });
  }

  /**
   * Add admin note to order
   */
  @Post(':orderId/notes')
  async addOrderNote(
    @Param('orderId') orderId: string,
    @Body('note') note: string,
    @Request() req: any,
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });

    if (!order) {
      return this.responseService.sendError('Order not found', HttpStatus.NOT_FOUND);
    }

    const timestamp = new Date().toISOString();
    order.notes = `${order.notes || ''}\n[${timestamp}] Admin ${req.user.email}: ${note}`;

    await this.orderRepo.save(order);

    return this.responseService.sendSuccess('Note added', { orderId });
  }

  /**
   * Get order statistics
   */
  @Get('stats/overview')
  async getOrderStats() {
    const stats = await this.orderRepo.createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(order.totalAmount)', 'totalValue')
      .groupBy('order.status')
      .getRawMany();

    const totalOrders = await this.orderRepo.count();
    const totalValue = await this.orderRepo
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .getRawOne();

    const todayOrders = await this.orderRepo
      .createQueryBuilder('order')
      .where('DATE(order.createdAt) = CURRENT_DATE')
      .getCount();

    const disputedOrders = await this.orderRepo.count({
      where: { status: OrderStatus.DISPUTED },
    });

    return this.responseService.sendSuccess('Order stats', {
      totalOrders,
      totalValue: totalValue?.total || 0,
      todayOrders,
      disputedOrders,
      byStatus: stats,
    });
  }

  /**
   * Get orders requiring attention (disputes, stalled, etc.)
   */
  @Get('attention/required')
  async getOrdersRequiringAttention() {
    // Disputed orders
    const disputed = await this.orderRepo.find({
      where: { status: OrderStatus.DISPUTED },
      relations: ['globalBuyer.user', 'exporter.user'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    // Stalled orders (no update in 7+ days, not completed/cancelled)
    const stalledQuery = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.status NOT IN (:...finalStatuses)', {
        finalStatuses: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      })
      .andWhere('order.updatedAt < NOW() - INTERVAL \'7 days\'')
      .leftJoinAndSelect('order.globalBuyer', 'buyer')
      .leftJoinAndSelect('buyer.user', 'buyerUser')
      .leftJoinAndSelect('order.exporter', 'exporter')
      .leftJoinAndSelect('exporter.user', 'exporterUser')
      .orderBy('order.updatedAt', 'ASC')
      .take(10)
      .getMany();

    // Awaiting approval for too long
    const awaitingApproval = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.awaitingApprovalFor IS NOT NULL')
      .andWhere('order.awaitingApprovalAt < NOW() - INTERVAL \'48 hours\'')
      .leftJoinAndSelect('order.globalBuyer', 'buyer')
      .leftJoinAndSelect('buyer.user', 'buyerUser')
      .orderBy('order.awaitingApprovalAt', 'ASC')
      .take(10)
      .getMany();

    return this.responseService.sendSuccess('Orders requiring attention', {
      disputed,
      stalled: stalledQuery,
      awaitingApproval,
    });
  }
}
