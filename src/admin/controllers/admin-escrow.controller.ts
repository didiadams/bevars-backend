import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';
import { ResponseService } from '../../common/services/response.service';
import { EscrowService } from '../../payment/services/escrow.service';
import { PayoutService } from '../../payment/services/payout.service';
import { EscrowStatus } from '../../payment/entities/escrow-account.entity';
import { PayoutStatus } from '../../payment/entities/payout-record.entity';

@Controller('admin/escrow')
@UseGuards(AdminGuard)
export class AdminEscrowController {
  constructor(
    private escrowService: EscrowService,
    private payoutService: PayoutService,
    private responseService: ResponseService,
  ) {}

  /**
   * Get all escrow accounts with filters
   */
  @Get()
  async getAllEscrows(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: EscrowStatus,
  ) {
    const result = await this.escrowService.listAll(page, limit, status);
    return this.responseService.sendSuccess('Escrow accounts retrieved', result);
  }

  /**
   * Get escrow details
   */
  @Get(':escrowId')
  async getEscrowDetails(@Param('escrowId') escrowId: string) {
    try {
      const escrow = await this.escrowService.getEscrowDetails(escrowId);
      const milestones = await this.escrowService.getMilestones(escrow.orderId);

      return this.responseService.sendSuccess('Escrow details', {
        escrow,
        milestones,
      });
    } catch (error) {
      return this.responseService.sendError(error.message, HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Get escrow by order ID
   */
  @Get('order/:orderId')
  async getEscrowByOrder(@Param('orderId') orderId: string) {
    const escrow = await this.escrowService.getByOrderId(orderId);

    if (!escrow) {
      return this.responseService.sendError('No escrow found for this order', HttpStatus.NOT_FOUND);
    }

    const milestones = await this.escrowService.getMilestones(orderId);

    return this.responseService.sendSuccess('Escrow for order', {
      escrow,
      milestones,
    });
  }

  /**
   * Manual deposit recording (for bank transfers not caught by webhook)
   */
  @Post(':escrowId/record-deposit')
  async recordManualDeposit(
    @Param('escrowId') escrowId: string,
    @Body('amount') amount: number,
    @Body('reference') reference: string,
    @Body('notes') notes: string,
    @Request() req: any,
  ) {
    try {
      const transaction = await this.escrowService.recordDeposit(
        escrowId,
        amount,
        reference,
        `manual-${Date.now()}`,
      );

      return this.responseService.sendSuccess('Deposit recorded', transaction);
    } catch (error) {
      return this.responseService.sendError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Manual milestone release
   */
  @Post('milestone/:milestoneId/release')
  async releaseMilestone(
    @Param('milestoneId') milestoneId: string,
    @Body('notes') notes: string,
    @Request() req: any,
  ) {
    try {
      const result = await this.escrowService.releaseMilestone(
        milestoneId,
        req.user.id,
        false,
      );

      if (!result.success) {
        return this.responseService.sendError(result.error, HttpStatus.BAD_REQUEST);
      }

      return this.responseService.sendSuccess('Milestone released', result);
    } catch (error) {
      return this.responseService.sendError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Freeze escrow
   */
  @Post(':escrowId/freeze')
  async freezeEscrow(
    @Param('escrowId') escrowId: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    try {
      const escrow = await this.escrowService.freezeEscrow(escrowId, req.user.id, reason);
      return this.responseService.sendSuccess('Escrow frozen', escrow);
    } catch (error) {
      return this.responseService.sendError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Unfreeze escrow
   */
  @Post(':escrowId/unfreeze')
  async unfreezeEscrow(
    @Param('escrowId') escrowId: string,
    @Request() req: any,
  ) {
    try {
      const escrow = await this.escrowService.unfreezeEscrow(escrowId, req.user.id);
      return this.responseService.sendSuccess('Escrow unfrozen', escrow);
    } catch (error) {
      return this.responseService.sendError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Process refund
   */
  @Post(':escrowId/refund')
  async processRefund(
    @Param('escrowId') escrowId: string,
    @Body('amount') amount: number,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    try {
      const transaction = await this.escrowService.processRefund(
        escrowId,
        amount,
        reason,
        req.user.id,
      );

      return this.responseService.sendSuccess('Refund processed', transaction);
    } catch (error) {
      return this.responseService.sendError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Get all payouts with filters
   */
  @Get('payouts/list')
  async getAllPayouts(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: PayoutStatus,
    @Query('exporterId') exporterId?: string,
  ) {
    const result = await this.payoutService.listPayouts(page, limit, {
      status,
      exporterId,
    });

    return this.responseService.sendSuccess('Payouts retrieved', result);
  }

  /**
   * Process a pending payout
   */
  @Post('payouts/:payoutId/process')
  async processPayout(
    @Param('payoutId') payoutId: string,
    @Request() req: any,
  ) {
    try {
      const payout = await this.payoutService.processPayout(payoutId);
      return this.responseService.sendSuccess('Payout processed', payout);
    } catch (error) {
      return this.responseService.sendError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Retry a failed payout
   */
  @Post('payouts/:payoutId/retry')
  async retryPayout(
    @Param('payoutId') payoutId: string,
    @Request() req: any,
  ) {
    try {
      const payout = await this.payoutService.retryPayout(payoutId, req.user.id);
      return this.responseService.sendSuccess('Payout retry initiated', payout);
    } catch (error) {
      return this.responseService.sendError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Sync payout status from Flutterwave
   */
  @Post('payouts/:payoutId/sync')
  async syncPayoutStatus(@Param('payoutId') payoutId: string) {
    try {
      const payout = await this.payoutService.syncPayoutStatus(payoutId);
      return this.responseService.sendSuccess('Payout status synced', payout);
    } catch (error) {
      return this.responseService.sendError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Get escrow and payout statistics
   */
  @Get('stats/overview')
  async getEscrowStats() {
    const payoutStats = await this.payoutService.getPayoutStats();

    // Get escrow stats
    const escrowList = await this.escrowService.listAll(1, 1000);
    
    const escrowStats = {
      total: escrowList.total,
      byStatus: {} as Record<string, number>,
      totalFunded: 0,
      totalReleased: 0,
      totalRefunded: 0,
      totalPlatformFees: 0,
    };

    for (const escrow of escrowList.data) {
      escrowStats.byStatus[escrow.status] = (escrowStats.byStatus[escrow.status] || 0) + 1;
      escrowStats.totalFunded += Number(escrow.fundedAmount);
      escrowStats.totalReleased += Number(escrow.releasedAmount);
      escrowStats.totalRefunded += Number(escrow.refundedAmount);
      escrowStats.totalPlatformFees += Number(escrow.platformFeeCollected);
    }

    return this.responseService.sendSuccess('Escrow & payout stats', {
      escrow: escrowStats,
      payouts: payoutStats,
    });
  }
}
