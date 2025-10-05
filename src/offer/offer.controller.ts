import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Patch, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OfferService } from './offer.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { ExporterService } from '../exporter/exporter.service';
import { GlobalBuyerService } from '../global-buyer/global-buyer.service';


@Controller('offer')
@UseGuards(JwtAuthGuard)
export class OfferController {
  constructor(
    private readonly offerService: OfferService,
    @Inject(forwardRef(() => ExporterService))
    private readonly exporterService: ExporterService,
    @Inject(forwardRef(() => GlobalBuyerService))
    private readonly globalBuyerService: GlobalBuyerService,
  ) {}

  @Post()
  async createOffer(@Body() createDto: CreateOfferDto, @Request() req) {
    // Get the actual exporter entity for this user
    const exporter = await this.exporterService.findByUserId(req.user.id);
    
    return this.offerService.create({
      ...createDto,
      exporterId: exporter.id,
    });
  }

  @Get('my-offers')
  async getMyOffers(@Request() req, @Query('status') status?: string) {
    // Get the actual exporter entity for this user
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return this.offerService.getExporterOffers(exporter.id, status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.offerService.findOne(id, req.user.id);
  }

  @Put(':id')
  async updateOffer(@Param('id') id: string, @Body() updateDto: UpdateOfferDto, @Request() req) {
    // Get the actual exporter entity for this user
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return this.offerService.update(id, updateDto, exporter.id);
  }

  @Delete(':id')
  async removeOffer(@Param('id') id: string, @Request() req) {
    // Get the actual exporter entity for this user
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return this.offerService.remove(id, exporter.id);
  }

  @Post(':id/withdraw')
  async withdrawOffer(@Param('id') id: string, @Body() withdrawDto: { reason?: string }, @Request() req) {
    // Get the actual exporter entity for this user
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return this.offerService.withdraw(id, exporter.id, withdrawDto.reason);
  }

  @Post(':id/counter-offer')
  async createCounterOffer(
    @Param('id') id: string,
    @Body() counterOfferDto: any,
    @Request() req
  ) {
    // Get the actual exporter entity for this user
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return this.offerService.createCounterOffer(id, counterOfferDto, exporter.id);
  }

  @Put(':id/accept-buyer-negotiation')
  async acceptBuyerNegotiation(@Param('id') id: string, @Request() req) {
    // Get the actual exporter entity for this user
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return this.offerService.acceptBuyerNegotiation(id, exporter.id);
  }

  @Put(':id/accept-negotiation')
  async acceptNegotiation(@Param('id') id: string, @Request() req) {
    return this.offerService.acceptNegotiation(id, req.user.id);
  }

  @Put(':id/decline-negotiation')
  async declineNegotiation(
    @Param('id') id: string,
    @Body() declineDto: { reason?: string },
    @Request() req
  ) {
    return this.offerService.declineNegotiation(id, req.user.id, declineDto.reason);
  }

  @Get(':id/history')
  async getOfferHistory(@Param('id') id: string, @Request() req) {
    // Determine if user is exporter or global buyer
    let exporterId = null;
    let globalBuyerId = null;
    
    try {
      const exporter = await this.exporterService.findByUserId(req.user.id);
      exporterId = exporter.id;
    } catch (error) {
      // User is not an exporter, try global buyer
      try {
        const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
        globalBuyerId = globalBuyer.id;
      } catch (globalBuyerError) {
        // User is neither exporter nor global buyer
        throw new BadRequestException('User must be either an exporter or global buyer to access offer history');
      }
    }
    
    return this.offerService.getOfferHistory(id, exporterId, globalBuyerId);
  }

  @Get(':id/pending-negotiation')
  async getPendingNegotiation(@Param('id') id: string, @Request() req) {
    // Get the actual exporter entity for this user
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return this.offerService.getPendingNegotiation(id, exporter.id);
  }

  @Post(':id/upload-document')
  async uploadDocument(
    @Param('id') id: string,
    @Body() uploadDto: { fileName: string; fileUrl: string; documentType: string },
    @Request() req
  ) {
    // Get the actual exporter entity for this user
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return this.offerService.uploadDocument(id, uploadDto, exporter.id);
  }

  @Get('sourcing-request/:requestId')
  async getOffersForSourcingRequest(@Param('requestId') requestId: string, @Request() req) {
    return this.offerService.getOffersForSourcingRequest(requestId, req.user.id);
  }

  @Patch(':id/withdraw')
  async withdrawOfferPatch(@Param('id') id: string, @Body() withdrawDto: { reason?: string }, @Request() req) {
    // Get the actual exporter entity for this user
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return this.offerService.withdraw(id, exporter.id, withdrawDto.reason);
  }

  @Patch(':id/accept')
  async acceptOfferPatch(@Param('id') id: string, @Request() req) {
    // Get the actual global buyer entity for this user
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    return this.offerService.accept(id, globalBuyer.id);
  }

  @Patch(':id/reject')
  async rejectOfferPatch(@Param('id') id: string, @Body() rejectDto: { reason?: string }, @Request() req) {
    // Get the actual global buyer entity for this user
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    return this.offerService.reject(id, globalBuyer.id, rejectDto.reason);
  }

  @Post(':id/negotiate')
  async negotiateOfferPost(@Param('id') id: string, @Body() negotiationDto: any, @Request() req) {
    // Get the actual global buyer entity for this user
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    return this.offerService.negotiate(id, globalBuyer.id, negotiationDto);
  }

  // DEBUG: Temporary endpoint to test database connections and relationships
  @Get('debug/sourcing-request/:requestId')
  async debugSourcingRequest(@Param('requestId') requestId: string, @Request() req) {
    console.log('=== DEBUG INFO ===');
    console.log('Request ID:', requestId);
    console.log('User ID:', req.user.id);
    console.log('User Role:', req.user.role);
    console.log('User Object:', req.user);
    
    try {
      // Test database connection by trying to find the sourcing request
      const offers = await this.offerService.getOffersForSourcingRequest(requestId, req.user.id);
      console.log('Offers found:', offers.length);
      if (offers.length > 0) {
        console.log('First offer sourcing request:', offers[0].sourcingRequest);
        console.log('Global Buyer ID from sourcing request:', offers[0].sourcingRequest.globalBuyerId);
        console.log('User ID comparison:', req.user.id === offers[0].sourcingRequest.globalBuyerId);
      }
      return { success: true, offers: offers.length, user: req.user };
    } catch (error) {
      console.log('Error details:', error.message);
      console.log('Error stack:', error.stack);
      return { 
        success: false, 
        error: error.message, 
        user: req.user,
        requestId: requestId 
      };
    }
  }

  // DEBUG: Simple database connection test
  @Get('debug/connection-test')
  async testDatabaseConnection() {
    try {
      // Simple query to test database connection
      const result = await this.offerService['offerRepository'].query('SELECT 1 as test');
      return { 
        success: true, 
        message: 'Database connection successful', 
        result: result 
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Database connection failed', 
        error: error.message 
      };
    }
  }

  // DEBUG: Test negotiation creation
  @Post('debug/:id/create-test-negotiation')
  async createTestNegotiation(@Param('id') id: string, @Request() req) {
    try {
      // Get the offer
      const offer = await this.offerService.findOne(id);
      
      // Simulate a buyer negotiation
      const globalBuyer = await this.globalBuyerService.findByUserId(offer.sourcingRequest.globalBuyer.userId);
      
      const negotiationResult = await this.offerService.negotiate(id, globalBuyer.id, {
        counterPrice: offer.pricePerUnit * 0.9, // 10% lower
        counterQuantity: offer.availableQuantity,
        negotiationNotes: 'Test negotiation - requesting 10% price reduction'
      });
      
      return {
        success: true,
        message: 'Test negotiation created successfully',
        offer: negotiationResult
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create test negotiation',
        error: error.message
      };
    }
  }

  // DEBUG: Get negotiation status for offer
  @Get('debug/:id/negotiation-status')
  async getNegotiationStatus(@Param('id') id: string) {
    try {
      const offer = await this.offerService.findOne(id);
      const allNegotiations = await this.offerService['negotiationHistoryRepository'].findByOfferId(id);
      const pendingNegotiation = await this.offerService['negotiationHistoryRepository'].findPendingNegotiation(id);
      
      return {
        success: true,
        offer: {
          id: offer.id,
          status: offer.status,
          pricePerUnit: offer.pricePerUnit,
          availableQuantity: offer.availableQuantity,
          totalPrice: offer.totalPrice
        },
        allNegotiations: allNegotiations.map(n => ({
          id: n.id,
          type: n.type,
          status: n.status,
          round: n.negotiationRound,
          proposedPrice: n.proposedPricePerUnit,
          proposedQuantity: n.proposedQuantity,
          notes: n.notes,
          createdAt: n.createdAt
        })),
        pendingNegotiation: pendingNegotiation ? {
          id: pendingNegotiation.id,
          type: pendingNegotiation.type,
          status: pendingNegotiation.status,
          round: pendingNegotiation.negotiationRound
        } : null
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get negotiation status',
        error: error.message
      };
    }
  }
}
