import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderRepository } from './repositories/order.repository';
import { Order } from './entities/order.entity';
import { OfferModule } from '../offer/offer.module';
import { ExporterModule } from '../exporter/exporter.module';
import { GlobalBuyerModule } from '../global-buyer/global-buyer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    forwardRef(() => OfferModule),
    forwardRef(() => ExporterModule),
    forwardRef(() => GlobalBuyerModule),
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderRepository],
  exports: [OrderService, OrderRepository],
})
export class OrderModule {}
