import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order, OrderStatus } from '../../order/entities/order.entity';
import { SourcingRequest, RequestStatus } from '../../sourcing-request/entities/sourcing-request.entity';
import { Offer, OfferStatus } from '../../offer/entities/offer.entity';
import { Exporter } from '../../exporter/entities/exporter.entity';
import { GlobalBuyer } from '../../global-buyer/entities/global-buyer.entity';

export interface PlatformMetrics {
  orders: {
    total: number;
    byStatus: Record<OrderStatus, number>;
    totalValue: number;
    averageValue: number;
    completionRate: number;
    disputeRate: number;
  };
  sourcingRequests: {
    total: number;
    active: number;
    averageOffers: number;
    conversionRate: number;
  };
  users: {
    totalExporters: number;
    totalBuyers: number;
    activeExporters: number;
    activeBuyers: number;
  };
  performance: {
    averageApprovalTime: number; // hours
    averageDeliveryTime: number; // days
    averageNegotiationRounds: number;
  };
}

export interface ExporterMetrics {
  exporterId: string;
  orders: {
    total: number;
    completed: number;
    inProgress: number;
    disputed: number;
    totalRevenue: number;
  };
  offers: {
    submitted: number;
    accepted: number;
    conversionRate: number;
  };
  performance: {
    averageDeliveryTime: number;
    disputeRate: number;
    rating: number | null;
  };
}

export interface BuyerMetrics {
  buyerId: string;
  orders: {
    total: number;
    completed: number;
    inProgress: number;
    disputed: number;
    totalSpent: number;
  };
  sourcingRequests: {
    total: number;
    averageOffers: number;
    conversionRate: number;
  };
  performance: {
    averageApprovalTime: number;
    disputeRate: number;
  };
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(SourcingRequest)
    private readonly sourcingRequestRepo: Repository<SourcingRequest>,
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
    @InjectRepository(Exporter)
    private readonly exporterRepo: Repository<Exporter>,
    @InjectRepository(GlobalBuyer)
    private readonly buyerRepo: Repository<GlobalBuyer>,
  ) {}

  /**
   * Get platform-wide metrics
   */
  async getPlatformMetrics(startDate?: Date, endDate?: Date): Promise<PlatformMetrics> {
    const dateFilter = startDate && endDate ? Between(startDate, endDate) : undefined;

    // Order metrics
    const orders = await this.orderRepo.find({
      where: dateFilter ? { createdAt: dateFilter } : {},
      relations: ['offer'],
    });

    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<OrderStatus, number>);

    const totalValue = orders.reduce((sum, order) => sum + Number(order.offer?.totalPrice || 0), 0);
    const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED).length;
    const disputedOrders = orders.filter(o => o.status === OrderStatus.DISPUTED).length;

    // Sourcing request metrics
    const sourcingRequests = await this.sourcingRequestRepo.find({
      where: dateFilter ? { createdAt: dateFilter } : {},
      relations: ['offers'],
    });

    const activeSourcingRequests = sourcingRequests.filter(sr => sr.status === RequestStatus.ACTIVE).length;
    const averageOffers = sourcingRequests.length > 0
      ? sourcingRequests.reduce((sum, sr) => sum + (sr.offerCount || 0), 0) / sourcingRequests.length
      : 0;

    const requestsWithOrders = sourcingRequests.filter(sr => 
      sr.offers?.some(offer => offer.status === OfferStatus.ACCEPTED)
    ).length;

    // User metrics
    const totalExporters = await this.exporterRepo.count();
    const totalBuyers = await this.buyerRepo.count();
    
    const activeExporterIds = new Set(orders.map(o => o.exporterId));
    const activeBuyerIds = new Set(orders.map(o => o.globalBuyerId));

    // Performance metrics
    const ordersWithApprovalTime = orders.filter(o => o.awaitingApprovalAt && o.updatedAt);
    const averageApprovalTime = ordersWithApprovalTime.length > 0
      ? ordersWithApprovalTime.reduce((sum, o) => {
          const hours = (o.updatedAt.getTime() - o.awaitingApprovalAt!.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }, 0) / ordersWithApprovalTime.length
      : 0;

    const deliveredOrders = orders.filter(o => 
      o.status === OrderStatus.DELIVERED || o.status === OrderStatus.COMPLETED
    );
    const averageDeliveryTime = deliveredOrders.length > 0
      ? deliveredOrders.reduce((sum, o) => {
          const days = (o.updatedAt.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / deliveredOrders.length
      : 0;

    const offers = await this.offerRepo.find({
      where: dateFilter ? { createdAt: dateFilter } : {},
    });
    // Count counter offers to approximate negotiation rounds
    const counterOffers = offers.filter(o => o.isCounterOffer).length;
    const averageNegotiationRounds = offers.length > 0
      ? (1 + (counterOffers / offers.length)) // 1 initial offer + avg counter offers
      : 0;

    return {
      orders: {
        total: orders.length,
        byStatus: ordersByStatus,
        totalValue,
        averageValue: orders.length > 0 ? totalValue / orders.length : 0,
        completionRate: orders.length > 0 ? (completedOrders / orders.length) * 100 : 0,
        disputeRate: orders.length > 0 ? (disputedOrders / orders.length) * 100 : 0,
      },
      sourcingRequests: {
        total: sourcingRequests.length,
        active: activeSourcingRequests,
        averageOffers,
        conversionRate: sourcingRequests.length > 0 
          ? (requestsWithOrders / sourcingRequests.length) * 100 
          : 0,
      },
      users: {
        totalExporters,
        totalBuyers,
        activeExporters: activeExporterIds.size,
        activeBuyers: activeBuyerIds.size,
      },
      performance: {
        averageApprovalTime,
        averageDeliveryTime,
        averageNegotiationRounds,
      },
    };
  }

  /**
   * Get exporter-specific metrics
   */
  async getExporterMetrics(exporterId: string): Promise<ExporterMetrics> {
    const orders = await this.orderRepo.find({
      where: { exporterId },
      relations: ['offer'],
    });

    const offers = await this.offerRepo.find({
      where: { exporterId },
    });

    const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED);
    const inProgressOrders = orders.filter(o => 
      [OrderStatus.CONFIRMED, OrderStatus.IN_PRODUCTION, OrderStatus.READY_FOR_SHIPMENT, OrderStatus.SHIPPED].includes(o.status)
    );
    const disputedOrders = orders.filter(o => o.status === OrderStatus.DISPUTED);

    const totalRevenue = completedOrders.reduce((sum, order) => 
      sum + Number(order.offer?.totalPrice || 0), 0
    );

    const acceptedOffers = offers.filter(o => o.status === OfferStatus.ACCEPTED);

    const deliveredOrders = orders.filter(o => 
      o.status === OrderStatus.DELIVERED || o.status === OrderStatus.COMPLETED
    );
    const averageDeliveryTime = deliveredOrders.length > 0
      ? deliveredOrders.reduce((sum, o) => {
          const days = (o.updatedAt.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / deliveredOrders.length
      : 0;

    return {
      exporterId,
      orders: {
        total: orders.length,
        completed: completedOrders.length,
        inProgress: inProgressOrders.length,
        disputed: disputedOrders.length,
        totalRevenue,
      },
      offers: {
        submitted: offers.length,
        accepted: acceptedOffers.length,
        conversionRate: offers.length > 0 ? (acceptedOffers.length / offers.length) * 100 : 0,
      },
      performance: {
        averageDeliveryTime,
        disputeRate: orders.length > 0 ? (disputedOrders.length / orders.length) * 100 : 0,
        rating: null, // TODO: Implement rating system
      },
    };
  }

  /**
   * Get buyer-specific metrics
   */
  async getBuyerMetrics(buyerId: string): Promise<BuyerMetrics> {
    const orders = await this.orderRepo.find({
      where: { globalBuyerId: buyerId },
      relations: ['offer'],
    });

    const sourcingRequests = await this.sourcingRequestRepo.find({
      where: { globalBuyerId: buyerId },
      relations: ['offers'],
    });

    const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED);
    const inProgressOrders = orders.filter(o => 
      [OrderStatus.CONFIRMED, OrderStatus.IN_PRODUCTION, OrderStatus.READY_FOR_SHIPMENT, OrderStatus.SHIPPED].includes(o.status)
    );
    const disputedOrders = orders.filter(o => o.status === OrderStatus.DISPUTED);

    const totalSpent = completedOrders.reduce((sum, order) => 
      sum + Number(order.offer?.totalPrice || 0), 0
    );

    const averageOffers = sourcingRequests.length > 0
      ? sourcingRequests.reduce((sum, sr) => sum + (sr.offerCount || 0), 0) / sourcingRequests.length
      : 0;

    const requestsWithOrders = sourcingRequests.filter(sr => 
      sr.offers?.some(offer => offer.status === OfferStatus.ACCEPTED)
    ).length;

    const ordersWithApprovalTime = orders.filter(o => o.awaitingApprovalAt && o.updatedAt);
    const averageApprovalTime = ordersWithApprovalTime.length > 0
      ? ordersWithApprovalTime.reduce((sum, o) => {
          const hours = (o.updatedAt.getTime() - o.awaitingApprovalAt!.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }, 0) / ordersWithApprovalTime.length
      : 0;

    return {
      buyerId,
      orders: {
        total: orders.length,
        completed: completedOrders.length,
        inProgress: inProgressOrders.length,
        disputed: disputedOrders.length,
        totalSpent,
      },
      sourcingRequests: {
        total: sourcingRequests.length,
        averageOffers,
        conversionRate: sourcingRequests.length > 0 
          ? (requestsWithOrders / sourcingRequests.length) * 100 
          : 0,
      },
      performance: {
        averageApprovalTime,
        disputeRate: orders.length > 0 ? (disputedOrders.length / orders.length) * 100 : 0,
      },
    };
  }
}
