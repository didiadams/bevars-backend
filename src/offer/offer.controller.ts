import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Patch, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OfferService } from './offer.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';


@Controller('offer')
@UseGuards(JwtAuthGuard)
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  @Post()
  async createOffer(@Body() createDto: CreateOfferDto, @Request() req) {
    // Ensure we have the correct exporter ID
    const exporterId = req.user.exporterId;
    if (!exporterId) {
      throw new BadRequestException('User is not associated with an exporter');
    }
    
    return this.offerService.create({
      ...createDto,
      exporterId: exporterId,
    });
  }

  @Get('my-offers')
  async getMyOffers(@Request() req, @Query('status') status?: string) {
    const exporterId = req.user.exporterId;
    if (!exporterId) {
      throw new BadRequestException('User is not associated with an exporter');
    }
    return this.offerService.getExporterOffers(exporterId, status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.offerService.findOne(id, req.user.id);
  }

  @Put(':id')
  async updateOffer(@Param('id') id: string, @Body() updateDto: UpdateOfferDto, @Request() req) {
    const exporterId = req.user.exporterId;
    if (!exporterId) {
      throw new BadRequestException('User is not associated with an exporter');
    }
    return this.offerService.update(id, updateDto, exporterId);
  }

  @Delete(':id')
  async removeOffer(@Param('id') id: string, @Request() req) {
    const exporterId = req.user.exporterId;
    if (!exporterId) {
      throw new BadRequestException('User is not associated with an exporter');
    }
    return this.offerService.remove(id, exporterId);
  }

  @Post(':id/withdraw')
  async withdrawOffer(@Param('id') id: string, @Body() withdrawDto: { reason?: string }, @Request() req) {
    const exporterId = req.user.exporterId;
    if (!exporterId) {
      throw new BadRequestException('User is not associated with an exporter');
    }
    return this.offerService.withdraw(id, exporterId, withdrawDto.reason);
  }

  @Post(':id/counter-offer')
  async createCounterOffer(
    @Param('id') id: string,
    @Body() counterOfferDto: any,
    @Request() req
  ) {
    const exporterId = req.user.exporterId;
    if (!exporterId) {
      throw new BadRequestException('User is not associated with an exporter');
    }
    return this.offerService.createCounterOffer(id, counterOfferDto, exporterId);
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
    const exporterId = req.user.exporterId;
    if (!exporterId) {
      throw new BadRequestException('User is not associated with an exporter');
    }
    return this.offerService.uploadDocument(id, uploadDto, exporterId);
  }

  @Get('sourcing-request/:requestId')
  async getOffersForSourcingRequest(@Param('requestId') requestId: string, @Request() req) {
    return this.offerService.getOffersForSourcingRequest(requestId, req.user.id);
  }

  @Patch(':id/withdraw')
  async withdrawOfferPatch(@Param('id') id: string, @Body() withdrawDto: { reason?: string }, @Request() req) {
    const exporterId = req.user.exporterId;
    if (!exporterId) {
      throw new BadRequestException('User is not associated with an exporter');
    }
    return this.offerService.withdraw(id, exporterId, withdrawDto.reason);
  }

  @Patch(':id/accept')
  async acceptOfferPatch(@Param('id') id: string, @Request() req) {
    return this.offerService.accept(id, req.user.globalBuyerId || req.user.id);
  }

  @Patch(':id/reject')
  async rejectOfferPatch(@Param('id') id: string, @Body() rejectDto: { reason?: string }, @Request() req) {
    return this.offerService.reject(id, req.user.globalBuyerId || req.user.id, rejectDto.reason);
  }

  @Post(':id/negotiate')
  async negotiateOfferPost(@Param('id') id: string, @Body() negotiationDto: any, @Request() req) {
    return this.offerService.negotiate(id, req.user.globalBuyerId || req.user.id, negotiationDto);
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
