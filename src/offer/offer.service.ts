import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { OfferRepository } from './repositories/offer.repository';
import { NegotiationHistoryRepository } from './repositories/negotiation-history.repository';
import { Offer, OfferStatus } from './entities/offer.entity';
import { NegotiationHistory, NegotiationType, NegotiationStatus } from './entities/negotiation-history.entity';
import { SourcingRequestService } from '../sourcing-request/sourcing-request.service';
import { OrderService } from '../order/order.service';
import { ChatService } from '../chat/chat.service';
import { MailService, NegotiationNotificationData } from '../mail/mail-service.service';
import { UserService } from '../user/user.service';

@Injectable()
export class OfferService {
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly negotiationHistoryRepository: NegotiationHistoryRepository,
    @Inject(forwardRef(() => SourcingRequestService))
    private readonly sourcingRequestService: SourcingRequestService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => MailService))
    private readonly mailService: MailService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
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
      totalPrice: createDto.totalPrice || (createDto.pricePerUnit * createDto.availableQuantity),
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

    // Check if offer is still acceptable
    if (offer.status !== OfferStatus.PENDING && offer.status !== OfferStatus.UNDER_NEGOTIATION) {
      throw new BadRequestException('You can only accept pending or negotiating offers');
    }

    // Check if there's a pending negotiation that needs exporter response first
    if (offer.status === OfferStatus.UNDER_NEGOTIATION) {
      const pendingNegotiation = await this.negotiationHistoryRepository.findPendingNegotiation(offer.id);
      if (pendingNegotiation && pendingNegotiation.type === NegotiationType.BUYER_NEGOTIATION) {
        throw new BadRequestException('Cannot accept offer while buyer negotiation is pending exporter response');
      }
    }

    offer.status = OfferStatus.ACCEPTED;
    
    // Mark any pending negotiations as accepted
    const pendingNegotiation = await this.negotiationHistoryRepository.findPendingNegotiation(offer.id);
    if (pendingNegotiation) {
      await this.negotiationHistoryRepository.updateStatus(pendingNegotiation.id, NegotiationStatus.ACCEPTED);
    }

    // Auto-reject other pending and under negotiation offers for the same sourcing request
    const otherOffers = await this.offerRepository.findBySourcingRequestId(offer.sourcingRequestId);
    for (const otherOffer of otherOffers) {
      if (otherOffer.id !== id && (otherOffer.status === OfferStatus.PENDING || otherOffer.status === OfferStatus.UNDER_NEGOTIATION)) {
        otherOffer.status = OfferStatus.REJECTED;
        otherOffer.rejectionReason = 'Another offer was accepted';
        await this.offerRepository.save(otherOffer) as any;
      }
    }

    const savedOffer = await this.offerRepository.save(offer) as any as Offer;

    // Send email notification about accepted negotiation
    try {
      const exporterUserId = savedOffer.exporter?.userId;
      if (exporterUserId) {
        const shouldSend = await this.userService.shouldSendEmailNotification(exporterUserId, 'negotiationAccepted');
        if (shouldSend) {
          const exporterEmail = await this.userService.getUserEmail(exporterUserId);
          const notificationData: NegotiationNotificationData = {
            offerId: savedOffer.id,
            buyerName: savedOffer.sourcingRequest.globalBuyer?.user?.firstName + ' ' + savedOffer.sourcingRequest.globalBuyer?.user?.lastName || 'Buyer',
            buyerCompany: savedOffer.sourcingRequest.globalBuyer?.user?.companyName || 'Company',
            exporterName: savedOffer.exporter?.user?.firstName + ' ' + savedOffer.exporter?.user?.lastName || 'Exporter',
            exporterCompany: savedOffer.exporter?.user?.companyName || 'Company',
            cropName: savedOffer.sourcingRequest.productName || 'Product',
            originalPrice: savedOffer.pricePerUnit,
            negotiatedPrice: savedOffer.pricePerUnit,
            quantity: savedOffer.availableQuantity,
            variety: savedOffer.sourcingRequest.productVariety || 'Standard',
            negotiationType: 'accepted',
          };
          
          await this.mailService.sendNegotiationAcceptedEmail(notificationData, exporterEmail);
        }
      }
    } catch (emailError) {
      console.error('Failed to send negotiation accepted email:', emailError);
      // Don't fail the acceptance if email fails
    }

    // Only create order if one doesn't already exist for this offer
    try {
      const existingOrder = await this.orderService.findByOfferId(savedOffer.id);
      if (!existingOrder) {
        const order = await this.orderService.createFromOffer(savedOffer);
        // Initialize chat room for buyer-exporter communication
        await this.chatService.createChatForOrder(order);
      }
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

    const savedOffer = await this.offerRepository.save(offer) as any as Offer;

    // Send email notification about declined negotiation
    try {
      const exporterUserId = savedOffer.exporter?.userId;
      if (exporterUserId) {
        const shouldSend = await this.userService.shouldSendEmailNotification(exporterUserId, 'negotiationDeclined');
        if (shouldSend) {
          const exporterEmail = await this.userService.getUserEmail(exporterUserId);
          const notificationData: NegotiationNotificationData = {
            offerId: savedOffer.id,
            buyerName: savedOffer.sourcingRequest.globalBuyer?.user?.firstName + ' ' + savedOffer.sourcingRequest.globalBuyer?.user?.lastName || 'Buyer',
            buyerCompany: savedOffer.sourcingRequest.globalBuyer?.user?.companyName || 'Company',
            exporterName: savedOffer.exporter?.user?.firstName + ' ' + savedOffer.exporter?.user?.lastName || 'Exporter',
            exporterCompany: savedOffer.exporter?.user?.companyName || 'Company',
            cropName: savedOffer.sourcingRequest.productName || 'Product',
            originalPrice: savedOffer.pricePerUnit,
            negotiatedPrice: savedOffer.pricePerUnit,
            quantity: savedOffer.availableQuantity,
            variety: savedOffer.sourcingRequest.productVariety || 'Standard',
            negotiationNotes: rejectionReason,
            negotiationType: 'declined',
          };
          
          await this.mailService.sendNegotiationDeclinedEmail(notificationData, exporterEmail);
        }
      }
    } catch (emailError) {
      console.error('Failed to send negotiation declined email:', emailError);
      // Don't fail the rejection if email fails
    }

    return savedOffer;
  }

  async negotiate(id: string, globalBuyerId: string, negotiationTerms: {
    counterPrice?: number;
    counterQuantity?: number;
    negotiationNotes?: string;
  }): Promise<Offer> {
    const offer = await this.findOne(id);

    // Check if the global buyer owns the sourcing request
    if (offer.sourcingRequest.globalBuyerId !== globalBuyerId) {
      throw new ForbiddenException('You can only negotiate offers for your own sourcing requests');
    }

    // Check if offer is still negotiable
    if (offer.status !== OfferStatus.PENDING && offer.status !== OfferStatus.UNDER_NEGOTIATION) {
      throw new BadRequestException('You can only negotiate pending or under negotiation offers');
    }

    // Check negotiation limit
    const negotiationLimit = await this.checkNegotiationLimit(offer.id);
    if (!negotiationLimit.canNegotiate) {
      throw new BadRequestException(`Maximum number of negotiation rounds (${negotiationLimit.maxRounds}) has been reached`);
    }

    // Check if there's already a pending buyer negotiation
    const pendingNegotiation = await this.negotiationHistoryRepository.findPendingNegotiation(offer.id);
    if (pendingNegotiation && pendingNegotiation.type === NegotiationType.BUYER_NEGOTIATION) {
      throw new BadRequestException('There is already a pending buyer negotiation for this offer');
    }

    // Mark any existing pending negotiations as superseded
    await this.negotiationHistoryRepository.markSuperseded(offer.id);

    // Update offer status to under negotiation
    offer.status = OfferStatus.UNDER_NEGOTIATION;
    
    // Update offer terms with negotiated values
    if (negotiationTerms.counterPrice) {
      offer.pricePerUnit = negotiationTerms.counterPrice;
    }
    if (negotiationTerms.counterQuantity) {
      offer.availableQuantity = negotiationTerms.counterQuantity;
    }
    offer.totalPrice = offer.pricePerUnit * offer.availableQuantity;
    offer.negotiationNotes = negotiationTerms.negotiationNotes;

    const savedOffer = await this.offerRepository.save(offer) as any as Offer;

    // Create negotiation history record
    const currentRound = await this.negotiationHistoryRepository.getCurrentRound(offer.id);
    await this.negotiationHistoryRepository.create({
      offerId: offer.id,
      type: NegotiationType.BUYER_NEGOTIATION,
      status: NegotiationStatus.PENDING,
      proposedPricePerUnit: negotiationTerms.counterPrice || offer.pricePerUnit,
      proposedQuantity: negotiationTerms.counterQuantity || offer.availableQuantity,
      proposedTotalPrice: (negotiationTerms.counterPrice || offer.pricePerUnit) * (negotiationTerms.counterQuantity || offer.availableQuantity),
      notes: negotiationTerms.negotiationNotes,
      initiatedBy: globalBuyerId,
      negotiationRound: currentRound + 1,
    });

    // Send email notification to exporter about negotiation
    try {
      const exporterUserId = savedOffer.exporter?.userId;
      if (exporterUserId) {
        const shouldSend = await this.userService.shouldSendEmailNotification(exporterUserId, 'negotiationStarted');
        if (shouldSend) {
          const exporterEmail = await this.userService.getUserEmail(exporterUserId);
          const notificationData: NegotiationNotificationData = {
            offerId: savedOffer.id,
            buyerName: savedOffer.sourcingRequest.globalBuyer?.user?.firstName + ' ' + savedOffer.sourcingRequest.globalBuyer?.user?.lastName || 'Buyer',
            buyerCompany: savedOffer.sourcingRequest.globalBuyer?.user?.companyName || 'Company',
            exporterName: savedOffer.exporter?.user?.firstName + ' ' + savedOffer.exporter?.user?.lastName || 'Exporter',
            exporterCompany: savedOffer.exporter?.user?.companyName || 'Company',
            cropName: savedOffer.sourcingRequest.productName || 'Product',
            originalPrice: savedOffer.pricePerUnit,
            negotiatedPrice: negotiationTerms.counterPrice,
            quantity: negotiationTerms.counterQuantity || savedOffer.availableQuantity,
            variety: savedOffer.sourcingRequest.productVariety || 'Standard',
            negotiationNotes: negotiationTerms.negotiationNotes,
            negotiationType: 'initiated',
            savings: savedOffer.pricePerUnit - (negotiationTerms.counterPrice || savedOffer.pricePerUnit),
          };
          
          await this.mailService.sendNegotiationInitiatedEmail(notificationData, exporterEmail);
        }
      }
    } catch (emailError) {
      console.error('Failed to send negotiation initiated email:', emailError);
      // Don't fail the negotiation if email fails
    }

    return savedOffer;
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
    const offer = await this.findOne(originalOfferId);

    // Check if the exporter owns this offer
    if (offer.exporterId !== exporterId) {
      throw new ForbiddenException('You can only create counter-offers for your own offers');
    }

    // Check if offer is still negotiable
    if (offer.status !== OfferStatus.UNDER_NEGOTIATION) {
      throw new BadRequestException('You can only create counter-offers for offers under negotiation');
    }

    // Check negotiation limit
    const negotiationLimit = await this.checkNegotiationLimit(offer.id);
    if (!negotiationLimit.canNegotiate) {
      throw new BadRequestException(`Maximum number of negotiation rounds (${negotiationLimit.maxRounds}) has been reached`);
    }

    // Check if there's a pending buyer negotiation to respond to
    const pendingNegotiation = await this.negotiationHistoryRepository.findPendingNegotiation(offer.id);
    
    // Debug logging to understand the state
    console.log('=== COUNTER OFFER DEBUG ===');
    console.log('Offer ID:', offer.id);
    console.log('Offer Status:', offer.status);
    console.log('Pending Negotiation:', pendingNegotiation ? {
      id: pendingNegotiation.id,
      type: pendingNegotiation.type,
      status: pendingNegotiation.status,
      round: pendingNegotiation.negotiationRound
    } : 'None found');
    
    // Get all negotiations for this offer for debugging
    const allNegotiations = await this.negotiationHistoryRepository.findByOfferId(offer.id);
    console.log('All negotiations:', allNegotiations.map(n => ({
      id: n.id,
      type: n.type,
      status: n.status,
      round: n.negotiationRound,
      createdAt: n.createdAt
    })));
    
    // More flexible approach: If offer is under negotiation but no pending buyer negotiation,
    // allow counter offer as long as there's some negotiation history
    if (!pendingNegotiation) {
      if (allNegotiations.length === 0) {
        throw new BadRequestException('No negotiation found for this offer. A buyer must initiate negotiation first.');
      }
      
      // If there are negotiations but none pending, allow counter offer anyway
      console.log('No pending negotiation found, but offer is under negotiation. Proceeding with counter offer.');
    } else if (pendingNegotiation.type !== NegotiationType.BUYER_NEGOTIATION) {
      throw new BadRequestException(`Cannot create counter offer. Expected pending buyer negotiation, but found: ${pendingNegotiation.type}`);
    }

    // Mark the buyer negotiation as superseded (if it exists)
    if (pendingNegotiation) {
      await this.negotiationHistoryRepository.updateStatus(pendingNegotiation.id, NegotiationStatus.SUPERSEDED);
    }

    // Update offer with counter-offer terms
    offer.pricePerUnit = counterOfferData.pricePerUnit || offer.pricePerUnit;
    offer.availableQuantity = counterOfferData.availableQuantity || offer.availableQuantity;
    offer.totalPrice = offer.pricePerUnit * offer.availableQuantity;
    offer.negotiationNotes = counterOfferData.negotiationNotes;

    const savedOffer = await this.offerRepository.save(offer) as any as Offer;

    // Create negotiation history record for exporter counter
    const currentRound = await this.negotiationHistoryRepository.getCurrentRound(offer.id);
    await this.negotiationHistoryRepository.create({
      offerId: offer.id,
      type: NegotiationType.EXPORTER_COUNTER,
      status: NegotiationStatus.PENDING,
      proposedPricePerUnit: counterOfferData.pricePerUnit || offer.pricePerUnit,
      proposedQuantity: counterOfferData.availableQuantity || offer.availableQuantity,
      proposedTotalPrice: offer.totalPrice,
      notes: counterOfferData.negotiationNotes,
      initiatedBy: exporterId,
      negotiationRound: pendingNegotiation ? pendingNegotiation.negotiationRound : currentRound + 1,
    });

    // Send email notification to buyer about counter offer
    try {
      const buyerUserId = savedOffer.sourcingRequest.globalBuyer?.userId;
      if (buyerUserId) {
        const shouldSend = await this.userService.shouldSendEmailNotification(buyerUserId, 'counterOfferReceived');
        if (shouldSend) {
          const buyerEmail = await this.userService.getUserEmail(buyerUserId);
          const notificationData: NegotiationNotificationData = {
            offerId: savedOffer.id,
            buyerName: savedOffer.sourcingRequest.globalBuyer?.user?.firstName + ' ' + savedOffer.sourcingRequest.globalBuyer?.user?.lastName || 'Buyer',
            buyerCompany: savedOffer.sourcingRequest.globalBuyer?.user?.companyName || 'Company',
            exporterName: savedOffer.exporter?.user?.firstName + ' ' + savedOffer.exporter?.user?.lastName || 'Exporter',
            exporterCompany: savedOffer.exporter?.user?.companyName || 'Company',
            cropName: savedOffer.sourcingRequest.productName || 'Product',
            originalPrice: pendingNegotiation ? pendingNegotiation.proposedPricePerUnit : offer.pricePerUnit, // This was the buyer's requested price
            negotiatedPrice: counterOfferData.pricePerUnit, // This is the exporter's counter price
            quantity: counterOfferData.availableQuantity || savedOffer.availableQuantity,
            variety: savedOffer.sourcingRequest.productVariety || 'Standard',
            negotiationNotes: counterOfferData.negotiationNotes,
            negotiationType: 'counter_offer',
            priceChange: (counterOfferData.pricePerUnit || 0) - (pendingNegotiation ? pendingNegotiation.proposedPricePerUnit || 0 : offer.pricePerUnit),
          };
          
          await this.mailService.sendCounterOfferEmail(notificationData, buyerEmail);
        }
      }
    } catch (emailError) {
      console.error('Failed to send counter offer email:', emailError);
      // Don't fail the counter offer if email fails
    }

    return savedOffer;
  }

  async acceptNegotiation(offerId: string, userId: string): Promise<Offer> {
    const offer = await this.findOne(offerId);

    // This method would typically be called by the global buyer to accept a counter-offer
    if (offer.sourcingRequest.globalBuyerId !== userId) {
      throw new ForbiddenException('Only the buyer can accept negotiations');
    }

    return this.accept(offerId, userId);
  }

  async acceptBuyerNegotiation(offerId: string, exporterId: string): Promise<Offer> {
    const offer = await this.findOne(offerId);

    // Check if the exporter owns this offer
    if (offer.exporterId !== exporterId) {
      throw new ForbiddenException('You can only accept negotiations for your own offers');
    }

    // Check if offer is under negotiation
    if (offer.status !== OfferStatus.UNDER_NEGOTIATION) {
      throw new BadRequestException('You can only accept buyer negotiations for offers under negotiation');
    }

    // Check if there's a pending buyer negotiation to accept
    const pendingNegotiation = await this.negotiationHistoryRepository.findPendingNegotiation(offer.id);
    if (!pendingNegotiation || pendingNegotiation.type !== NegotiationType.BUYER_NEGOTIATION) {
      throw new BadRequestException('No pending buyer negotiation found to accept');
    }

    // Mark the negotiation as accepted by exporter
    await this.negotiationHistoryRepository.updateStatus(pendingNegotiation.id, NegotiationStatus.ACCEPTED);

    // Create exporter acceptance record
    await this.negotiationHistoryRepository.create({
      offerId: offer.id,
      type: NegotiationType.EXPORTER_ACCEPTANCE,
      status: NegotiationStatus.ACCEPTED,
      proposedPricePerUnit: offer.pricePerUnit,
      proposedQuantity: offer.availableQuantity,
      proposedTotalPrice: offer.totalPrice,
      notes: 'Exporter accepted buyer negotiation terms',
      initiatedBy: exporterId,
      negotiationRound: pendingNegotiation.negotiationRound,
    });

    // Accept the offer using the global buyer ID
    return this.accept(offerId, offer.sourcingRequest.globalBuyerId);
  }

  async declineNegotiation(offerId: string, userId: string, reason?: string): Promise<Offer> {
    const offer = await this.findOne(offerId);

    // This method would typically be called by the global buyer to decline a counter-offer
    if (offer.sourcingRequest.globalBuyerId !== userId) {
      throw new ForbiddenException('Only the buyer can decline negotiations');
    }

    return this.reject(offerId, userId, reason);
  }

  async getOfferHistory(offerId: string, exporterId?: string, globalBuyerId?: string): Promise<{ offer: Offer; history: NegotiationHistory[] }> {
    const offer = await this.findOne(offerId);

    // Check if user has access to this offer
    const hasAccess = 
      (exporterId && offer.exporter?.id === exporterId) || 
      (globalBuyerId && offer.sourcingRequest.globalBuyerId === globalBuyerId);

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this offer history');
    }

    // Get negotiation history for this offer
    const history = await this.negotiationHistoryRepository.findByOfferId(offerId);
    
    return { offer, history };
  }

  async checkNegotiationLimit(offerId: string): Promise<{ canNegotiate: boolean; currentRound: number; maxRounds: number }> {
    const MAX_NEGOTIATION_ROUNDS = 3;
    const currentRound = await this.negotiationHistoryRepository.getCurrentRound(offerId);
    
    return {
      canNegotiate: currentRound < MAX_NEGOTIATION_ROUNDS,
      currentRound,
      maxRounds: MAX_NEGOTIATION_ROUNDS
    };
  }

  async acceptExporterCounter(offerId: string, globalBuyerId: string): Promise<Offer> {
    const offer = await this.findOne(offerId);

    // Check if the global buyer owns the sourcing request
    if (offer.sourcingRequest.globalBuyerId !== globalBuyerId) {
      throw new ForbiddenException('You can only accept counter offers for your own sourcing requests');
    }

    // Check if offer is under negotiation
    if (offer.status !== OfferStatus.UNDER_NEGOTIATION) {
      throw new BadRequestException('You can only accept counter offers for offers under negotiation');
    }

    // Check if there's a pending exporter counter to accept
    const pendingNegotiation = await this.negotiationHistoryRepository.findPendingNegotiation(offer.id);
    if (!pendingNegotiation || pendingNegotiation.type !== NegotiationType.EXPORTER_COUNTER) {
      throw new BadRequestException('No pending exporter counter offer found to accept');
    }

    // Mark the exporter counter as accepted
    await this.negotiationHistoryRepository.updateStatus(pendingNegotiation.id, NegotiationStatus.ACCEPTED);

    // Create buyer acceptance record
    await this.negotiationHistoryRepository.create({
      offerId: offer.id,
      type: NegotiationType.BUYER_ACCEPTANCE,
      status: NegotiationStatus.ACCEPTED,
      proposedPricePerUnit: offer.pricePerUnit,
      proposedQuantity: offer.availableQuantity,
      proposedTotalPrice: offer.totalPrice,
      notes: 'Buyer accepted exporter counter offer',
      initiatedBy: globalBuyerId,
      negotiationRound: pendingNegotiation.negotiationRound,
    });

    // Accept the offer using the main accept method
    return this.accept(offerId, globalBuyerId);
  }



  async getPendingNegotiation(offerId: string, exporterId: string): Promise<{ offer: Offer; pendingNegotiation: NegotiationHistory | null }> {
    const offer = await this.findOne(offerId);

    // Check if the exporter owns this offer
    if (offer.exporterId !== exporterId) {
      throw new ForbiddenException('You can only view negotiations for your own offers');
    }

    // Get pending negotiation if any
    const pendingNegotiation = await this.negotiationHistoryRepository.findPendingNegotiation(offerId);
    
    return { offer, pendingNegotiation };
  }

  async buyerCounterNegotiate(offerId: string, globalBuyerId: string, negotiationTerms: {
    counterPrice?: number;
    counterQuantity?: number;
    negotiationNotes?: string;
  }): Promise<Offer> {
    const offer = await this.findOne(offerId);

    // Check if the global buyer owns the sourcing request
    if (offer.sourcingRequest.globalBuyerId !== globalBuyerId) {
      throw new ForbiddenException('You can only counter-negotiate offers for your own sourcing requests');
    }

    // Check if offer is under negotiation
    if (offer.status !== OfferStatus.UNDER_NEGOTIATION) {
      throw new BadRequestException('You can only counter-negotiate offers under negotiation');
    }

    // Check negotiation limit
    const negotiationLimit = await this.checkNegotiationLimit(offer.id);
    if (!negotiationLimit.canNegotiate) {
      throw new BadRequestException(`Maximum number of negotiation rounds (${negotiationLimit.maxRounds}) has been reached`);
    }

    // Check if there's a pending exporter counter to respond to
    const pendingNegotiation = await this.negotiationHistoryRepository.findPendingNegotiation(offer.id);
    if (!pendingNegotiation || pendingNegotiation.type !== NegotiationType.EXPORTER_COUNTER) {
      throw new BadRequestException('No pending exporter counter offer found to respond to');
    }

    // Mark the exporter counter as superseded
    await this.negotiationHistoryRepository.updateStatus(pendingNegotiation.id, NegotiationStatus.SUPERSEDED);

    // Update offer terms with buyer's counter-negotiation
    if (negotiationTerms.counterPrice) {
      offer.pricePerUnit = negotiationTerms.counterPrice;
    }
    if (negotiationTerms.counterQuantity) {
      offer.availableQuantity = negotiationTerms.counterQuantity;
    }
    offer.totalPrice = offer.pricePerUnit * offer.availableQuantity;
    offer.negotiationNotes = negotiationTerms.negotiationNotes;

    const savedOffer = await this.offerRepository.save(offer) as any as Offer;

    // Create new buyer negotiation record
    await this.negotiationHistoryRepository.create({
      offerId: offer.id,
      type: NegotiationType.BUYER_NEGOTIATION,
      status: NegotiationStatus.PENDING,
      proposedPricePerUnit: negotiationTerms.counterPrice || offer.pricePerUnit,
      proposedQuantity: negotiationTerms.counterQuantity || offer.availableQuantity,
      proposedTotalPrice: offer.totalPrice,
      notes: negotiationTerms.negotiationNotes,
      initiatedBy: globalBuyerId,
      negotiationRound: pendingNegotiation.negotiationRound + 1,
    });

    // Send email notification to exporter about buyer counter negotiation
    try {
      const exporterUserId = savedOffer.exporter?.userId;
      if (exporterUserId) {
        const shouldSend = await this.userService.shouldSendEmailNotification(exporterUserId, 'negotiationStarted');
        if (shouldSend) {
          const exporterEmail = await this.userService.getUserEmail(exporterUserId);
          const notificationData: any = {
            offerId: savedOffer.id,
            buyerName: savedOffer.sourcingRequest.globalBuyer?.user?.firstName + ' ' + savedOffer.sourcingRequest.globalBuyer?.user?.lastName || 'Buyer',
            buyerCompany: savedOffer.sourcingRequest.globalBuyer?.user?.companyName || 'Company',
            exporterName: savedOffer.exporter?.user?.firstName + ' ' + savedOffer.exporter?.user?.lastName || 'Exporter',
            exporterCompany: savedOffer.exporter?.user?.companyName || 'Company',
            cropName: savedOffer.sourcingRequest.productName || 'Product',
            originalPrice: pendingNegotiation.proposedPricePerUnit,
            negotiatedPrice: negotiationTerms.counterPrice,
            quantity: negotiationTerms.counterQuantity || savedOffer.availableQuantity,
            variety: savedOffer.sourcingRequest.productVariety || 'Standard',
            negotiationNotes: negotiationTerms.negotiationNotes,
            negotiationType: 'buyer_counter_negotiation',
            negotiationRound: pendingNegotiation.negotiationRound + 1,
            maxRounds: negotiationLimit.maxRounds,
          };
          
          await this.mailService.sendNegotiationInitiatedEmail(notificationData, exporterEmail);
        }
      }
    } catch (emailError) {
      console.error('Failed to send buyer counter negotiation email:', emailError);
      // Don't fail the negotiation if email fails
    }

    return savedOffer;
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
