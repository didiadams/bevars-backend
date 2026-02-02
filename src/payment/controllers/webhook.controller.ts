import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { EscrowService } from '../services/escrow.service';
import { FlutterwaveService } from '../services/flutterwave.service';
import { PaymentNotificationService } from '../services/payment-notification.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EscrowAccount } from '../entities/escrow-account.entity';
import { Order, OrderStatus } from '../../order/entities/order.entity';

interface FlutterwaveWebhookPayload {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    status: string;
    payment_type: string;
    customer: {
      id: number;
      email: string;
      phone_number: string;
      name: string;
    };
    created_at: string;
  };
}

@Controller('api/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private escrowService: EscrowService,
    private flutterwaveService: FlutterwaveService,
    private paymentNotificationService: PaymentNotificationService,
    @InjectRepository(EscrowAccount)
    private escrowRepo: Repository<EscrowAccount>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
  ) {}

  /**
   * Handle Flutterwave webhook events
   */
  @Post('flutterwave')
  @HttpCode(HttpStatus.OK)
  async handleFlutterwaveWebhook(
    @Body() payload: FlutterwaveWebhookPayload,
    @Headers('verif-hash') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ status: string }> {
    this.logger.log(`Received Flutterwave webhook: ${payload.event}`);

    // Verify webhook signature
    const rawBody = req.rawBody?.toString() || JSON.stringify(payload);
    if (!this.flutterwaveService.verifyWebhookSignature(signature, rawBody)) {
      this.logger.warn('Invalid webhook signature');
      // Still return 200 to prevent retries, but log the issue
      return { status: 'invalid_signature' };
    }

    try {
      switch (payload.event) {
        case 'charge.completed':
          await this.handleChargeCompleted(payload);
          break;

        case 'transfer.completed':
          await this.handleTransferCompleted(payload);
          break;

        case 'transfer.failed':
          await this.handleTransferFailed(payload);
          break;

        default:
          this.logger.log(`Unhandled webhook event: ${payload.event}`);
      }

      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack);
      // Return success to prevent Flutterwave retries - we'll handle errors internally
      return { status: 'error_logged' };
    }
  }

  /**
   * Handle successful charge (buyer deposit)
   */
  private async handleChargeCompleted(payload: FlutterwaveWebhookPayload): Promise<void> {
    const { data } = payload;
    
    if (data.status !== 'successful') {
      this.logger.log(`Charge not successful: ${data.status}`);
      return;
    }

    // Find escrow by transaction reference
    // For card payments, tx_ref format is: BEV-ESC-{orderId}-{timestamp}-card-{timestamp}
    // For virtual account, tx_ref format is: BEV-ESC-{orderId}-{timestamp}
    const baseTxRef = data.tx_ref.replace(/-card-\d+$/, ''); // Remove -card-timestamp suffix if present
    
    let escrow = await this.escrowRepo.findOne({
      where: { flutterwaveOrderRef: data.tx_ref },
    });
    
    // If not found with full tx_ref, try with base ref (for card payments)
    if (!escrow) {
      escrow = await this.escrowRepo.findOne({
        where: { flutterwaveOrderRef: baseTxRef },
      });
    }

    if (!escrow) {
      this.logger.warn(`Escrow not found for tx_ref: ${data.tx_ref} (base: ${baseTxRef})`);
      return;
    }

    // Verify the transaction with Flutterwave
    try {
      const verification = await this.flutterwaveService.verifyTransaction(String(data.id));
      
      if (verification.data.status !== 'successful') {
        this.logger.warn(`Transaction verification failed: ${data.id}`);
        return;
      }

      // Record the deposit
      await this.escrowService.recordDeposit(
        escrow.id,
        data.amount,
        data.flw_ref,
        String(data.id),
      );

      // Get updated escrow with full funding status
      const updatedEscrow = await this.escrowService.getEscrowDetails(escrow.id);
      const isFullyFunded = Number(updatedEscrow.fundedAmount) >= Number(updatedEscrow.totalAmount);
      
      // 🔔 CRITICAL: Notify exporter that payment was received
      await this.paymentNotificationService.notifyPaymentReceived(updatedEscrow);
      
      if (isFullyFunded) {
        // Order can now be confirmed - exporter can start work
        await this.orderRepo.update(escrow.orderId, {
          status: OrderStatus.CONFIRMED,
          confirmedAt: new Date(),
        });
        
        // 🔔 Send "Order Ready to Start" notification
        await this.paymentNotificationService.notifyOrderReadyToStart(escrow.orderId);
        
        this.logger.log(`Order ${escrow.orderId} confirmed after full escrow funding`);
      }

    } catch (error) {
      this.logger.error(`Failed to process charge: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle successful transfer (payout to exporter)
   */
  private async handleTransferCompleted(payload: any): Promise<void> {
    // This would update payout status - implementation depends on payout reference tracking
    this.logger.log(`Transfer completed: ${payload.data?.id}`);
  }

  /**
   * Handle failed transfer
   */
  private async handleTransferFailed(payload: any): Promise<void> {
    this.logger.warn(`Transfer failed: ${payload.data?.id}`);
  }
}
