import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { AdminGuard } from './guards/admin.guard';
import { AdminUserService } from './services/admin-user.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminUserController } from './controllers/admin-user.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { AdminOrderController } from './controllers/admin-order.controller';
import { AdminDisputeController } from './controllers/admin-dispute.controller';
import { AdminEscrowController } from './controllers/admin-escrow.controller';
import { AdminNegotiationController } from './controllers/admin-negotiation.controller';

import { User } from '../user/entities/user.entity';
import { GlobalBuyer } from '../global-buyer/entities/global-buyer.entity';
import { Exporter } from '../exporter/entities/exporter.entity';
import { VerificationDocument } from '../common/entities/verification-document.entity';
import { EmailLog } from '../mail/entities/email-log.entity';
import { Order } from '../order/entities/order.entity';
import { OrderDocument } from '../order/entities/order-document.entity';
import { Offer } from '../offer/entities/offer.entity';
import { NegotiationHistory } from '../offer/entities/negotiation-history.entity';
import { EscrowAccount } from '../payment/entities/escrow-account.entity';
import { EscrowTransaction } from '../payment/entities/escrow-transaction.entity';
import { OrderMilestone } from '../payment/entities/order-milestone.entity';
import { PayoutRecord } from '../payment/entities/payout-record.entity';

import { UserModule } from '../user/user.module';
import { ResponseService } from 'src/common/services/response.service';
import { SourcingRequestModule } from '../sourcing-request/sourcing-request.module';
import { OfferModule } from '../offer/offer.module';
import { CustomConfigModule } from '../config/config.module';
import { CustomConfigService } from '../config/config.service';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      GlobalBuyer,
      Exporter,
      VerificationDocument,
      EmailLog,
      Order,
      OrderDocument,
      Offer,
      NegotiationHistory,
      EscrowAccount,
      EscrowTransaction,
      OrderMilestone,
      PayoutRecord,
    ]),
    JwtModule.registerAsync({
      imports: [CustomConfigModule],
      useFactory: async (configService: CustomConfigService) => ({
        secret: configService.jwtSecret,
        signOptions: { expiresIn: '7d' },
      }),
      inject: [CustomConfigService],
    }),
    UserModule,
    SourcingRequestModule,
    OfferModule,
    CustomConfigModule,
    forwardRef(() => PaymentModule),
  ],
  controllers: [
    DashboardController,
    AdminUserController,
    AdminAuditController,
    AdminOrderController,
    AdminDisputeController,
    AdminEscrowController,
    AdminNegotiationController,
  ],
  providers: [
    AdminGuard,
    AdminUserService,
    AdminAuditService,
    ResponseService,
  ],
  exports: [
    AdminGuard,
    AdminUserService,
    AdminAuditService,
  ],
})
export class AdminModule {}
