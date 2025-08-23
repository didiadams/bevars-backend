import { Injectable } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { SourcingRequest, RequestStatus } from '../entities/sourcing-request.entity';

@Injectable()
export class SourcingRequestRepository extends Repository<SourcingRequest> {
  constructor(private dataSource: DataSource) {
    super(SourcingRequest, dataSource.createEntityManager());
  }

  async findByGlobalBuyerId(globalBuyerId: string): Promise<SourcingRequest[]> {
    return this.find({
      where: { globalBuyerId },
      relations: ['globalBuyer', 'offers'],
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveRequests(): Promise<SourcingRequest[]> {
    return this.createQueryBuilder('request')
      .leftJoinAndSelect('request.globalBuyer', 'globalBuyer')
      .leftJoinAndSelect('request.offers', 'offers')
      .where('request.quotationDeadline > :now', { now: new Date() })
      .andWhere('request.status = :status', { status: RequestStatus.ACTIVE })
      .orderBy('request.createdAt', 'DESC')
      .getMany();
  }

  async findByCategory(productCategory: string): Promise<SourcingRequest[]> {
    return this.find({
      where: { productCategory },
      relations: ['globalBuyer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByBudgetRange(minBudget: number, maxBudget: number): Promise<SourcingRequest[]> {
    return this.createQueryBuilder('request')
      .leftJoinAndSelect('request.globalBuyer', 'globalBuyer')
      .where('request.budgetMin >= :minBudget', { minBudget })
      .andWhere('request.budgetMax <= :maxBudget', { maxBudget })
      .orderBy('request.createdAt', 'DESC')
      .getMany();
  }

  async findPublic(limit: number = 10): Promise<SourcingRequest[]> {
    return this.find({
      where: { isPublic: true, status: RequestStatus.ACTIVE },
      relations: ['globalBuyer'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async searchRequests(searchTerm: string): Promise<SourcingRequest[]> {
    return this.createQueryBuilder('request')
      .leftJoinAndSelect('request.globalBuyer', 'globalBuyer')
      .where('request.title ILIKE :search', { search: `%${searchTerm}%` })
      .orWhere('request.description ILIKE :search', { search: `%${searchTerm}%` })
      .orWhere('request.productCategory ILIKE :search', { search: `%${searchTerm}%` })
      .orderBy('request.createdAt', 'DESC')
      .getMany();
  }

  async getExpiringSoon(days: number = 7): Promise<SourcingRequest[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.createQueryBuilder('request')
      .leftJoinAndSelect('request.globalBuyer', 'globalBuyer')
      .where('request.quotationDeadline <= :futureDate', { futureDate })
      .andWhere('request.quotationDeadline > :now', { now: new Date() })
      .andWhere('request.status = :status', { status: RequestStatus.ACTIVE })
      .orderBy('request.quotationDeadline', 'ASC')
      .getMany();
  }
}
