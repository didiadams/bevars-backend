import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { OfferRepository } from './repositories/offer.repository';
import { Offer, OfferStatus } from './entities/offer.entity';
import { SourcingRequestService } from '../sourcing-request/sourcing-request.service';
import { OrderService } from '../order/order.service';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class OfferService {
  constructor(
    private readonly offerRepository: OfferRepository,
    @Inject(forwardRef(() => SourcingRequestService))
    private readonly sourcingRequestService: SourcingRequestService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  async create(createDto: any & { exporterId: string }): Promise<Offer> {
    // Check if exporter already has an offer for this sourcing request
    const existingOffer = await this.offerRepository.findByExporterAndRequest(
      createDto.exporterId,
      createDto.sourcingRequestId
    );

    if (existingOffer) {
      throw new BadRequestException('You have already submitted an offer for this sourcing request');
    }

    const offer = this.offerRepository.create({
      ...createDto,
      status: OfferStatus.PENDING,
      totalPrice: createDto.pricePerUnit * createDto.availableQuantity,
    });

    const savedOffer = await this.offerRepository.save(offer) as any as Offer;
    
    // Increment the offer count in the sourcing request
    await this.sourcingRequestService.incrementOfferCount(createDto.sourcingRequestId);
    
    return savedOffer;
  }

  async findAll(filters?: {
    status?: OfferStatus;
    exporterId?: string;
    sourcingRequestId?: string;
  }): Promise<Offer[]> {
    if (filters?.exporterId) {
      return this.offerRepository.findByExporterId(filters.exporterId);
    }

    if (filters?.sourcingRequestId) {
      return this.offerRepository.findBySourcingRequestId(filters.sourcingRequestId);
    }

    if (filters?.status) {
      return this.offerRepository.findByStatus(filters.status);
    }

    return this.offerRepository.findRecentOffers(50);
  }

  async findOne(id: string, userId?: string): Promise<Offer> {
    const offer = await this.offerRepository.findOne({
      where: { id },
      relations: ['exporter', 'exporter.user', 'sourcingRequest', 'sourcingRequest.globalBuyer', 'sourcingRequest.globalBuyer.user'],
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    // Optional access control check
    if (userId) {
      const hasAccess = 
        offer.exporter?.userId === userId || 
        offer.sourcingRequest.globalBuyerId === userId;

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this offer');
      }
    }

    return offer;
  }

  async update(id: string, updateDto: any, exporterId: string): Promise<Offer> {
    const offer = await this.findOne(id);

    // Check if the exporter owns this offer
    if (offer.exporterId !== exporterId) {
      throw new ForbiddenException('You can only update your own offers');
    }

    // Check if offer is still editable
    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('You can only update pending offers');
    }

    Object.assign(offer, updateDto);

    // Recalculate total price if price per unit or quantity changed
    if (updateDto.pricePerUnit || updateDto.availableQuantity) {
      offer.totalPrice = offer.pricePerUnit * offer.availableQuantity;
    }

    return this.offerRepository.save(offer) as any as Offer;
  }

  async withdraw(id: string, exporterId: string, reason?: string): Promise<Offer> {
    const offer = await this.findOne(id);

    // Check if the exporter owns this offer
    if (offer.exporterId !== exporterId) {
      throw new ForbiddenException('You can only withdraw your own offers');
    }

    // Check if offer can be withdrawn
    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('You can only withdraw pending offers');
    }

    offer.status = OfferStatus.WITHDRAWN;
    if (reason) {
      offer.additionalNotes = offer.additionalNotes 
        ? `${offer.additionalNotes}\n\nWithdrawal reason: ${reason}`
        : `Withdrawal reason: ${reason}`;
    }

    return this.offerRepository.save(offer) as any as Offer;
  }

  async accept(id: string, globalBuyerId: string): Promise<Offer> {
    const offer = await this.findOne(id);

    // Check if the global buyer owns the sourcing request
    if (offer.sourcingRequest.globalBuyerId !== globalBuyerId) {
      throw new ForbiddenException('You can only accept offers for your own sourcing requests');
    }

    // Check if offer is still pending
    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('You can only accept pending offers');
    }

    offer.status = OfferStatus.ACCEPTED;
    
    // Auto-reject other pending offers for the same sourcing request
    const otherOffers = await this.offerRepository.findBySourcingRequestId(offer.sourcingRequestId);
    for (const otherOffer of otherOffers) {
      if (otherOffer.id !== id && otherOffer.status === OfferStatus.PENDING) {
        otherOffer.status = OfferStatus.REJECTED;
        otherOffer.rejectionReason = 'Another offer was accepted';
        await this.offerRepository.save(otherOffer) as any;
      }
    }

    const savedOffer = await this.offerRepository.save(offer) as any as Offer;

    // Automatically create an order when offer is accepted
    try {
      const order = await this.orderService.createFromOffer(savedOffer);

      // Initialize chat room for buyer-exporter communication
      await this.chatService.createChatForOrder(order);

    } catch (error) {
      console.error('Error creating order or initializing chat:', error);
      // Don't fail the offer acceptance if order/chat creation fails
    }

    return savedOffer;
  }

  async reject(id: string, globalBuyerId: string, rejectionReason?: string): Promise<Offer> {
    const offer = await this.findOne(id);

    // Check if the global buyer owns the sourcing request
    if (offer.sourcingRequest.globalBuyerId !== globalBuyerId) {
      throw new ForbiddenException('You can only reject offers for your own sourcing requests');
    }

    // Check if offer is still pending
    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('You can only reject pending offers');
    }

    offer.status = OfferStatus.REJECTED;
    offer.rejectionReason = rejectionReason;

    return this.offerRepository.save(offer) as any as Offer;
  }

  async negotiate(id: string, globalBuyerId: string, negotiationTerms: {
    counterPrice?: number;
    counterQuantity?: number;
    negotiationNotes?: string;
  }): Promise<Offer> {
    const originalOffer = await this.findOne(id);

    // Check if the global buyer owns the sourcing request
    if (originalOffer.sourcingRequest.globalBuyerId !== globalBuyerId) {
      throw new ForbiddenException('You can only negotiate offers for your own sourcing requests');
    }

    // Check if offer is still pending
    if (originalOffer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('You can only negotiate pending offers');
    }

    // Update original offer status
    originalOffer.status = OfferStatus.UNDER_NEGOTIATION;
    await this.offerRepository.save(originalOffer) as any;

    // Create counter-offer
    const counterOffer = this.offerRepository.create({
      ...originalOffer,
      id: undefined, // Let TypeORM generate new ID
      pricePerUnit: negotiationTerms.counterPrice || originalOffer.pricePerUnit,
      availableQuantity: negotiationTerms.counterQuantity || originalOffer.availableQuantity,
      totalPrice: (negotiationTerms.counterPrice || originalOffer.pricePerUnit) * 
                  (negotiationTerms.counterQuantity || originalOffer.availableQuantity),
      negotiationNotes: negotiationTerms.negotiationNotes,
      isCounterOffer: true,
      originalOfferId: originalOffer.id,
      status: OfferStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.offerRepository.save(counterOffer) as any as Offer;
  }

  async getMyOffers(exporterId: string): Promise<Offer[]> {
    return this.offerRepository.findByExporterId(exporterId);
  }

  async getReceivedOffers(globalBuyerId: string): Promise<Offer[]> {
    // This would need to be implemented by joining with sourcing requests
    // For now, return empty array
    return [];
  }

  async getOfferStatistics(exporterId?: string): Promise<any> {
    return this.offerRepository.getOfferStatistics(exporterId);
  }

  async markExpiredOffers(): Promise<void> {
    const expiredOffers = await this.offerRepository.findExpiredOffers();
    
    for (const offer of expiredOffers) {
      offer.status = OfferStatus.EXPIRED;
      await this.offerRepository.save(offer) as any;
    }
  }

  async getHighValueOffers(minValue: number = 10000): Promise<Offer[]> {
    return this.offerRepository.findHighValueOffers(minValue);
  }

  async getExporterOffers(exporterId: string, status?: string): Promise<Offer[]> {
    if (status) {
      return this.offerRepository.find({
        where: { exporterId, status: status as OfferStatus },
        relations: ['sourcingRequest', 'sourcingRequest.globalBuyer'],
        order: { createdAt: 'DESC' },
      });
    }
    return this.offerRepository.findByExporterId(exporterId);
  }

  async remove(id: string, exporterId: string): Promise<void> {
    const offer = await this.findOne(id);

    // Check if the exporter owns this offer
    if (offer.exporterId !== exporterId) {
      throw new ForbiddenException('You can only delete your own offers');
    }

    // Only allow deletion of pending or withdrawn offers
    if (offer.status !== OfferStatus.PENDING && offer.status !== OfferStatus.WITHDRAWN) {
      throw new BadRequestException('You can only delete pending or withdrawn offers');
    }

    await this.offerRepository.remove(offer);
  }

  async createCounterOffer(originalOfferId: string, counterOfferData: any, exporterId: string): Promise<Offer> {
    const originalOffer = await this.findOne(originalOfferId);

    // Check if the exporter owns this offer
    if (originalOffer.exporterId !== exporterId) {
      throw new ForbiddenException('You can only create counter-offers for your own offers');
    }

    // Use the negotiate method which already handles counter-offers
    return this.negotiate(originalOfferId, originalOffer.sourcingRequest.globalBuyerId, {
      counterPrice: counterOfferData.pricePerUnit,
      counterQuantity: counterOfferData.availableQuantity,
      negotiationNotes: counterOfferData.negotiationNotes,
    });
  }

  async acceptNegotiation(offerId: string, userId: string): Promise<Offer> {
    const offer = await this.findOne(offerId);

    // This method would typically be called by the global buyer to accept a counter-offer
    if (offer.sourcingRequest.globalBuyerId !== userId) {
      throw new ForbiddenException('Only the buyer can accept negotiations');
    }

    return this.accept(offerId, userId);
  }

  async declineNegotiation(offerId: string, userId: string, reason?: string): Promise<Offer> {
    const offer = await this.findOne(offerId);

    // This method would typically be called by the global buyer to decline a counter-offer
    if (offer.sourcingRequest.globalBuyerId !== userId) {
      throw new ForbiddenException('Only the buyer can decline negotiations');
    }

    return this.reject(offerId, userId, reason);
  }

  async getOfferHistory(offerId: string, userId: string): Promise<Offer[]> {
    const offer = await this.findOne(offerId);

    // Check if user has access to this offer
    const hasAccess = 
      offer.exporter?.userId === userId || 
      offer.sourcingRequest.globalBuyerId === userId;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this offer history');
    }

    // Get all offers related to this original offer (including counter-offers)
    return this.offerRepository.find({
      where: [
        { id: offerId },
        { originalOfferId: offerId },
        { originalOfferId: offer.originalOfferId || undefined },
      ],
      relations: ['exporter', 'exporter.user', 'sourcingRequest'],
      order: { createdAt: 'ASC' },
    });
  }

  async uploadDocument(offerId: string, uploadData: { fileName: string; fileUrl: string; documentType: string }, exporterId: string): Promise<Offer> {
    const offer = await this.findOne(offerId);

    // Check if the exporter owns this offer
    if (offer.exporterId !== exporterId) {
      throw new ForbiddenException('You can only upload documents for your own offers');
    }

    // Add the document to the attachments array
    const attachments = offer.attachments || [];
    attachments.push(uploadData.fileUrl);
    offer.attachments = attachments;

    // Update additional notes with document info
    const documentNote = `Document uploaded: ${uploadData.fileName} (${uploadData.documentType})`;
    offer.additionalNotes = offer.additionalNotes 
      ? `${offer.additionalNotes}\n\n${documentNote}`
      : documentNote;

    return this.offerRepository.save(offer) as any as Offer;
  }

  async getOffersForSourcingRequest(requestId: string, userId: string): Promise<Offer[]> {
    const offers = await this.offerRepository.findBySourcingRequestId(requestId);

    // Check if user has access to these offers
    if (offers.length > 0) {
      const firstOffer = offers[0];
      
      // Check if user is the global buyer of the sourcing request
      // The issue is here: we need to check if the user OWNS the global buyer record
      // not if the user ID equals the globalBuyerId
      const isGlobalBuyer = firstOffer.sourcingRequest.globalBuyer?.userId === userId;
      
      // Check if user is one of the exporters who submitted offers
      const isExporter = offers.some(offer => {
        // Add null checks for safety
        return offer.exporter && offer.exporter.userId === userId;
      });

      const hasAccess = isGlobalBuyer || isExporter;

      if (!hasAccess) {
        console.log('=== PERMISSION CHECK FAILED ===');
        console.log('User ID:', userId);
        console.log('Sourcing Request Global Buyer ID:', firstOffer.sourcingRequest.globalBuyerId);
        console.log('Sourcing Request Global Buyer User ID:', firstOffer.sourcingRequest.globalBuyer?.userId);
        console.log('Is Global Buyer:', isGlobalBuyer);
        console.log('Is Exporter:', isExporter);
        throw new ForbiddenException('You do not have access to these offers');
      }
    }

    return offers;
  }
}
