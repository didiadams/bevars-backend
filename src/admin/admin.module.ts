import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminGuard } from './guards/admin.guard';
import { AdminUserService } from './services/admin-user.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminUserController } from './controllers/admin-user.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { DashboardController } from './controllers/dashboard.controller';

import { User } from '../user/entities/user.entity';
import { GlobalBuyer } from '../global-buyer/entities/global-buyer.entity';
import { Exporter } from '../exporter/entities/exporter.entity';
import { BuyerVerificationDocument } from '../global-buyer/entities/buyer-verification-document.entity';
import { EmailLog } from '../mail/entities/email-log.entity';

import { UserModule } from '../user/user.module';
import { ResponseService } from 'src/common/services/response.service';
import { SourcingRequestModule } from '../sourcing-request/sourcing-request.module';
import { OfferModule } from '../offer/offer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      GlobalBuyer,
      Exporter,
      BuyerVerificationDocument,
      EmailLog,
    ]),
    UserModule,
    SourcingRequestModule,
    OfferModule,
  ],
  controllers: [
    DashboardController,
    AdminUserController,
    AdminAuditController,
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
