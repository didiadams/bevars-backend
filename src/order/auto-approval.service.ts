import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderRepository } from './repositories/order.repository';
import { OrderStatus } from './entities/order.entity';

@Injectable()
export class AutoApprovalService {
  private readonly logger = new Logger(AutoApprovalService.name);
  // Auto-complete delay in days for delivered approvals
  private readonly AUTO_COMPLETE_DAYS = 7; // configurable
  // Dispute escalation delay days (matches default used when opening dispute)
  private readonly DISPUTE_ESCALATION_CHECK_DAYS = 1; // runs daily, checks all disputes

  constructor(private readonly orderRepository: OrderRepository) {}

  // Run daily to find delivered approvals older than threshold
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAutoComplete() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.AUTO_COMPLETE_DAYS);

    const pending = await this.orderRepository.find({
      where: { awaitingApprovalFor: OrderStatus.DELIVERED },
    });

    for (const o of pending) {
      if (!o.awaitingApprovalAt) continue;
      if (o.awaitingApprovalAt <= cutoff) {
        try {
          o.status = OrderStatus.COMPLETED;
          o.completedAt = new Date();
          o.awaitingApprovalFor = null;
          o.awaitingApprovalAt = null;
          await this.orderRepository.save(o);
          this.logger.log(`Auto-completed order ${o.id} after awaiting approval timeout`);
        } catch (err) {
          this.logger.error(`Failed to auto-complete order ${o.id}: ${err?.message || err}`);
        }
      }
    }
  }

  // Run daily to escalate disputes that passed disputeEscalationAt
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDisputeEscalation() {
    const now = new Date();
    const disputes = await this.orderRepository.find({ where: { status: OrderStatus.DISPUTED } });
    for (const o of disputes) {
      if (!o.disputeEscalationAt) continue;
      if (o.disputeEscalationAt <= now) {
        try {
          // For now we simply log and ensure mediator assignment is null so an admin UI can pick it up.
          this.logger.log(`Escalating dispute for order ${o.id} (escalationAt=${o.disputeEscalationAt})`);
          // Optionally set a field or send notification; here we just persist an updated timestamp
          o.notes = (o.notes || '') + `\n[escalated] at=${new Date().toISOString()}`;
          // Clear escalation time to avoid repeated escalations
          o.disputeEscalationAt = null;
          await this.orderRepository.save(o);
        } catch (err) {
          this.logger.error(`Failed to escalate dispute for order ${o.id}: ${err?.message || err}`);
        }
      }
    }
  }
}
