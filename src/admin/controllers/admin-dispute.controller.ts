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
import { EscrowService } from '../../payment/services/escrow.service';
import { EscrowAccount, EscrowStatus } from '../../payment/entities/escrow-account.entity';

@Controller('admin/disputes')
@UseGuards(AdminGuard)
export class AdminDisputeController {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(EscrowAccount)
    private escrowRepo: Repository<EscrowAccount>,
    private escrowService: EscrowService,
    private responseService: ResponseService,
  ) {}

  /**
   * Get all disputed orders
   */
  @Get()
  async getDisputes(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('resolved') resolved?: boolean,
  ) {
    const query = this.orderRepo.createQueryBuilder('order')
      .where('order.status = :status', { status: OrderStatus.DISPUTED })
      .leftJoinAndSelect('order.globalBuyer', 'buyer')
      .leftJoinAndSelect('buyer.user', 'buyerUser')
      .leftJoinAndSelect('order.exporter', 'exporter')
      .leftJoinAndSelect('exporter.user', 'exporterUser')
      .leftJoinAndSelect('order.documents', 'documents');

    if (resolved !== undefined) {
      if (resolved) {
        query.andWhere('order.disputeResolvedAt IS NOT NULL');
      } else {
        query.andWhere('order.disputeResolvedAt IS NULL');
      }
    }

    query.orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [disputes, total] = await query.getManyAndCount();

    return this.responseService.sendSuccess('Disputes retrieved', {
      data: disputes,
      total,
      page,
      limit,
    });
  }

  /**
   * Get dispute details
   */
  @Get(':orderId')
  async getDisputeDetails(@Param('orderId') orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: [
        'globalBuyer',
        'globalBuyer.user',
        'exporter',
        'exporter.user',
        'offer',
        'documents',
      ],
    });

    if (!order) {
      return this.responseService.sendError('Order not found', HttpStatus.NOT_FOUND);
    }

    // Get escrow details if exists
    const escrow = await this.escrowService.getByOrderId(orderId);
    const milestones = await this.escrowService.getMilestones(orderId);

    return this.responseService.sendSuccess('Dispute details', {
      order,
      escrow,
      milestones,
    });
  }

  /**
   * Assign mediator to dispute
   */
  @Post(':orderId/assign-mediator')
  async assignMediator(
    @Param('orderId') orderId: string,
    @Body('mediatorId') mediatorId: string,
    @Request() req: any,
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });

    if (!order) {
      return this.responseService.sendError('Order not found', HttpStatus.NOT_FOUND);
    }

    if (order.status !== OrderStatus.DISPUTED) {
      return this.responseService.sendError('Order is not in disputed status', HttpStatus.BAD_REQUEST);
    }

    order.mediationAssignedTo = mediatorId || req.user.id;
    await this.orderRepo.save(order);

    return this.responseService.sendSuccess('Mediator assigned', { orderId, mediatorId: order.mediationAssignedTo });
  }

  /**
   * Freeze escrow for disputed order
   */
  @Post(':orderId/freeze-escrow')
  async freezeEscrow(
    @Param('orderId') orderId: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const escrow = await this.escrowService.getByOrderId(orderId);

    if (!escrow) {
      return this.responseService.sendError('No escrow found for this order', HttpStatus.NOT_FOUND);
    }

    if (escrow.status === EscrowStatus.FROZEN) {
      return this.responseService.sendError('Escrow is already frozen', HttpStatus.BAD_REQUEST);
    }

    const frozen = await this.escrowService.freezeEscrow(escrow.id, req.user.id, reason);

    return this.responseService.sendSuccess('Escrow frozen', frozen);
  }

  /**
   * Unfreeze escrow
   */
  @Post(':orderId/unfreeze-escrow')
  async unfreezeEscrow(
    @Param('orderId') orderId: string,
    @Request() req: any,
  ) {
    const escrow = await this.escrowService.getByOrderId(orderId);

    if (!escrow) {
      return this.responseService.sendError('No escrow found for this order', HttpStatus.NOT_FOUND);
    }

    const unfrozen = await this.escrowService.unfreezeEscrow(escrow.id, req.user.id);

    return this.responseService.sendSuccess('Escrow unfrozen', unfrozen);
  }

  /**
   * Resolve dispute in favor of buyer (refund)
   */
  @Post(':orderId/resolve/buyer')
  async resolveForBuyer(
    @Param('orderId') orderId: string,
    @Body('refundAmount') refundAmount: number,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });

    if (!order) {
      return this.responseService.sendError('Order not found', HttpStatus.NOT_FOUND);
    }

    const escrow = await this.escrowService.getByOrderId(orderId);

    if (escrow && refundAmount > 0) {
      // Process refund
      await this.escrowService.processRefund(escrow.id, refundAmount, reason, req.user.id);
    }

    // Update order
    order.status = OrderStatus.CANCELLED;
    order.disputeResolutionOutcome = `Resolved in favor of buyer: ${reason}`;
    order.disputeResolvedAt = new Date();
    order.cancelledAt = new Date();
    order.cancellationReason = reason;

    await this.orderRepo.save(order);

    return this.responseService.sendSuccess('Dispute resolved in favor of buyer', {
      orderId,
      refundAmount,
      outcome: order.disputeResolutionOutcome,
    });
  }

  /**
   * Resolve dispute in favor of exporter (release funds)
   */
  @Post(':orderId/resolve/exporter')
  async resolveForExporter(
    @Param('orderId') orderId: string,
    @Body('releaseRemaining') releaseRemaining: boolean,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });

    if (!order) {
      return this.responseService.sendError('Order not found', HttpStatus.NOT_FOUND);
    }

    const escrow = await this.escrowService.getByOrderId(orderId);

    if (escrow && releaseRemaining) {
      // Unfreeze if frozen
      if (escrow.status === EscrowStatus.FROZEN) {
        await this.escrowService.unfreezeEscrow(escrow.id, req.user.id);
      }

      // Release remaining milestones
      const milestones = await this.escrowService.getMilestones(orderId);
      for (const milestone of milestones) {
        if (milestone.releasePercentage > 0 && milestone.status !== 'released') {
          await this.escrowService.releaseMilestone(milestone.id, req.user.id);
        }
      }
    }

    // Update order
    order.status = order.previousStatus || OrderStatus.COMPLETED;
    order.disputeResolutionOutcome = `Resolved in favor of exporter: ${reason}`;
    order.disputeResolvedAt = new Date();

    if (order.status === OrderStatus.COMPLETED) {
      order.completedAt = new Date();
    }

    await this.orderRepo.save(order);

    return this.responseService.sendSuccess('Dispute resolved in favor of exporter', {
      orderId,
      newStatus: order.status,
      outcome: order.disputeResolutionOutcome,
    });
  }

  /**
   * Resolve dispute with partial resolution
   */
  @Post(':orderId/resolve/partial')
  async resolvePartial(
    @Param('orderId') orderId: string,
    @Body('buyerRefund') buyerRefund: number,
    @Body('exporterRelease') exporterRelease: number,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });

    if (!order) {
      return this.responseService.sendError('Order not found', HttpStatus.NOT_FOUND);
    }

    const escrow = await this.escrowService.getByOrderId(orderId);

    if (!escrow) {
      return this.responseService.sendError('No escrow for this order', HttpStatus.NOT_FOUND);
    }

    // Process buyer refund
    if (buyerRefund > 0) {
      await this.escrowService.processRefund(escrow.id, buyerRefund, `Partial refund: ${reason}`, req.user.id);
    }

    // Note: Exporter release would require manual milestone release or custom transaction
    // This is tracked in the resolution outcome

    // Update order
    order.status = OrderStatus.COMPLETED;
    order.disputeResolutionOutcome = `Partial resolution: Buyer refunded ${buyerRefund}, Exporter released ${exporterRelease}. Reason: ${reason}`;
    order.disputeResolvedAt = new Date();
    order.completedAt = new Date();

    await this.orderRepo.save(order);

    return this.responseService.sendSuccess('Dispute resolved with partial resolution', {
      orderId,
      buyerRefund,
      exporterRelease,
      outcome: order.disputeResolutionOutcome,
    });
  }

  /**
   * Get dispute statistics
   */
  @Get('stats/overview')
  async getDisputeStats() {
    const totalDisputes = await this.orderRepo.count({
      where: { status: OrderStatus.DISPUTED },
    });

    const resolvedDisputes = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.disputeResolvedAt IS NOT NULL')
      .getCount();

    const pendingDisputes = totalDisputes;

    // Disputes by outcome
    const byOutcome = await this.orderRepo
      .createQueryBuilder('order')
      .select('order.disputeResolutionOutcome', 'outcome')
      .addSelect('COUNT(*)', 'count')
      .where('order.disputeResolvedAt IS NOT NULL')
      .groupBy('order.disputeResolutionOutcome')
      .getRawMany();

    // Average resolution time
    const avgResolutionTime = await this.orderRepo
      .createQueryBuilder('order')
      .select('AVG(EXTRACT(EPOCH FROM (order.disputeResolvedAt - order.disputeEscalationAt)) / 86400)', 'avgDays')
      .where('order.disputeResolvedAt IS NOT NULL')
      .andWhere('order.disputeEscalationAt IS NOT NULL')
      .getRawOne();

    return this.responseService.sendSuccess('Dispute stats', {
      totalDisputes,
      resolvedDisputes,
      pendingDisputes,
      byOutcome,
      avgResolutionTimeDays: avgResolutionTime?.avgDays || null,
    });
  }
}
