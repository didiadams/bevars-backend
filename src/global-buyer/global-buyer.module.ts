import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalBuyer } from './entities/global-buyer.entity';

import { GlobalBuyerRepository } from './repositories/global-buyer.repository';
import { CommonModule } from '../common/common.module';
import { GlobalBuyerService } from './global-buyer.service';
import { GlobalBuyerController } from './global-buyer.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([GlobalBuyer]),
    CommonModule,
  ],
  controllers: [GlobalBuyerController],
  providers: [GlobalBuyerService, GlobalBuyerRepository],
  exports: [GlobalBuyerService, GlobalBuyerRepository],
})
export class GlobalBuyerModule {}
