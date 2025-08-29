import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exporter } from './entities/exporter.entity';
import { SourcingRequest } from '../sourcing-request/entities/sourcing-request.entity';
import { Offer } from '../offer/entities/offer.entity';
import { ExporterService } from './exporter.service';
import { ExporterRepository } from './repositories/exporter.repository';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CommonModule } from '../common/common.module';
import { ExporterController } from './exporter.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Exporter, SourcingRequest, Offer]),
    CloudinaryModule,
    CommonModule,
  ],
  controllers: [ExporterController],
  providers: [ExporterService, ExporterRepository],
  exports: [ExporterService, ExporterRepository],
})
export class ExporterModule {}
