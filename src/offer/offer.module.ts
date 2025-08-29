import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Offer } from './entities/offer.entity';
import { OfferController } from './offer.controller';

import { OfferRepository } from './repositories/offer.repository';
import { CommonModule } from '../common/common.module';
import { ExporterModule } from '../exporter/exporter.module';
import { SourcingRequestModule } from '../sourcing-request/sourcing-request.module';
import { OfferService } from './offer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Offer]),
    CommonModule,
    ExporterModule,
    forwardRef(() => SourcingRequestModule),
  ],
  controllers: [OfferController],
  providers: [OfferService, OfferRepository],
  exports: [OfferService, OfferRepository],
})
export class OfferModule {}
