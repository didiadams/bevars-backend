import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalBuyer } from './entities/global-buyer.entity';
import { BuyerVerificationDocument } from './entities/buyer-verification-document.entity';
import { Exporter } from '../exporter/entities/exporter.entity';
import { SourcingRequest } from '../sourcing-request/entities/sourcing-request.entity';
import { Offer } from '../offer/entities/offer.entity';
import { VerificationDocument } from '../common/entities/verification-document.entity';
import { VerificationRequirement } from '../common/entities/verification-requirement.entity';

import { GlobalBuyerRepository } from './repositories/global-buyer.repository';
import { CommonModule } from '../common/common.module';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { GlobalBuyerService } from './global-buyer.service';
import { GlobalBuyerController } from './global-buyer.controller';

@Module({
  imports: [
  TypeOrmModule.forFeature([GlobalBuyer, BuyerVerificationDocument, Exporter, SourcingRequest, Offer, VerificationDocument, VerificationRequirement]),
    CommonModule,
  ],
  controllers: [GlobalBuyerController],
  providers: [GlobalBuyerService, GlobalBuyerRepository, CloudinaryService],
  exports: [GlobalBuyerService, GlobalBuyerRepository],
})
export class GlobalBuyerModule {}
