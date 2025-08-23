import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GlobalBuyerService } from './global-buyer.service';
import { CreateGlobalBuyerDto, UpdateGlobalBuyerDto, GlobalBuyerProfileDto } from './dto';
import { GlobalBuyer } from './entities/global-buyer.entity';


@Controller('api/v1/global-buyer')
@UseGuards(JwtAuthGuard)
export class GlobalBuyerController {
  constructor(private readonly globalBuyerService: GlobalBuyerService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async createGlobalBuyer(@Body() createDto: CreateGlobalBuyerDto, @Request() req): Promise<GlobalBuyer> {
    return this.globalBuyerService.create({
      ...createDto,
      userId: req.user.id,
    });
  }

  @Get('profile')
  async getGlobalBuyerProfile(@Request() req): Promise<GlobalBuyer> {
    return this.globalBuyerService.findByUserId(req.user.id);
  }

  @Put('profile')
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateGlobalBuyerProfile(@Body() updateDto: UpdateGlobalBuyerDto, @Request() req): Promise<GlobalBuyer> {
    return this.globalBuyerService.updateByUserId(req.user.id, updateDto);
  }

  @Get('dashboard/stats')
  async getDashboardStats(@Request() req): Promise<any> {
    return this.globalBuyerService.getDashboardStats(req.user.id);
  }

  @Get('sourcing-requests')
  async getMySourcingRequests(@Request() req): Promise<any[]> {
    return this.globalBuyerService.getMySourcingRequests(req.user.id);
  }

  @Get('received-offers')
  async getReceivedOffers(@Request() req): Promise<any[]> {
    return this.globalBuyerService.getReceivedOffers(req.user.id);
  }

  @Post('offers/:offerId/accept')
  async acceptOffer(@Param('offerId') offerId: string, @Request() req): Promise<any> {
    return this.globalBuyerService.acceptOffer(offerId, req.user.id);
  }

  @Post('offers/:offerId/reject')
  @UsePipes(new ValidationPipe({ transform: true }))
  async rejectOffer(
    @Param('offerId') offerId: string,
    @Body() rejectDto: { reason?: string },
    @Request() req
  ): Promise<any> {
    return this.globalBuyerService.rejectOffer(offerId, req.user.id, rejectDto.reason);
  }

  @Post('offers/:offerId/negotiate')
  @UsePipes(new ValidationPipe({ transform: true }))
  async negotiateOffer(
    @Param('offerId') offerId: string,
    @Body() negotiationDto: any,
    @Request() req
  ): Promise<any> {
    return this.globalBuyerService.negotiateOffer(offerId, req.user.id, negotiationDto);
  }

  @Get('preferred-exporters')
  async getPreferredExporters(@Request() req): Promise<any[]> {
    return this.globalBuyerService.getPreferredExporters(req.user.id);
  }

  @Post('preferred-exporters/:exporterId')
  async addToPreferred(@Param('exporterId') exporterId: string, @Request() req): Promise<any> {
    return this.globalBuyerService.addToPreferred(req.user.id, exporterId);
  }

  @Delete('preferred-exporters/:exporterId')
  async removeFromPreferred(@Param('exporterId') exporterId: string, @Request() req): Promise<any> {
    return this.globalBuyerService.removeFromPreferred(req.user.id, exporterId);
  }

  @Put('payment-info')
  @UsePipes(new ValidationPipe({ transform: true }))
  async updatePaymentInfo(@Body() paymentInfo: any, @Request() req): Promise<GlobalBuyer> {
    return this.globalBuyerService.updatePaymentInfo(req.user.id, paymentInfo);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<GlobalBuyer> {
    return this.globalBuyerService.findOne(id);
  }
}
