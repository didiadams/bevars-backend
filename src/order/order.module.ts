import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderRepository } from './repositories/order.repository';
import { OrderDocumentRepository } from './repositories/order-document.repository';
import { OrderReviewRepository } from './repositories/review.repository';
import { Order } from './entities/order.entity';
import { AutoApprovalService } from './auto-approval.service';
import { OrderAutomationService } from './services/order-automation.service';
import { OrderDocument } from './entities/order-document.entity';
import { OrderReview } from './entities/review.entity';
import { OfferModule } from '../offer/offer.module';
import { ExporterModule } from '../exporter/exporter.module';
import { GlobalBuyerModule } from '../global-buyer/global-buyer.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
  TypeOrmModule.forFeature([Order, OrderDocument, OrderReview]),
    forwardRef(() => OfferModule),
    forwardRef(() => ExporterModule),
    forwardRef(() => GlobalBuyerModule),
    forwardRef(() => MailModule),
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderRepository, OrderDocumentRepository, OrderReviewRepository, AutoApprovalService, OrderAutomationService],
  exports: [OrderService, OrderRepository, OrderDocumentRepository, OrderReviewRepository, AutoApprovalService, OrderAutomationService],
})
export class OrderModule {}
