
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, UsePipes, ValidationPipe, UploadedFile, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GlobalBuyerService } from './global-buyer.service';
import { CreateGlobalBuyerDto, UpdateGlobalBuyerDto, GlobalBuyerProfileDto } from './dto';
import { GlobalBuyer } from './entities/global-buyer.entity';
import { FileInterceptor } from '@nestjs/platform-express';


@Controller('global-buyer')
@UseGuards(JwtAuthGuard)
export class GlobalBuyerController {

  // List uploaded verification documents
  @Get('verification/documents')
  async listVerificationDocuments(@Request() req) {
    return this.globalBuyerService.listVerificationDocuments(req.user.id);
  }

  // Fetch a single verification document by documentId
  @Get('verification/documents/:documentId')
  async getVerificationDocument(
    @Param('documentId') documentId: string,
    @Request() req
  ) {
    return this.globalBuyerService.getVerificationDocument(req.user.id, documentId);
  }

  // Delete an uploaded verification document
  @Delete('verification/documents/:documentId')
  async deleteVerificationDocument(
    @Param('documentId') documentId: string,
    @Request() req
  ) {
    return this.globalBuyerService.deleteVerificationDocument(req.user.id, documentId);
  }
  constructor(private readonly globalBuyerService: GlobalBuyerService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async createGlobalBuyer(@Body() createDto: CreateGlobalBuyerDto, @Request() req): Promise<GlobalBuyer> {
    return this.globalBuyerService.create({
      ...createDto,
      userId: req.user.id,
    });
  }

  // Verification overview/status for dashboard
  @Get('verification/overview')
  async getVerificationOverview(@Request() req) {
    return this.globalBuyerService.getVerificationOverview(req.user.id);
  }

  // Upload verification document (real file upload to Cloudinary)
  @Post('verification/documents/:documentId')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max for mobile photos
    },
  }))
  async uploadVerificationDocument(
    @Param('documentId') documentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req
  ) {
    // Edge case: No file uploaded
    if (!file) {
      return { success: false, message: 'No file uploaded' };
    }
    return this.globalBuyerService.uploadVerificationDocument(
      req.user.id,
      documentId,
      file.originalname,
      file
    );
  }

  // Submit verification for review
  @Post('verification/submit')
  async submitVerification(@Request() req) {
    return this.globalBuyerService.submitVerification(req.user.id);
  }

  // Get verification messages (for chat/messages tab)
  @Get('verification/messages')
  async getVerificationMessages(@Request() req) {
    return this.globalBuyerService.getVerificationMessages(req.user.id);
  }

  // Add a message (for reviewer/system/buyer communication)
  @Post('verification/messages')
  async addVerificationMessage(
    @Body() body: { message: string; type?: string },
    @Request() req
  ) {
    // Edge case: Empty message
    if (!body.message || body.message.trim().length === 0) {
      return { success: false, message: 'Message cannot be empty' };
    }
    return this.globalBuyerService.addVerificationMessage(
      req.user.id,
      'buyer',
      body.message,
      body.type || 'info'
    );
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

  @Get('platform/stats')
  async getPlatformStats(): Promise<any> {
    return this.globalBuyerService.getPlatformStats();
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

  @Post('offers/:offerId/accept-counter')
  async acceptExporterCounter(
    @Param('offerId') offerId: string,
    @Request() req
  ): Promise<any> {
    return this.globalBuyerService.acceptExporterCounter(offerId, req.user.id);
  }

  @Post('offers/:offerId/counter-negotiate')
  @UsePipes(new ValidationPipe({ transform: true }))
  async counterNegotiateOffer(
    @Param('offerId') offerId: string,
    @Body() negotiationDto: any,
    @Request() req
  ): Promise<any> {
    return this.globalBuyerService.counterNegotiateOffer(offerId, req.user.id, negotiationDto);
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

  @Get('dashboard/notifications')
  async getDashboardNotifications(@Request() req) {
    return this.globalBuyerService.getDashboardNotifications(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<GlobalBuyer> {
    return this.globalBuyerService.findOne(id);
  }
}
