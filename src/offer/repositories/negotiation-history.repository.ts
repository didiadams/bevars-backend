import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NegotiationHistory, NegotiationType, NegotiationStatus } from '../entities/negotiation-history.entity';

@Injectable()
export class NegotiationHistoryRepository {
  constructor(
    @InjectRepository(NegotiationHistory)
    private readonly repository: Repository<NegotiationHistory>,
  ) {}

  async create(data: Partial<NegotiationHistory>): Promise<NegotiationHistory> {
    const negotiation = this.repository.create(data);
    return this.repository.save(negotiation);
  }

  async findByOfferId(offerId: string): Promise<NegotiationHistory[]> {
    return this.repository.find({
      where: { offerId },
      order: { createdAt: 'ASC' },
    });
  }

  async findLatestByOfferId(offerId: string): Promise<NegotiationHistory | null> {
    return this.repository.findOne({
      where: { offerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findPendingNegotiation(offerId: string): Promise<NegotiationHistory | null> {
    return this.repository.findOne({
      where: { 
        offerId,
        status: NegotiationStatus.PENDING 
      },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: NegotiationStatus): Promise<void> {
    await this.repository.update(id, { status });
  }

  async markSuperseded(offerId: string, excludeId?: string): Promise<void> {
    const query = this.repository.createQueryBuilder()
      .update(NegotiationHistory)
      .set({ status: NegotiationStatus.SUPERSEDED })
      .where('offerId = :offerId', { offerId })
      .andWhere('status = :status', { status: NegotiationStatus.PENDING });

    if (excludeId) {
      query.andWhere('id != :excludeId', { excludeId });
    }

    await query.execute();
  }

  async getCurrentRound(offerId: string): Promise<number> {
    const latest = await this.repository.findOne({
      where: { offerId },
      order: { negotiationRound: 'DESC' },
    });
    
    return latest ? latest.negotiationRound : 0;
  }
}