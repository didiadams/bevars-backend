import { Injectable } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { GlobalBuyer } from '../entities/global-buyer.entity';

@Injectable()
export class GlobalBuyerRepository extends Repository<GlobalBuyer> {
  constructor(private dataSource: DataSource) {
    super(GlobalBuyer, dataSource.createEntityManager());
  }

  async findByUserId(userId: string): Promise<GlobalBuyer | null> {
    return this.findOne({
      where: { userId },
      relations: ['user', 'sourcingRequests'],
    });
  }

  async findByBusinessRegistration(businessRegistrationNumber: string): Promise<GlobalBuyer | null> {
    return this.findOne({
      where: { businessRegistrationNumber },
    });
  }

  async findPremiumBuyers(): Promise<GlobalBuyer[]> {
    return this.find({
      where: { isPremium: true, isActive: true },
      relations: ['user'],
      order: { totalValueOrdered: 'DESC' },
    });
  }

  async findByCategories(interestedCategories: string[]): Promise<GlobalBuyer[]> {
    return this.createQueryBuilder('buyer')
      .leftJoinAndSelect('buyer.user', 'user')
      .where('buyer.interestedCategories && :categories', { 
        categories: interestedCategories 
      })
      .getMany();
  }

  async findByCountry(country: string): Promise<GlobalBuyer[]> {
    return this.createQueryBuilder('buyer')
      .leftJoinAndSelect('buyer.user', 'user')
      .where(':country = ANY(buyer.operatingCountries)', { country })
      .getMany();
  }

  async getTopBuyers(limit: number = 10): Promise<GlobalBuyer[]> {
    return this.find({
      order: { totalValueOrdered: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  async getDashboardStats(globalBuyerId: string): Promise<any> {
    const result = await this.createQueryBuilder('buyer')
      .leftJoin('buyer.sourcingRequests', 'request')
      .leftJoin('request.offers', 'offer')
      .select([
        'COUNT(DISTINCT CASE WHEN request.status = \'active\' THEN request.id END) as activeSourcingRequests',
        'COUNT(DISTINCT offer.id) as totalOffers',
        'AVG(buyer.averageOrderValue) as averageOrderValue',
      ])
      .where('buyer.id = :id', { id: globalBuyerId })
      .getRawOne();

    return {
      activeSourcingRequests: parseInt(result.activeSourcingRequests) || 0,
      totalOffers: parseInt(result.totalOffers) || 0,
      averageOrderValue: parseFloat(result.averageOrderValue) || 0,
      preferredExporters: 0, // Would be calculated from a preferred exporters table
    };
  }

  async getSourcingRequests(globalBuyerId: string): Promise<any[]> {
    return this.createQueryBuilder('buyer')
      .leftJoinAndSelect('buyer.sourcingRequests', 'request')
      .leftJoinAndSelect('request.offers', 'offer')
      .where('buyer.id = :id', { id: globalBuyerId })
      .orderBy('request.createdAt', 'DESC')
      .getMany();
  }

  async getReceivedOffers(globalBuyerId: string): Promise<any[]> {
    // This would typically join with an offers table
    // For now, return empty array until offers module is implemented
    return [];
  }

  async getPreferredExporters(globalBuyerId: string): Promise<any[]> {
    // This would typically join with a preferred_exporters table
    // For now, return empty array until the relationship is implemented
    return [];
  }
}
