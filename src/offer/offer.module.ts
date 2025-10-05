import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Offer } from './entities/offer.entity';
import { NegotiationHistory } from './entities/negotiation-history.entity';
import { OfferController } from './offer.controller';

import { OfferRepository } from './repositories/offer.repository';
import { NegotiationHistoryRepository } from './repositories/negotiation-history.repository';
import { CommonModule } from '../common/common.module';
import { ExporterModule } from '../exporter/exporter.module';
import { SourcingRequestModule } from '../sourcing-request/sourcing-request.module';
import { GlobalBuyerModule } from '../global-buyer/global-buyer.module';
import { OrderModule } from '../order/order.module';
import { ChatModule } from '../chat/chat.module';
import { MailModule } from '../mail/mail.module';
import { UserModule } from '../user/user.module';
import { OfferService } from './offer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Offer, NegotiationHistory]),
    CommonModule,
    forwardRef(() => ExporterModule),
    forwardRef(() => SourcingRequestModule),
    forwardRef(() => GlobalBuyerModule),
    forwardRef(() => OrderModule),
    forwardRef(() => ChatModule),
    forwardRef(() => MailModule),
    forwardRef(() => UserModule),
  ],
  controllers: [OfferController],
  providers: [OfferService, OfferRepository, NegotiationHistoryRepository],
  exports: [OfferService, OfferRepository, NegotiationHistoryRepository],
})
export class OfferModule {}
