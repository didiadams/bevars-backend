import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SourcingRequest } from './entities/sourcing-request.entity';

import { SourcingRequestRepository } from './repositories/sourcing-request.repository';
import { CommonModule } from '../common/common.module';
import { GlobalBuyerModule } from '../global-buyer/global-buyer.module';
import { SourcingRequestController } from './sourcing-request.controller';
import { SourcingRequestService } from './sourcing-request.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SourcingRequest]),
    CommonModule,
    GlobalBuyerModule,
  ],
  controllers: [SourcingRequestController],
  providers: [SourcingRequestService],
  exports: [SourcingRequestService],
})
export class SourcingRequestModule {}
