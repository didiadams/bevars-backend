import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exporter } from './entities/exporter.entity';
import { SourcingRequest } from '../sourcing-request/entities/sourcing-request.entity';
import { Offer } from '../offer/entities/offer.entity';
import { VerificationDocument } from '../common/entities/verification-document.entity';
import { VerificationRequirement } from '../common/entities/verification-requirement.entity';
import { ExporterService } from './exporter.service';
import { ExporterRepository } from './repositories/exporter.repository';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CommonModule } from '../common/common.module';
import { ExporterController } from './exporter.controller';
import { OfferModule } from '../offer/offer.module';

@Module({
  imports: [
  TypeOrmModule.forFeature([Exporter, SourcingRequest, Offer, VerificationDocument, VerificationRequirement]),
    CloudinaryModule,
    CommonModule,
    forwardRef(() => OfferModule),
  ],
  controllers: [ExporterController],
  providers: [ExporterService, ExporterRepository],
  exports: [ExporterService, ExporterRepository],
})
export class ExporterModule {}
