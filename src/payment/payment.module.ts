import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import { EscrowAccount } from './entities/escrow-account.entity';
import { EscrowTransaction } from './entities/escrow-transaction.entity';
import { OrderMilestone } from './entities/order-milestone.entity';
import { PayoutRecord } from './entities/payout-record.entity';

// Services
import { EscrowService } from './services/escrow.service';
import { FlutterwaveService } from './services/flutterwave.service';
import { PayoutService } from './services/payout.service';
import { PaymentNotificationService } from './services/payment-notification.service';

// Controllers
import { PaymentController } from './controllers/payment.controller';
import { PublicPaymentController } from './controllers/public-payment.controller';
import { WebhookController } from './controllers/webhook.controller';

// External entities
import { Order } from '../order/entities/order.entity';
import { GlobalBuyer } from '../global-buyer/entities/global-buyer.entity';
import { Exporter } from '../exporter/entities/exporter.entity';
import { User } from '../user/entities/user.entity';

// External modules
import { MailModule } from '../mail/mail.module';

// Common
import { ResponseService } from '../common/services/response.service';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    TypeOrmModule.forFeature([
      EscrowAccount,
      EscrowTransaction,
      OrderMilestone,
      PayoutRecord,
      Order,
      GlobalBuyer,
      Exporter,
      User,
    ]),
  ],
  controllers: [PaymentController, PublicPaymentController, WebhookController],
  providers: [
    EscrowService,
    FlutterwaveService,
    PayoutService,
    PaymentNotificationService,
    ResponseService,
  ],
  exports: [
    EscrowService,
    FlutterwaveService,
    PayoutService,
    PaymentNotificationService,
  ],
})
export class PaymentModule {}
