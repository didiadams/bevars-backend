import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OfferService } from './offer.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';


@Controller('api/v1/offer')
@UseGuards(JwtAuthGuard)
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  @Post()
  async createOffer(@Body() createDto: CreateOfferDto, @Request() req) {
    return this.offerService.create({
      ...createDto,
      exporterId: req.user.exporterId || req.user.id,
    });
  }

  @Get('my-offers')
  async getMyOffers(@Request() req, @Query('status') status?: string) {
    return this.offerService.getExporterOffers(req.user.id, status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.offerService.findOne(id, req.user.id);
  }

  @Put(':id')
  async updateOffer(@Param('id') id: string, @Body() updateDto: UpdateOfferDto, @Request() req) {
    return this.offerService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  async removeOffer(@Param('id') id: string, @Request() req) {
    return this.offerService.remove(id, req.user.id);
  }

  @Post(':id/withdraw')
  async withdrawOffer(@Param('id') id: string, @Body() withdrawDto: { reason?: string }, @Request() req) {
    return this.offerService.withdraw(id, req.user.id, withdrawDto.reason);
  }

  @Post(':id/counter-offer')
  async createCounterOffer(
    @Param('id') id: string,
    @Body() counterOfferDto: any,
    @Request() req
  ) {
    return this.offerService.createCounterOffer(id, counterOfferDto, req.user.id);
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
    return this.offerService.uploadDocument(id, uploadDto, req.user.id);
  }

  @Get('sourcing-request/:requestId')
  async getOffersForSourcingRequest(@Param('requestId') requestId: string, @Request() req) {
    return this.offerService.getOffersForSourcingRequest(requestId, req.user.id);
  }

  @Patch(':id/withdraw')
  async withdrawOfferPatch(@Param('id') id: string, @Body() withdrawDto: { reason?: string }, @Request() req) {
    return this.offerService.withdraw(id, req.user.id, withdrawDto.reason);
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
}
