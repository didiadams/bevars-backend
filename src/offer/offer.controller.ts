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
    return this.offerService.getOfferHistory(id, req.user.id);
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
}
