import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../../mail/mail-service.service';
import { Order } from '../../order/entities/order.entity';
import { EscrowAccount } from '../entities/escrow-account.entity';
import { Exporter } from '../../exporter/entities/exporter.entity';
import { GlobalBuyer } from '../../global-buyer/entities/global-buyer.entity';
import { User } from '../../user/entities/user.entity';

interface PaymentReceivedData {
  orderId: string;
  escrowId: string;
  amountReceived: number;
  totalAmount: number;
  currency: string;
  buyerName: string;
  exporterName: string;
  cropName: string;
  quantity: number;
  isFullyFunded: boolean;
}

interface MilestoneReleasedData {
  orderId: string;
  escrowId: string;
  milestoneName: string;
  releaseAmount: number;
  currency: string;
  remainingBalance: number;
  exporterName: string;
}

interface PayoutSentData {
  orderId: string;
  payoutId: string;
  amountNGN: number;
  amountUSD: number;
  exchangeRate: number;
  bankName: string;
  accountNumber: string;
  exporterName: string;
}

@Injectable()
export class PaymentNotificationService {
  private readonly logger = new Logger(PaymentNotificationService.name);

  constructor(
    private mailService: MailService,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Exporter)
    private exporterRepo: Repository<Exporter>,
    @InjectRepository(GlobalBuyer)
    private buyerRepo: Repository<GlobalBuyer>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  /**
   * Notify exporter when buyer payment is received in escrow
   */
  async notifyPaymentReceived(escrow: EscrowAccount): Promise<void> {
    try {
      // Get order details with offer and sourcing request
      const order = await this.orderRepo.findOne({
        where: { id: escrow.orderId },
        relations: ['offer', 'offer.sourcingRequest'],
      });

      if (!order) {
        this.logger.warn(`Order not found for escrow ${escrow.id}`);
        return;
      }

      // Get exporter and buyer details
      const exporter = await this.exporterRepo.findOne({
        where: { id: escrow.exporterId },
      });

      const buyer = await this.buyerRepo.findOne({
        where: { id: escrow.buyerId },
      });

      if (!exporter || !buyer) {
        this.logger.warn(`Exporter or buyer not found for escrow ${escrow.id}`);
        return;
      }

      // Get user emails
      const exporterUser = await this.userRepo.findOne({
        where: { id: exporter.userId },
      });

      const buyerUser = await this.userRepo.findOne({
        where: { id: buyer.userId },
      });

      const isFullyFunded = Number(escrow.fundedAmount) >= Number(escrow.totalAmount);
      // Product name comes from the sourcing request
      const productName = order.offer?.sourcingRequest?.productName || 'Agricultural Product';

      // Send email to exporter
      if (exporterUser?.email) {
        await this.sendPaymentReceivedToExporter({
          email: exporterUser.email,
          exporterName: exporterUser.companyName || exporterUser.firstName,
          buyerName: buyerUser?.companyName || buyerUser?.firstName || 'Buyer',
          orderId: order.id,
          amountReceived: Number(escrow.fundedAmount),
          totalAmount: Number(escrow.totalAmount),
          currency: escrow.currency,
          cropName: productName,
          quantity: order.quantity,
          isFullyFunded,
        });
      }

      // Send confirmation to buyer
      if (buyerUser?.email) {
        await this.sendPaymentConfirmationToBuyer({
          email: buyerUser.email,
          buyerName: buyerUser.companyName || buyerUser.firstName,
          orderId: order.id,
          amountPaid: Number(escrow.fundedAmount),
          totalAmount: Number(escrow.totalAmount),
          currency: escrow.currency,
          cropName: productName,
          isFullyFunded,
        });
      }

      this.logger.log(`Payment notifications sent for escrow ${escrow.id}`);
    } catch (error) {
      this.logger.error(`Failed to send payment notification: ${error.message}`);
    }
  }

  /**
   * Notify exporter when milestone is released (funds on the way)
   */
  async notifyMilestoneReleased(data: MilestoneReleasedData, exporterEmail: string): Promise<void> {
    try {
      await this.mailService.sendEmail({
        email: exporterEmail,
        subject: `🎉 Payment Released - ${data.milestoneName} Milestone`,
        html: this.generateMilestoneReleasedEmail(data),
        metadata: {
          type: 'milestone-released',
          orderId: data.orderId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send milestone released notification: ${error.message}`);
    }
  }

  /**
   * Notify exporter when payout is sent to their bank
   */
  async notifyPayoutSent(data: PayoutSentData, exporterEmail: string): Promise<void> {
    try {
      await this.mailService.sendEmail({
        email: exporterEmail,
        subject: `💰 Payout Sent - ₦${data.amountNGN.toLocaleString()} on the way!`,
        html: this.generatePayoutSentEmail(data),
        metadata: {
          type: 'payout-sent',
          orderId: data.orderId,
          payoutId: data.payoutId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send payout notification: ${error.message}`);
    }
  }

  /**
   * Notify exporter when order is ready to start (fully funded)
   */
  async notifyOrderReadyToStart(orderId: string): Promise<void> {
    try {
      const order = await this.orderRepo.findOne({
        where: { id: orderId },
        relations: ['offer', 'offer.sourcingRequest'],
      });

      if (!order) return;

      const exporter = await this.exporterRepo.findOne({
        where: { id: order.exporterId },
      });

      if (!exporter) return;

      const exporterUser = await this.userRepo.findOne({
        where: { id: exporter.userId },
      });

      if (!exporterUser?.email) return;

      const productName = order.offer?.sourcingRequest?.productName || 'Agricultural Product';

      await this.mailService.sendEmail({
        email: exporterUser.email,
        subject: `✅ Order Confirmed - Ready to Start Production!`,
        html: this.generateOrderReadyEmail({
          orderId: order.id,
          exporterName: exporterUser.companyName || exporterUser.firstName,
          cropName: productName,
          quantity: order.quantity,
          totalAmount: Number(order.totalAmount),
          currency: order.currency || 'USD',
        }),
        metadata: {
          type: 'order-ready',
          orderId,
        },
      });

      this.logger.log(`Order ready notification sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to send order ready notification: ${error.message}`);
    }
  }

  // ============ Email Templates ============

  private async sendPaymentReceivedToExporter(data: {
    email: string;
    exporterName: string;
    buyerName: string;
    orderId: string;
    amountReceived: number;
    totalAmount: number;
    currency: string;
    cropName: string;
    quantity: number;
    isFullyFunded: boolean;
  }): Promise<void> {
    const statusMessage = data.isFullyFunded
      ? `<p style="color: #16a34a; font-weight: bold;">✅ ESCROW FULLY FUNDED - You can now start production!</p>`
      : `<p style="color: #f59e0b;">Partial payment received. Awaiting remaining ${data.currency} ${(data.totalAmount - data.amountReceived).toFixed(2)}</p>`;

    await this.mailService.sendEmail({
      email: data.email,
      subject: data.isFullyFunded 
        ? `🎉 Payment Received - Order ${data.orderId.slice(0, 8)} is Ready!`
        : `💵 Payment Received for Order ${data.orderId.slice(0, 8)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">💰 Payment Received!</h1>
            </div>
            
            <div style="padding: 30px;">
              <p style="font-size: 16px; color: #333;">Hi ${data.exporterName},</p>
              
              <p style="font-size: 16px; color: #333;">Great news! A payment has been received for your order.</p>
              
              ${statusMessage}
              
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #15803d;">Order Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Order ID:</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.orderId.slice(0, 8).toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Product:</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.cropName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Quantity:</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.quantity.toLocaleString()} MT</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Buyer:</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.buyerName}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #334155;">Payment Summary</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Amount Received:</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #16a34a;">${data.currency} ${data.amountReceived.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Total Order Value:</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.currency} ${data.totalAmount.toLocaleString()}</td>
                  </tr>
                </table>
              </div>
              
              ${data.isFullyFunded ? `
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || 'https://bevars.com'}/dashboard/exporter/order/${data.orderId}" 
                   style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  View Order & Start Production
                </a>
              </div>
              ` : ''}
              
              <p style="color: #666; margin-top: 30px; font-size: 14px;">
                <strong>Next Steps:</strong><br>
                ${data.isFullyFunded 
                  ? '1. Begin production for this order<br>2. Upload production updates regularly<br>3. Prepare shipping documentation'
                  : 'Wait for the full payment to be received before starting production.'}
              </p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                This is an automated message from Bevars.<br>
                Questions? Contact support@bevars.com
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      metadata: {
        type: 'payment-received-exporter',
        orderId: data.orderId,
      },
    });
  }

  private async sendPaymentConfirmationToBuyer(data: {
    email: string;
    buyerName: string;
    orderId: string;
    amountPaid: number;
    totalAmount: number;
    currency: string;
    cropName: string;
    isFullyFunded: boolean;
  }): Promise<void> {
    await this.mailService.sendEmail({
      email: data.email,
      subject: `✅ Payment Confirmed - Order ${data.orderId.slice(0, 8)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">✅ Payment Confirmed</h1>
            </div>
            
            <div style="padding: 30px;">
              <p style="font-size: 16px; color: #333;">Hi ${data.buyerName},</p>
              
              <p style="font-size: 16px; color: #333;">Your payment has been received and secured in escrow.</p>
              
              <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1d4ed8;">Payment Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Order ID:</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.orderId.slice(0, 8).toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Product:</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.cropName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Amount Paid:</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #16a34a;">${data.currency} ${data.amountPaid.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Status:</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">
                      ${data.isFullyFunded ? '🟢 Fully Funded' : '🟡 Partially Funded'}
                    </td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #15803d;">
                  <strong>🔒 Escrow Protection</strong><br>
                  Your funds are held securely and will only be released to the exporter when shipment milestones are met.
                </p>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                <strong>What happens next:</strong><br>
                1. Exporter begins production<br>
                2. 70% released when goods are shipped (Bill of Lading uploaded)<br>
                3. 30% released upon delivery confirmation
              </p>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || 'https://bevars.com'}/dashboard/global-buyer/order/${data.orderId}" 
                   style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Track Your Order
                </a>
              </div>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                Bevars - Connecting African Exporters to Global Buyers
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      metadata: {
        type: 'payment-confirmed-buyer',
        orderId: data.orderId,
      },
    });
  }

  private generateMilestoneReleasedEmail(data: MilestoneReleasedData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Payment Released!</h1>
          </div>
          
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #333;">Hi ${data.exporterName},</p>
            
            <p style="font-size: 16px; color: #333;">Great news! A milestone payment has been released for your order.</p>
            
            <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="color: #666; margin: 0;">Milestone</p>
              <h2 style="color: #15803d; margin: 10px 0;">${data.milestoneName}</h2>
              <p style="color: #666; margin: 0;">Released Amount</p>
              <h1 style="color: #16a34a; margin: 10px 0; font-size: 36px;">${data.currency} ${data.releaseAmount.toLocaleString()}</h1>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center;">
              Remaining escrow balance: ${data.currency} ${data.remainingBalance.toLocaleString()}
            </p>
            
            <p style="color: #666; font-size: 14px;">
              The funds will be converted to NGN and sent to your registered bank account shortly.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePayoutSentEmail(data: PayoutSentData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">💸 Payout Sent!</h1>
          </div>
          
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #333;">Hi ${data.exporterName},</p>
            
            <p style="font-size: 16px; color: #333;">Your payment has been sent to your bank account!</p>
            
            <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="color: #666; margin: 0;">Amount Sent</p>
              <h1 style="color: #16a34a; margin: 10px 0; font-size: 42px;">₦${data.amountNGN.toLocaleString()}</h1>
              <p style="color: #666; margin: 0; font-size: 14px;">
                (USD ${data.amountUSD.toLocaleString()} @ ₦${data.exchangeRate.toFixed(2)}/USD)
              </p>
            </div>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #334155;">Bank Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Bank:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.bankName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Account:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right;">****${data.accountNumber.slice(-4)}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Funds typically arrive within 1-24 hours depending on your bank.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateOrderReadyEmail(data: {
    orderId: string;
    exporterName: string;
    cropName: string;
    quantity: number;
    totalAmount: number;
    currency: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚀 Order Ready to Start!</h1>
          </div>
          
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #333;">Hi ${data.exporterName},</p>
            
            <p style="font-size: 16px; color: #333;">
              <strong>Congratulations!</strong> The buyer has fully funded the escrow. 
              You can now begin production with confidence - your payment is secured!
            </p>
            
            <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #15803d;">Order Summary</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Order ID:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.orderId.slice(0, 8).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Product:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.cropName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Quantity:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.quantity.toLocaleString()} MT</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Total Value:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #16a34a;">${data.currency} ${data.totalAmount.toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;">
                <strong>💡 Payment Schedule</strong><br>
                • 70% released when you upload Bill of Lading<br>
                • 30% released upon buyer's delivery confirmation
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'https://bevars.com'}/dashboard/exporter/order/${data.orderId}" 
                 style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Start Production
              </a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
