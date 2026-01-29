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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EscrowService } from '../services/escrow.service';
import { PayoutService } from '../services/payout.service';
import { FlutterwaveService } from '../services/flutterwave.service';
import { ResponseService } from '../../common/services/response.service';
import { EscrowStatus } from '../entities/escrow-account.entity';
import { PayoutStatus } from '../entities/payout-record.entity';

@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(
    private escrowService: EscrowService,
    private payoutService: PayoutService,
    private flutterwaveService: FlutterwaveService,
    private responseService: ResponseService,
  ) {}

  /**
   * Get escrow account for an order
   */
  @Get('escrow/order/:orderId')
  async getEscrowByOrder(@Param('orderId') orderId: string, @Request() req: any) {
    const escrow = await this.escrowService.getByOrderId(orderId);
    
    if (!escrow) {
      return this.responseService.sendError('Escrow not found', HttpStatus.NOT_FOUND);
    }

    // Verify user has access (buyer or exporter)
    const userId = req.user.id;
    const userBuyerId = req.user.globalBuyer?.id;
    const userExporterId = req.user.exporter?.id;

    if (escrow.buyerId !== userBuyerId && escrow.exporterId !== userExporterId) {
      return this.responseService.sendError('Access denied', HttpStatus.FORBIDDEN);
    }

    return this.responseService.sendSuccess('Escrow retrieved', escrow);
  }

  /**
   * Get escrow milestones for an order
   */
  @Get('escrow/order/:orderId/milestones')
  async getMilestones(@Param('orderId') orderId: string) {
    const milestones = await this.escrowService.getMilestones(orderId);
    return this.responseService.sendSuccess('Milestones retrieved', milestones);
  }

  /**
   * Get escrow details by ID
   */
  @Get('escrow/:escrowId')
  async getEscrowDetails(@Param('escrowId') escrowId: string, @Request() req: any) {
    const escrow = await this.escrowService.getEscrowDetails(escrowId);

    // Verify user has access
    const userBuyerId = req.user.globalBuyer?.id;
    const userExporterId = req.user.exporter?.id;

    if (escrow.buyerId !== userBuyerId && escrow.exporterId !== userExporterId) {
      return this.responseService.sendError('Access denied', HttpStatus.FORBIDDEN);
    }

    return this.responseService.sendSuccess('Escrow details retrieved', escrow);
  }

  /**
   * Get virtual account payment instructions for buyer
   */
  @Get('escrow/:escrowId/payment-instructions')
  async getPaymentInstructions(@Param('escrowId') escrowId: string) {
    const escrow = await this.escrowService.getEscrowDetails(escrowId);

    const instructions = {
      escrowId: escrow.id,
      orderId: escrow.orderId,
      totalAmount: escrow.totalAmount,
      currency: escrow.currency,
      fundedAmount: escrow.fundedAmount,
      remainingAmount: Number(escrow.totalAmount) - Number(escrow.fundedAmount),
      status: escrow.status,
      virtualAccountNumber: escrow.virtualAccountNumber || null,
      virtualAccountBank: escrow.virtualAccountBank || null,
      accountName: 'Bevars Escrow',
      amount: Number(escrow.totalAmount) - Number(escrow.fundedAmount),
      reference: escrow.flutterwaveOrderRef || escrow.id,
      expiresAt: null,
      virtualAccount: escrow.virtualAccountNumber ? {
        accountNumber: escrow.virtualAccountNumber,
        bankName: escrow.virtualAccountBank,
        reference: escrow.flutterwaveOrderRef,
      } : null,
      instructions: escrow.virtualAccountNumber
        ? [
            `Log in to your bank account or mobile banking app`,
            `Select "Transfer" or "Wire Transfer"`,
            `Enter the account number: ${escrow.virtualAccountNumber}`,
            `Enter bank name: ${escrow.virtualAccountBank}`,
            `Enter amount: ${escrow.currency} ${Number(escrow.totalAmount) - Number(escrow.fundedAmount)}`,
            `Use payment reference: ${escrow.flutterwaveOrderRef || escrow.id}`,
            `Complete the transfer and save your receipt`,
          ]
        : [
            'Virtual account not yet available',
            'Please wait a few moments and refresh, or contact support for assistance',
          ],
    };

    return this.responseService.sendSuccess('Payment instructions', instructions);
  }

  /**
   * Initiate card payment for buyer
   * Creates a Flutterwave hosted checkout link for card/international payments
   */
  @Post('escrow/:escrowId/pay-with-card')
  async initiateCardPayment(@Param('escrowId') escrowId: string, @Request() req: any) {
    const escrow = await this.escrowService.getEscrowDetails(escrowId);

    // Verify buyer access
    const userBuyerId = req.user.globalBuyer?.id;
    if (escrow.buyerId !== userBuyerId) {
      return this.responseService.sendError('Only the buyer can initiate payment', HttpStatus.FORBIDDEN);
    }

    // Check if payment is already complete
    if (['funded', 'partially_released', 'released'].includes(escrow.status)) {
      return this.responseService.sendError('Escrow is already funded', HttpStatus.BAD_REQUEST);
    }

    const remainingAmount = Number(escrow.totalAmount) - Number(escrow.fundedAmount);
    
    if (remainingAmount <= 0) {
      return this.responseService.sendError('No payment required', HttpStatus.BAD_REQUEST);
    }

    // Get buyer info
    const buyer = req.user.globalBuyer;
    const frontendUrl = process.env.FRONTEND_URL || 'https://bevars.com';
    const redirectUrl = `${frontendUrl}/dashboard/global-buyer/order/${escrow.orderId}?payment_status=success`;

    try {
      const paymentLink = await this.flutterwaveService.createPaymentLink({
        txRef: `${escrow.flutterwaveOrderRef}-card-${Date.now()}`,
        amount: remainingAmount,
        currency: escrow.currency,
        redirectUrl,
        customerEmail: buyer.email || req.user.email,
        customerName: `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim() || 'Buyer',
        title: 'Bevars Escrow Payment',
        description: `Payment for Order #${escrow.orderId.slice(0, 8)}`,
        orderId: escrow.orderId,
      });

      return this.responseService.sendSuccess('Payment link created', {
        paymentUrl: paymentLink.data.link,
        amount: remainingAmount,
        currency: escrow.currency,
      });
    } catch (error) {
      return this.responseService.sendError(
        'Failed to create payment link. Please try bank transfer instead.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get payout history for exporter
   */
  @Get('payouts/my')
  async getMyPayouts(
    @Request() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: PayoutStatus,
  ) {
    const exporterId = req.user.exporter?.id;
    
    if (!exporterId) {
      return this.responseService.sendError('Exporter profile required', HttpStatus.FORBIDDEN);
    }

    const result = await this.payoutService.listPayouts(page, limit, {
      exporterId,
      status,
    });

    return this.responseService.sendSuccess('Payouts retrieved', result);
  }

  /**
   * Verify payment after redirect from Flutterwave
   * This is a backup in case webhook hasn't arrived yet
   */
  @Get('verify-redirect/:transactionId')
  async verifyPaymentRedirect(
    @Param('transactionId') transactionId: string,
    @Query('tx_ref') txRef: string,
  ) {
    try {
      // Verify with Flutterwave
      const verification = await this.flutterwaveService.verifyTransaction(transactionId);
      
      if (verification.data?.status !== 'successful') {
        return this.responseService.sendError('Payment not successful', HttpStatus.BAD_REQUEST);
      }

      // Extract orderId from tx_ref (format: BEV-ESC-{orderId-prefix}-{timestamp}-card-{timestamp})
      // e.g., BEV-ESC-cfa6dff8-1768834268425-card-1768835060687
      const txRefMatch = txRef.match(/BEV-ESC-([a-f0-9-]+)-/);
      if (!txRefMatch) {
        return this.responseService.sendError('Invalid transaction reference', HttpStatus.BAD_REQUEST);
      }

      // Find escrow by the flutterwave order ref pattern
      const escrow = await this.escrowService.findByTxRefPattern(txRef);
      if (!escrow) {
        return this.responseService.sendError('Escrow not found', HttpStatus.NOT_FOUND);
      }

      // Check if already funded
      if (['funded', 'partially_released', 'released'].includes(escrow.status)) {
        return this.responseService.sendSuccess('Payment already verified', {
          status: 'already_funded',
          escrow: {
            id: escrow.id,
            status: escrow.status,
            fundedAmount: escrow.fundedAmount,
            totalAmount: escrow.totalAmount,
          },
        });
      }

      // Record the deposit (in case webhook hasn't arrived yet)
      await this.escrowService.recordDeposit(
        escrow.id,
        verification.data.amount,
        verification.data.flw_ref,
        transactionId,
      );

      // Refresh escrow data
      const updatedEscrow = await this.escrowService.getEscrowDetails(escrow.id);

      return this.responseService.sendSuccess('Payment verified and recorded', {
        status: 'success',
        escrow: {
          id: updatedEscrow.id,
          status: updatedEscrow.status,
          fundedAmount: updatedEscrow.fundedAmount,
          totalAmount: updatedEscrow.totalAmount,
        },
      });
    } catch (error) {
      console.error('Payment verification failed:', error);
      return this.responseService.sendError('Payment verification failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
