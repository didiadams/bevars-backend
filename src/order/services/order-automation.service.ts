import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderService } from '../order.service';
import { OrderStatus } from '../entities/order.entity';
import { MailService } from '../../mail/mail-service.service';

@Injectable()
export class OrderAutomationService {
  private readonly logger = new Logger(OrderAutomationService.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Auto-approve orders after 48 hours if buyer hasn't responded
   * Runs every 6 hours
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async autoApproveStaleApprovals() {
    this.logger.log('Running auto-approval check for stale approvals...');
    
    try {
      const orders = await this.orderService.findAll({});
      const now = new Date();
      const AUTO_APPROVE_HOURS = 48;

      for (const order of orders) {
        // Only process orders awaiting approval
        if (!order.awaitingApprovalFor || !order.awaitingApprovalAt) continue;

        const hoursSinceRequest = (now.getTime() - order.awaitingApprovalAt.getTime()) / (1000 * 60 * 60);

        if (hoursSinceRequest >= AUTO_APPROVE_HOURS) {
          this.logger.log(`Auto-approving order ${order.orderNumber} after ${hoursSinceRequest.toFixed(1)} hours`);
          
          try {
            // Auto-approve as system
            await this.orderService.approvePendingApproval(order.id, order.globalBuyer.userId);
            
            // Notify both parties
            await this.mailService.sendEmail({
              email: order.globalBuyer.user.email,
              subject: `Order ${order.orderNumber} Auto-Approved`,
              html: `
                <h2>Order Auto-Approved</h2>
                <p>Your order <strong>${order.orderNumber}</strong> has been automatically approved.</p>
                <p><strong>Status:</strong> ${order.awaitingApprovalFor}</p>
                <p><strong>Reason:</strong> No response after ${AUTO_APPROVE_HOURS} hours</p>
                <p>The exporter can now proceed to the next stage.</p>
              `,
            });

            await this.mailService.sendEmail({
              email: order.exporter.user.email,
              subject: `Order ${order.orderNumber} Approved`,
              html: `
                <h2>Order Approved</h2>
                <p>Order <strong>${order.orderNumber}</strong> has been approved by the system.</p>
                <p>You can now proceed to the next stage.</p>
              `,
            });
          } catch (error) {
            this.logger.error(`Failed to auto-approve order ${order.orderNumber}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Auto-approval job failed:', error);
    }
  }

  /**
   * Remind buyers about pending approvals after 24 hours
   * Runs every 4 hours
   */
  @Cron(CronExpression.EVERY_4_HOURS)
  async sendApprovalReminders() {
    this.logger.log('Sending approval reminders...');
    
    try {
      const orders = await this.orderService.findAll({});
      const now = new Date();
      const REMINDER_HOURS = 24;

      for (const order of orders) {
        if (!order.awaitingApprovalFor || !order.awaitingApprovalAt) continue;

        const hoursSinceRequest = (now.getTime() - order.awaitingApprovalAt.getTime()) / (1000 * 60 * 60);

        // Send reminder at 24 hours (before 48-hour auto-approval)
        if (hoursSinceRequest >= REMINDER_HOURS && hoursSinceRequest < REMINDER_HOURS + 4) {
          this.logger.log(`Sending reminder for order ${order.orderNumber}`);
          
          try {
            await this.mailService.sendEmail({
              email: order.globalBuyer.user.email,
              subject: `⏰ Pending Approval: Order ${order.orderNumber}`,
              html: `
                <h2>Approval Reminder</h2>
                <p>Your order <strong>${order.orderNumber}</strong> from <strong>${order.exporter.user.companyName}</strong> is awaiting your approval.</p>
                <p><strong>Status:</strong> ${order.awaitingApprovalFor}</p>
                <p><strong>Time Remaining:</strong> ${(48 - hoursSinceRequest).toFixed(0)} hours before auto-approval</p>
                <p>Please review and approve to avoid automatic approval.</p>
              `,
            });
          } catch (error) {
            this.logger.error(`Failed to send reminder for order ${order.orderNumber}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Approval reminder job failed:', error);
    }
  }

  /**
   * Auto-escalate disputes to mediation after 7 days
   * Runs daily at 2 AM
   */
  @Cron('0 2 * * *')
  async autoEscalateDisputes() {
    this.logger.log('Checking for disputes to escalate...');
    
    try {
      const orders = await this.orderService.findAll({ status: OrderStatus.DISPUTED });
      const now = new Date();

      for (const order of orders) {
        if (!order.disputeEscalationAt) continue;

        // Escalate if past escalation date
        if (now >= order.disputeEscalationAt && !order.mediationAssignedTo) {
          this.logger.log(`Auto-escalating dispute for order ${order.orderNumber}`);
          
          try {
            // TODO: Assign to available mediator (for now, just flag it)
            order.notes = (order.notes || '') + `\n[auto_escalated] at=${now.toISOString()} reason=escalation_deadline_passed`;
            
            // Notify admin/mediation team
            await this.mailService.sendEmail({
              email: process.env.ADMIN_EMAIL || 'admin@bevars.com',
              subject: `🚨 Dispute Escalation: Order ${order.orderNumber}`,
              html: `
                <h2>Dispute Escalation Alert</h2>
                <p>Order <strong>${order.orderNumber}</strong> dispute requires mediation assignment.</p>
                <p><strong>Buyer:</strong> ${order.globalBuyer.user.companyName}</p>
                <p><strong>Exporter:</strong> ${order.exporter.user.companyName}</p>
                <p><strong>Dispute Age:</strong> ${Math.floor((now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days</p>
                <p>Please assign a mediator to resolve this issue.</p>
              `,
            });
          } catch (error) {
            this.logger.error(`Failed to escalate dispute for order ${order.orderNumber}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Dispute escalation job failed:', error);
    }
  }

  /**
   * Send delivery confirmation reminders
   * Runs daily at 10 AM
   */
  @Cron('0 10 * * *')
  async sendDeliveryReminders() {
    this.logger.log('Checking for unconfirmed deliveries...');
    
    try {
      const orders = await this.orderService.findAll({ status: OrderStatus.SHIPPED });
      const now = new Date();

      for (const order of orders) {
        if (!order.expectedDeliveryDate) continue;

        const deliveryDate = new Date(order.expectedDeliveryDate);
        const daysSinceExpected = (now.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24);

        // Remind buyer if delivery date passed and no confirmation
        if (daysSinceExpected >= 0 && daysSinceExpected <= 1) {
          this.logger.log(`Sending delivery reminder for order ${order.orderNumber}`);
          
          try {
            await this.mailService.sendEmail({
              email: order.globalBuyer.user.email,
              subject: `📦 Delivery Confirmation: Order ${order.orderNumber}`,
              html: `
                <h2>Delivery Confirmation Reminder</h2>
                <p>Order <strong>${order.orderNumber}</strong> from <strong>${order.exporter.user.companyName}</strong> should have been delivered.</p>
                <p><strong>Expected Delivery:</strong> ${deliveryDate.toLocaleDateString()}</p>
                <p>Please confirm receipt to complete the order.</p>
              `,
            });
          } catch (error) {
            this.logger.error(`Failed to send delivery reminder for order ${order.orderNumber}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Delivery reminder job failed:', error);
    }
  }
}
