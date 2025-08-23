import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GlobalBuyerRepository } from './repositories/global-buyer.repository';
import { CreateGlobalBuyerDto } from './dto/create-global-buyer.dto';

import { GlobalBuyer } from './entities/global-buyer.entity';
import { UpdateGlobalBuyerDto } from './dto';

@Injectable()
export class GlobalBuyerService {
  constructor(
    private readonly globalBuyerRepository: GlobalBuyerRepository,
  ) {}

  async create(createDto: CreateGlobalBuyerDto & { userId: string }): Promise<GlobalBuyer> {
    const globalBuyer = this.globalBuyerRepository.create({
      ...createDto,
      userId: createDto.userId,
    });

    return this.globalBuyerRepository.save(globalBuyer as any as GlobalBuyer);
  }

  async findOne(id: string): Promise<GlobalBuyer> {
    const globalBuyer = await this.globalBuyerRepository.findOne({
      where: { id },
      relations: ['user', 'sourcingRequests'],
    });

    if (!globalBuyer) {
      throw new NotFoundException('Global buyer not found');
    }

    return globalBuyer;
  }

  async findByUserId(userId: string): Promise<GlobalBuyer> {
    const globalBuyer = await this.globalBuyerRepository.findByUserId(userId);

    if (!globalBuyer) {
      throw new NotFoundException('Global buyer profile not found');
    }

    return globalBuyer;
  }

  async updateByUserId(userId: string, updateDto: UpdateGlobalBuyerDto): Promise<GlobalBuyer> {
    const globalBuyer = await this.findByUserId(userId);
    
    Object.assign(globalBuyer, updateDto);
    return this.globalBuyerRepository.save(globalBuyer as any as GlobalBuyer);
  }

  async getDashboardStats(userId: string): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);

    const stats = await this.globalBuyerRepository.getDashboardStats(globalBuyer.id);

    return {
      activeSourcingRequests: stats.activeSourcingRequests || 0,
      totalOffers: stats.totalOffers || 0,
      completedOrders: globalBuyer.totalOrdersPlaced || 0,
      totalSpent: globalBuyer.totalValueOrdered || 0,
      averageOrderValue: stats.averageOrderValue || 0,
      preferredExporters: stats.preferredExporters || 0,
    };
  }

  async getMySourcingRequests(userId: string): Promise<any[]> {
    const globalBuyer = await this.findByUserId(userId);
    return this.globalBuyerRepository.getSourcingRequests(globalBuyer.id);
  }

  async getReceivedOffers(userId: string): Promise<any[]> {
    const globalBuyer = await this.findByUserId(userId);
    return this.globalBuyerRepository.getReceivedOffers(globalBuyer.id);
  }

  async acceptOffer(offerId: string, userId: string): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Logic to accept offer and create order
    // This would integrate with the offer service and order service
    return { message: 'Offer accepted successfully', offerId };
  }

  async rejectOffer(offerId: string, userId: string, reason?: string): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Logic to reject offer with reason
    return { message: 'Offer rejected', offerId, reason };
  }

  async negotiateOffer(offerId: string, userId: string, negotiationData: any): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Logic to create counter-offer or negotiate terms
    return { message: 'Negotiation sent', offerId, negotiationData };
  }

  async addToPreferred(userId: string, exporterId: string): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Note: The GlobalBuyer entity doesn't have preferredExporters field
    // This would need to be implemented with a separate PreferredExporter entity
    // For now, return a placeholder response
    return { message: 'Exporter added to preferred list' };
  }

  async removeFromPreferred(userId: string, exporterId: string): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Note: The GlobalBuyer entity doesn't have preferredExporters field
    // This would need to be implemented with a separate PreferredExporter entity
    // For now, return a placeholder response
    return { message: 'Exporter removed from preferred list' };
  }

  async getPreferredExporters(userId: string): Promise<any[]> {
    const globalBuyer = await this.findByUserId(userId);
    return this.globalBuyerRepository.getPreferredExporters(globalBuyer.id);
  }

  async updatePaymentInfo(userId: string, paymentInfo: any): Promise<GlobalBuyer> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Note: The GlobalBuyer entity doesn't have paymentMethods or billingAddress fields
    // These would need to be added to the entity or implemented in a separate PaymentInfo entity
    globalBuyer.preferredPaymentMethod = paymentInfo.preferredPaymentMethod;
    globalBuyer.creditLimit = paymentInfo.creditLimit;
    
    return this.globalBuyerRepository.save(globalBuyer as any as GlobalBuyer);
  }
}
