import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { OrderRepository } from './repositories/order.repository';
import { Order, OrderStatus, OrderType } from './entities/order.entity';
import { OfferService } from '../offer/offer.service';
import { Offer, OfferStatus } from '../offer/entities/offer.entity';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    @Inject(forwardRef(() => OfferService))
    private readonly offerService: OfferService,
  ) {}

  async createFromOffer(offer: Offer): Promise<Order> {
    // Verify offer is accepted
    if (offer.status !== OfferStatus.ACCEPTED) {
      throw new BadRequestException('Can only create order from accepted offers');
    }

    // Check if order already exists for this offer
    const existingOrder = await this.orderRepository.findOne({
      where: { offerId: offer.id },
    });

    if (existingOrder) {
      throw new BadRequestException('Order already exists for this offer');
    }

    const orderNumber = await this.orderRepository.generateOrderNumber();

    const order = this.orderRepository.create({
      offerId: offer.id,
      globalBuyerId: offer.sourcingRequest.globalBuyerId,
      exporterId: offer.exporterId,
      orderNumber,
      status: OrderStatus.PENDING,
      type: offer.isCounterOffer ? OrderType.NEGOTIATED_DEAL : OrderType.DIRECT_PURCHASE,
      totalAmount: offer.totalPrice,
      currency: offer.currency,
      quantity: offer.availableQuantity,
      unitPrice: offer.pricePerUnit,
      expectedDeliveryDate: offer.estimatedDeliveryDate,
      specialInstructions: offer.additionalNotes,
      confirmedAt: new Date(),
    });

    return this.orderRepository.save(order);
  }

  async create(createDto: {
    offerId: string;
    shippingAddress?: string;
    billingAddress?: string;
    specialInstructions?: string;
  }): Promise<Order> {
    const offer = await this.offerService.findOne(createDto.offerId);
    
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    // Check if order already exists for this offer
    const existingOrder = await this.orderRepository.findOne({
      where: { offerId: offer.id },
    });

    let order: Order;

    if (existingOrder) {
      // If order already exists, update it with the provided information
      order = existingOrder;
    } else {
      // Create new order if it doesn't exist
      order = await this.createFromOffer(offer);
    }

    // Update order with additional information if provided
    if (createDto.shippingAddress) {
      order.shippingAddress = createDto.shippingAddress;
    }
    if (createDto.billingAddress) {
      order.billingAddress = createDto.billingAddress;
    }
    if (createDto.specialInstructions) {
      order.specialInstructions = createDto.specialInstructions;
    }

    return this.orderRepository.save(order);
  }

  async findAll(filters?: {
    status?: OrderStatus;
    exporterId?: string;
    globalBuyerId?: string;
  }): Promise<Order[]> {
    if (filters?.exporterId) {
      return this.orderRepository.findByExporterId(filters.exporterId);
    }

    if (filters?.globalBuyerId) {
      return this.orderRepository.findByGlobalBuyerId(filters.globalBuyerId);
    }

    if (filters?.status) {
      return this.orderRepository.findByStatus(filters.status);
    }

    return this.orderRepository.find({
      relations: ['offer', 'globalBuyer', 'exporter'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findOne(id: string, userId?: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['offer', 'globalBuyer', 'globalBuyer.user', 'exporter', 'exporter.user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Optional access control check
    if (userId) {
      const hasAccess = 
        order.globalBuyer?.userId === userId || 
        order.exporter?.userId === userId;

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this order');
      }
    }

    return order;
  }

  async findByOfferId(offerId: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { offerId },
      relations: ['offer', 'globalBuyer', 'globalBuyer.user', 'exporter', 'exporter.user'],
    });
  }

  async findByOrderNumber(orderNumber: string): Promise<Order> {
    const order = await this.orderRepository.findByOrderNumber(orderNumber);
    
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(id: string, status: OrderStatus, userId: string): Promise<Order> {
    const order = await this.findOne(id, userId);

    // Validate status transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
      [OrderStatus.IN_PRODUCTION]: [OrderStatus.READY_FOR_SHIPMENT, OrderStatus.CANCELLED],
      [OrderStatus.READY_FOR_SHIPMENT]: [OrderStatus.SHIPPED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.DISPUTED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    };

    if (!validTransitions[order.status].includes(status)) {
      throw new BadRequestException(`Cannot transition from ${order.status} to ${status}`);
    }

    order.status = status;

    // Set timestamp fields based on status
    const now = new Date();
    switch (status) {
      case OrderStatus.CONFIRMED:
        order.confirmedAt = now;
        break;
      case OrderStatus.SHIPPED:
        order.shippedAt = now;
        break;
      case OrderStatus.DELIVERED:
        order.deliveredAt = now;
        break;
      case OrderStatus.COMPLETED:
        order.completedAt = now;
        break;
      case OrderStatus.CANCELLED:
        order.cancelledAt = now;
        break;
    }

    return this.orderRepository.save(order);
  }

  async cancel(id: string, userId: string, reason?: string): Promise<Order> {
    const order = await this.findOne(id, userId);

    if (![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
      throw new BadRequestException('Can only cancel pending or confirmed orders');
    }

    order.status = OrderStatus.CANCELLED;
    order.cancellationReason = reason;
    order.cancelledAt = new Date();

    return this.orderRepository.save(order);
  }

  async update(id: string, updateDto: {
    shippingAddress?: string;
    billingAddress?: string;
    specialInstructions?: string;
    expectedDeliveryDate?: Date;
    notes?: string;
  }, userId: string): Promise<Order> {
    const order = await this.findOne(id, userId);

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Can only update pending or confirmed orders');
    }

    Object.assign(order, updateDto);

    return this.orderRepository.save(order);
  }

  async getMyOrders(userId: string, isExporter = false): Promise<Order[]> {
    if (isExporter) {
      // Find exporter first, then get their orders
      const orders = await this.orderRepository.find({
        where: { exporter: { userId } },
        relations: ['offer', 'globalBuyer', 'globalBuyer.user'],
        order: { createdAt: 'DESC' },
      });
      return orders;
    } else {
      // Find global buyer first, then get their orders
      const orders = await this.orderRepository.find({
        where: { globalBuyer: { userId } },
        relations: ['offer', 'exporter', 'exporter.user'],
        order: { createdAt: 'DESC' },
      });
      return orders;
    }
  }

  async getOrderStatistics(userId: string, isExporter = false): Promise<any> {
    if (isExporter) {
      return this.orderRepository.getOrderStatistics(userId);
    } else {
      return this.orderRepository.getOrderStatistics(undefined, userId);
    }
  }
}
