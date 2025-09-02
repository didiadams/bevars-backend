import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Inject, forwardRef } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateSourcingRequestDto } from './dto/create-sourcing-request.dto';
import { UpdateSourcingRequestDto } from './dto/update-sourcing-request.dto';
import { SourcingRequestService } from './sourcing-request.service';
import { GlobalBuyerService } from '../global-buyer/global-buyer.service';

@Controller('sourcing-request')
export class SourcingRequestController {
  constructor(
    private readonly sourcingRequestService: SourcingRequestService,
    @Inject(forwardRef(() => GlobalBuyerService))
    private readonly globalBuyerService: GlobalBuyerService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('category') category?: string,
    @Query('country') country?: string,
    @Query('minBudget') minBudget?: number,
    @Query('maxBudget') maxBudget?: number,
    @Query('urgency') urgency?: string,
    @Query('search') search?: string,
  ) {
    return this.sourcingRequestService.findAll({
      page,
      limit,
      category,
      country,
      minBudget,
      maxBudget,
      urgency,
      search,
    });
  }

  @Get('public')
  async findAllPublic(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('category') category?: string,
    @Query('country') country?: string,
    @Query('minBudget') minBudget?: number,
    @Query('maxBudget') maxBudget?: number,
    @Query('urgency') urgency?: string,
    @Query('search') search?: string,
  ) {
    return this.sourcingRequestService.findAll({
      page,
      limit,
      category,
      country,
      minBudget,
      maxBudget,
      urgency,
      search,
    });
  }

  @Get('featured')
  async getFeatured() {
    return this.sourcingRequestService.getFeatured();
  }

  @Get('categories')
  async getCategories() {
    return this.sourcingRequestService.getCategories();
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req?) {
    return this.sourcingRequestService.findOne(id, req?.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() createDto: CreateSourcingRequestDto, @Request() req) {
    // Get the correct global buyer ID for this user
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    
    return this.sourcingRequestService.create({
      ...createDto,
      globalBuyerId: globalBuyer.id,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateSourcingRequestDto, @Request() req) {
    // Get the global buyer ID for authorization
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    return this.sourcingRequestService.update(id, updateDto, globalBuyer.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    // Get the global buyer ID for authorization
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    return this.sourcingRequestService.remove(id, globalBuyer.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/close')
  async close(@Param('id') id: string, @Request() req) {
    // Get the global buyer ID for authorization
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    return this.sourcingRequestService.close(id, globalBuyer.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/extend-deadline')
  async extendDeadline(
    @Param('id') id: string,
    @Body() extendDto: { newDeadline: string; reason?: string },
    @Request() req
  ) {
    // Get the global buyer ID for authorization
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    return this.sourcingRequestService.extendDeadline(id, extendDto, globalBuyer.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/invite-exporter')
  async inviteExporter(
    @Param('id') id: string,
    @Body() inviteDto: { exporterId: string; message?: string },
    @Request() req
  ) {
    // Get the global buyer ID for authorization
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    return this.sourcingRequestService.inviteExporter(id, inviteDto, globalBuyer.id);
  }

  @Get(':id/offers')
  async getOffers(@Param('id') id: string, @Request() req?) {
    return this.sourcingRequestService.getOffers(id, req?.user?.id);
  }

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard)
  async getAnalytics(@Param('id') id: string, @Request() req) {
    // Get the global buyer ID for authorization
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    return this.sourcingRequestService.getAnalytics(id, globalBuyer.id);
  }

  @Get('my-requests')
  @UseGuards(JwtAuthGuard)
  async getMyRequests(@Request() req, @Query('status') status?: string) {
    // Get the global buyer ID to fetch their requests
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    return this.sourcingRequestService.getMyRequests(globalBuyer.id, status as any);
  }

  @Get(':id/offers')
  @UseGuards(JwtAuthGuard)
  async getOffersForRequest(@Param('id') id: string, @Request() req) {
    // Verify the user has access to this sourcing request
    const request = await this.sourcingRequestService.findOne(id, req.user.id);
    
    // Get global buyer to verify ownership
    const globalBuyer = await this.globalBuyerService.findByUserId(req.user.id);
    if (request.globalBuyerId !== globalBuyer.id) {
      throw new Error('You can only view offers for your own sourcing requests');
    }
    
    // Return offers for this sourcing request
    // This would need the offer service integration
    return { message: 'Get offers endpoint - to be implemented with offer service integration', requestId: id };
  }

  @Post(':id/offers/:offerId/accept')
  @UseGuards(JwtAuthGuard)
  async acceptOffer(@Param('id') id: string, @Param('offerId') offerId: string, @Request() req) {
    // This would typically be handled by the offer service, but we'll create a wrapper method
    const request = await this.sourcingRequestService.findOne(id, req.user.id);
    
    if (request.globalBuyerId !== req.user.globalBuyerId && request.globalBuyerId !== req.user.id) {
      throw new Error('You can only accept offers for your own sourcing requests');
    }
    
    // This would need to be implemented in the sourcing request service
    // or we'd inject the offer service here
    return { message: 'Offer acceptance endpoint - to be implemented with offer service' };
  }

  @Post(':id/offers/:offerId/reject')
  @UseGuards(JwtAuthGuard)
  async rejectOffer(
    @Param('id') id: string, 
    @Param('offerId') offerId: string, 
    @Body() rejectDto: { reason?: string },
    @Request() req
  ) {
    const request = await this.sourcingRequestService.findOne(id, req.user.id);
    
    if (request.globalBuyerId !== req.user.globalBuyerId && request.globalBuyerId !== req.user.id) {
      throw new Error('You can only reject offers for your own sourcing requests');
    }
    
    return { message: 'Offer rejection endpoint - to be implemented with offer service' };
  }

  @Post('sync-offer-counts')
  @ApiOperation({ summary: 'Sync offer counts for all sourcing requests' })
  @ApiResponse({ status: 200, description: 'Offer counts synced successfully' })
  async syncOfferCounts() {
    await this.sourcingRequestService.syncOfferCounts();
    return { message: 'Offer counts synced successfully' };
  }
}
