import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminGuard } from './guards/admin.guard';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';
import { ResponseService } from 'src/common/services/response.service';
import { DashboardController } from './controllers/dashboard.controller';
import { SourcingRequestModule } from '../sourcing-request/sourcing-request.module';
import { OfferModule } from '../offer/offer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UserModule,
    SourcingRequestModule,
    OfferModule,
  ],
  controllers: [DashboardController],
  providers: [AdminGuard, ResponseService],
  exports: [AdminGuard],
})
export class AdminModule {}
