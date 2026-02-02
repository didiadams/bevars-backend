import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminGuard } from '../guards/admin.guard';
import { ResponseService } from '../../common/services/response.service';
import { Offer, OfferStatus } from '../../offer/entities/offer.entity';
import { NegotiationHistory, NegotiationType, NegotiationStatus } from '../../offer/entities/negotiation-history.entity';

@Controller('admin/negotiations')
@UseGuards(AdminGuard)
export class AdminNegotiationController {
  constructor(
    @InjectRepository(Offer)
    private offerRepo: Repository<Offer>,
    @InjectRepository(NegotiationHistory)
    private negotiationHistoryRepo: Repository<NegotiationHistory>,
    private responseService: ResponseService,
  ) {}

  /**
   * Get all offers with negotiation status
   */
  @Get('offers')
  async getAllOffers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: OfferStatus,
    @Query('exporterId') exporterId?: string,
    @Query('hasNegotiation') hasNegotiation?: boolean,
  ) {
    const query = this.offerRepo.createQueryBuilder('offer')
      .leftJoinAndSelect('offer.exporter', 'exporter')
      .leftJoinAndSelect('exporter.user', 'exporterUser')
      .leftJoinAndSelect('offer.sourcingRequest', 'sourcingRequest')
      .leftJoinAndSelect('sourcingRequest.buyer', 'buyer')
      .leftJoinAndSelect('buyer.user', 'buyerUser');

    if (status) {
      query.andWhere('offer.status = :status', { status });
    }

    if (exporterId) {
      query.andWhere('offer.exporterId = :exporterId', { exporterId });
    }

    if (hasNegotiation !== undefined) {
      if (hasNegotiation) {
        query.andWhere('offer.status = :negStatus', { negStatus: OfferStatus.UNDER_NEGOTIATION });
      }
    }

    query.orderBy('offer.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [offers, total] = await query.getManyAndCount();

    return this.responseService.sendSuccess('Offers retrieved', {
      data: offers,
      total,
      page,
      limit,
    });
  }

  /**
   * Get offer details with full negotiation history
   */
  @Get('offers/:offerId')
  async getOfferDetails(@Param('offerId') offerId: string) {
    const offer = await this.offerRepo.findOne({
      where: { id: offerId },
      relations: [
        'exporter',
        'exporter.user',
        'sourcingRequest',
        'sourcingRequest.buyer',
        'sourcingRequest.buyer.user',
      ],
    });

    if (!offer) {
      return this.responseService.sendError('Offer not found', HttpStatus.NOT_FOUND);
    }

    // Get negotiation history
    const history = await this.negotiationHistoryRepo.find({
      where: { offerId },
      order: { createdAt: 'ASC' },
    });

    return this.responseService.sendSuccess('Offer details', {
      offer,
      negotiationHistory: history,
    });
  }

  /**
   * Get all active negotiations
   */
  @Get('active')
  async getActiveNegotiations(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const query = this.offerRepo.createQueryBuilder('offer')
      .where('offer.status = :status', { status: OfferStatus.UNDER_NEGOTIATION })
      .leftJoinAndSelect('offer.exporter', 'exporter')
      .leftJoinAndSelect('exporter.user', 'exporterUser')
      .leftJoinAndSelect('offer.sourcingRequest', 'sourcingRequest')
      .leftJoinAndSelect('sourcingRequest.buyer', 'buyer')
      .leftJoinAndSelect('buyer.user', 'buyerUser')
      .orderBy('offer.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [negotiations, total] = await query.getManyAndCount();

    // Get negotiation round count for each
    const withRounds = await Promise.all(
      negotiations.map(async (offer) => {
        const roundCount = await this.negotiationHistoryRepo.count({
          where: { offerId: offer.id },
        });
        return { ...offer, negotiationRounds: roundCount };
      }),
    );

    return this.responseService.sendSuccess('Active negotiations', {
      data: withRounds,
      total,
      page,
      limit,
    });
  }

  /**
   * Get stalled negotiations (no activity in 7+ days)
   */
  @Get('stalled')
  async getStalledNegotiations() {
    const stalled = await this.offerRepo.createQueryBuilder('offer')
      .where('offer.status = :status', { status: OfferStatus.UNDER_NEGOTIATION })
      .andWhere('offer.updatedAt < NOW() - INTERVAL \'7 days\'')
      .leftJoinAndSelect('offer.exporter', 'exporter')
      .leftJoinAndSelect('exporter.user', 'exporterUser')
      .leftJoinAndSelect('offer.sourcingRequest', 'sourcingRequest')
      .leftJoinAndSelect('sourcingRequest.buyer', 'buyer')
      .leftJoinAndSelect('buyer.user', 'buyerUser')
      .orderBy('offer.updatedAt', 'ASC')
      .getMany();

    return this.responseService.sendSuccess('Stalled negotiations', stalled);
  }

  /**
   * Admin force-close a negotiation
   */
  @Post('offers/:offerId/close')
  async closeNegotiation(
    @Param('offerId') offerId: string,
    @Body('status') status: 'accepted' | 'rejected' | 'withdrawn',
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const offer = await this.offerRepo.findOne({ where: { id: offerId } });

    if (!offer) {
      return this.responseService.sendError('Offer not found', HttpStatus.NOT_FOUND);
    }

    const statusMap = {
      accepted: OfferStatus.ACCEPTED,
      rejected: OfferStatus.REJECTED,
      withdrawn: OfferStatus.WITHDRAWN,
    };

    const previousStatus = offer.status;
    offer.status = statusMap[status] || OfferStatus.WITHDRAWN;

    await this.offerRepo.save(offer);

    // Log the action in negotiation history
    await this.negotiationHistoryRepo.save(
      this.negotiationHistoryRepo.create({
        offerId,
        initiatedBy: 'admin',
        type: NegotiationType.EXPORTER_REJECTION, // Admin closure treated as rejection
        proposedPricePerUnit: offer.pricePerUnit,
        proposedQuantity: offer.availableQuantity,
        notes: `Admin closed negotiation: ${reason}`,
        status: status === 'accepted' ? NegotiationStatus.ACCEPTED : NegotiationStatus.REJECTED,
      }),
    );

    return this.responseService.sendSuccess('Negotiation closed', {
      offerId,
      previousStatus,
      newStatus: offer.status,
    });
  }

  /**
   * Get negotiation statistics
   */
  @Get('stats/overview')
  async getNegotiationStats() {
    const totalOffers = await this.offerRepo.count();
    
    const byStatus = await this.offerRepo.createQueryBuilder('offer')
      .select('offer.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('offer.status')
      .getRawMany();

    const activeNegotiations = await this.offerRepo.count({
      where: { status: OfferStatus.UNDER_NEGOTIATION },
    });

    const acceptedOffers = await this.offerRepo.count({
      where: { status: OfferStatus.ACCEPTED },
    });

    // Average negotiation rounds for accepted offers
    const acceptedOfferIds = await this.offerRepo.find({
      where: { status: OfferStatus.ACCEPTED },
      select: ['id'],
    });

    let avgRounds = 0;
    if (acceptedOfferIds.length > 0) {
      const totalRounds = await this.negotiationHistoryRepo.createQueryBuilder('nh')
        .where('nh.offerId IN (:...ids)', { ids: acceptedOfferIds.map(o => o.id) })
        .getCount();
      avgRounds = totalRounds / acceptedOfferIds.length;
    }

    // Total value of accepted offers
    const totalValue = await this.offerRepo.createQueryBuilder('offer')
      .where('offer.status = :status', { status: OfferStatus.ACCEPTED })
      .select('SUM(offer.totalPrice)', 'total')
      .getRawOne();

    return this.responseService.sendSuccess('Negotiation stats', {
      totalOffers,
      activeNegotiations,
      acceptedOffers,
      avgNegotiationRounds: avgRounds.toFixed(2),
      totalAcceptedValue: totalValue?.total || 0,
      byStatus,
    });
  }

  /**
   * Get negotiation history for an offer
   */
  @Get('offers/:offerId/history')
  async getNegotiationHistory(@Param('offerId') offerId: string) {
    const history = await this.negotiationHistoryRepo.find({
      where: { offerId },
      order: { createdAt: 'ASC' },
    });

    return this.responseService.sendSuccess('Negotiation history', history);
  }
}
