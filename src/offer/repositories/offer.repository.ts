import { Injectable } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { Offer, OfferStatus } from '../entities/offer.entity';

@Injectable()
export class OfferRepository extends Repository<Offer> {
  constructor(private dataSource: DataSource) {
    super(Offer, dataSource.createEntityManager());
  }

  async findBySourcingRequestId(sourcingRequestId: string): Promise<Offer[]> {
    return this.find({
      where: { sourcingRequestId },
      relations: ['exporter', 'exporter.user', 'sourcingRequest'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByExporterId(exporterId: string): Promise<Offer[]> {
    return this.find({
      where: { exporterId },
      relations: ['sourcingRequest', 'sourcingRequest.globalBuyer', 'sourcingRequest.globalBuyer.user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: OfferStatus): Promise<Offer[]> {
    return this.find({
      where: { status },
      relations: ['exporter', 'exporter.user', 'sourcingRequest', 'sourcingRequest.globalBuyer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findPendingOffers(): Promise<Offer[]> {
    return this.find({
      where: { status: OfferStatus.PENDING },
      relations: ['exporter', 'exporter.user', 'sourcingRequest', 'sourcingRequest.globalBuyer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAcceptedOffers(): Promise<Offer[]> {
    return this.find({
      where: { status: OfferStatus.ACCEPTED },
      relations: ['exporter', 'exporter.user', 'sourcingRequest', 'sourcingRequest.globalBuyer'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findExpiredOffers(): Promise<Offer[]> {
    const now = new Date();
    return this.createQueryBuilder('offer')
      .leftJoinAndSelect('offer.exporter', 'exporter')
      .leftJoinAndSelect('offer.sourcingRequest', 'sourcingRequest')
      .where('offer.validUntil < :now', { now })
      .andWhere('offer.status = :status', { status: OfferStatus.PENDING })
      .orderBy('offer.validUntil', 'ASC')
      .getMany();
  }

  async findByExporterAndRequest(exporterId: string, sourcingRequestId: string): Promise<Offer | null> {
    return this.findOne({
      where: { 
        exporterId, 
        sourcingRequestId,
        isCounterOffer: false // Find the original offer, not counter-offers
      },
      relations: ['exporter', 'sourcingRequest'],
    });
  }

  async getOfferStatistics(exporterId?: string): Promise<{
    totalOffers: number;
    pendingOffers: number;
    acceptedOffers: number;
    rejectedOffers: number;
    averageOfferValue: number;
  }> {
    const queryBuilder = this.createQueryBuilder('offer');

    if (exporterId) {
      queryBuilder.where('offer.exporterId = :exporterId', { exporterId });
    }

    const result = await queryBuilder
      .select([
        'COUNT(*) as totalOffers',
        'COUNT(CASE WHEN offer.status = \'pending\' THEN 1 END) as pendingOffers',
        'COUNT(CASE WHEN offer.status = \'accepted\' THEN 1 END) as acceptedOffers',
        'COUNT(CASE WHEN offer.status = \'rejected\' THEN 1 END) as rejectedOffers',
        'AVG(offer.totalPrice) as averageOfferValue',
      ])
      .getRawOne();

    return {
      totalOffers: parseInt(result.totalOffers) || 0,
      pendingOffers: parseInt(result.pendingOffers) || 0,
      acceptedOffers: parseInt(result.acceptedOffers) || 0,
      rejectedOffers: parseInt(result.rejectedOffers) || 0,
      averageOfferValue: parseFloat(result.averageOfferValue) || 0,
    };
  }

  async findRecentOffers(limit: number = 10): Promise<Offer[]> {
    return this.find({
      relations: ['exporter', 'exporter.user', 'sourcingRequest', 'sourcingRequest.globalBuyer'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findHighValueOffers(minValue: number): Promise<Offer[]> {
    return this.createQueryBuilder('offer')
      .leftJoinAndSelect('offer.exporter', 'exporter')
      .leftJoinAndSelect('offer.sourcingRequest', 'sourcingRequest')
      .where('offer.totalPrice >= :minValue', { minValue })
      .orderBy('offer.totalPrice', 'DESC')
      .getMany();
  }
}
