import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Patch, UploadedFile, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExporterService } from './exporter.service';
import { CreateExporterDto } from './dto/create-exporter.dto';
import { UpdateExporterDto } from './dto/update-exporter.dto';
import { UploadVerificationDocumentsDto } from './dto/upload-verification-documents.dto';
import { FileInterceptor } from '@nestjs/platform-express';


@Controller('exporter')
@UseGuards(JwtAuthGuard)
export class ExporterController {
  constructor(private readonly exporterService: ExporterService) {}

  @Post()
  async createExporter(@Body() createExporterDto: CreateExporterDto, @Request() req) {
    return this.exporterService.create({
      ...createExporterDto,
      userId: req.user.id,
    });
  }

  @Get('profile/:userId')
  async getExporterProfileById(@Param('userId') userId: string) {
    return this.exporterService.findByUserId(userId);
  }

  @Get('profile')
  async getExporterProfile(@Request() req) {
    return this.exporterService.findByUserId(req.user.id);
  }

  @Patch('profile/:userId')
  async updateExporterProfileById(@Param('userId') userId: string, @Body() updateExporterDto: UpdateExporterDto, @Request() req) {
    // Only allow users to update their own profile or admin override
    if (userId !== req.user.id && !req.user.isAdmin) {
      throw new Error('Unauthorized to update this profile');
    }
    return this.exporterService.updateByUserId(userId, updateExporterDto);
  }

  @Put('profile')
  async updateExporterProfile(@Body() updateExporterDto: UpdateExporterDto, @Request() req) {
    return this.exporterService.updateByUserId(req.user.id, updateExporterDto);
  }

  @Put('crops')
  async updateExporterCrops(
    @Body() body: { crops: string[] },
    @Request() req,
  ) {
    return this.exporterService.updateCropsByUserId(req.user.id, body.crops || []);
  }

  @Post('verification/upload')
  async uploadVerificationDocument(
    @Body() uploadDto: any,
    @Request() req
  ) {
    // Handle file upload for verification documents
    return this.exporterService.uploadVerificationDocuments(req.user.id, uploadDto);
  }

  @Post('verification/documents')
  async uploadVerificationDocuments(
    @Body() uploadDto: UploadVerificationDocumentsDto,
    @Request() req
  ) {
    return this.exporterService.uploadVerificationDocuments(req.user.id, uploadDto.documents);
  }

  // Upload a single verification document file (multipart)
  @Post('verification/documents/:documentType')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max for mobile photos
    },
  }))
  async uploadVerificationDocumentFile(
    @Param('documentType') documentType: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req
  ) {
    let exporter;
    try {
      exporter = await this.exporterService.findByUserId(req.user.id);
    } catch (err) {
      // If exporter record doesn't exist, create a minimal one so uploads can proceed.
      // This avoids failing uploads for users who haven't completed their profile yet.
      console.info(`[ExporterController] No exporter profile for user ${req.user.id}, creating minimal exporter record`);
      const minimalDto = {
        companyName: req.user.companyName || `Exporter ${req.user.id.slice(0, 8)}`,
        companyRegistrationNumber: `auto-${req.user.id.slice(0, 8)}`,
        businessAddress: req.user.businessAddress || '',
        businessEmail: req.user.email || '',
        businessPhone: req.user.phoneNumber || '',
        contactPersonName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || 'Unknown',
        contactPersonTitle: '',
        contactPersonEmail: req.user.email || '',
        contactPersonPhone: req.user.phoneNumber || '',
        productCategories: [],
        exportDestinations: [],
        userId: req.user.id,
      };
      exporter = await this.exporterService.create(minimalDto as any);
    }

    return this.exporterService.uploadVerificationDocument(exporter.id, documentType, file);
  }

  // List uploaded verification documents
  @Get('verification/documents')
  async listVerificationDocuments(@Request() req) {
    return this.exporterService.listVerificationDocuments(req.user.id);
  }

  // Fetch a single verification document by documentId
  @Get('verification/documents/:documentId')
  async getVerificationDocument(
    @Param('documentId') documentId: string,
    @Request() req
  ) {
    return this.exporterService.getVerificationDocument(req.user.id, documentId);
  }

  // Delete an uploaded verification document
  @Delete('verification/documents/:documentId')
  async deleteVerificationDocument(
    @Param('documentId') documentId: string,
    @Request() req
  ) {
    return this.exporterService.deleteVerificationDocument(req.user.id, documentId);
  }

  // Verification overview/status for dashboard
  @Get('verification/overview')
  async getVerificationOverview(@Request() req) {
    return this.exporterService.getVerificationOverview(req.user.id);
  }

  @Put('verification/submit')
  async submitForVerification(@Request() req) {
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return this.exporterService.submitForVerification(exporter.id);
  }

  // Dashboard endpoints
  @Get('dashboard/stats')
  async getDashboardStats(@Request() req) {
    return this.exporterService.getDashboardStats(req.user.id);
  }

  @Get('dashboard/requests')
  async getDashboardRequests(@Request() req) {
    return this.exporterService.getDashboardRequests(req.user.id);
  }

  @Get('dashboard/offers')
  async getDashboardOffers(@Request() req) {
    return this.exporterService.getDashboardOffers(req.user.id);
  }

  @Get('negotiated-offers')
  async getNegotiatedOffers(@Request() req) {
    return this.exporterService.getNegotiatedOffers(req.user.id);
  }

  @Get('dashboard/activity')
  async getDashboardActivity(@Request() req) {
    return this.exporterService.getDashboardActivity(req.user.id);
  }

  @Get('dashboard/notifications')
  async getDashboardNotifications(@Request() req) {
    return this.exporterService.getDashboardNotifications(req.user.id);
  }

  @Get('request/:requestId/offers')
  async getRequestOffers(@Param('requestId') requestId: string, @Request() req) {
    return this.exporterService.getRequestOffers(requestId, req.user.id);
  }

  @Get('request/:requestId/my-offer')
  async getMyOfferForRequest(@Param('requestId') requestId: string, @Request() req) {
    return this.exporterService.getMyOfferForRequest(requestId, req.user.id);
  }

  @Get('offer/:offerId')
  async getOfferById(@Param('offerId') offerId: string, @Request() req) {
    return this.exporterService.getOfferById(offerId, req.user.id);
  }

  @Get('stats/total')
  async getTotalExportersCount() {
    return this.exporterService.getTotalExportersCount();
  }

  @Get()
  async findAllExporters(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('category') category?: string,
    @Query('country') country?: string,
    @Query('verified') verified?: boolean,
    @Query('search') search?: string,
  ) {
    return this.exporterService.findAllWithFilters({
      page,
      limit,
      category,
      country,
      verified,
      search,
    });
  }

  @Get(':exporterId/offers')
  async getExporterOffers(@Param('exporterId') exporterId: string) {
    return this.exporterService.getExporterOffers(exporterId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.exporterService.findOne(id);
  }

  @Get(':id/stats')
  async getExporterStats(@Param('id') id: string) {
    return this.exporterService.getExporterStats(id);
  }

  @Post(':id/rate')
  async rateExporter(
    @Param('id') exporterId: string,
    @Body() ratingDto: { rating: number; comment?: string },
    @Request() req
  ) {
    return this.exporterService.rateExporter(exporterId, req.user.id, ratingDto);
  }

  // ============ BANK DETAILS ============

  @Get('my-bank-details')
  async getMyBankDetails(@Request() req) {
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return {
      success: true,
      data: {
        bankName: exporter.bankName || null,
        bankCode: exporter.bankCode || null,
        accountNumber: exporter.accountNumber || null,
        accountName: exporter.accountName || null,
        bankVerified: exporter.bankVerified || false,
      },
    };
  }

  @Patch('bank-details')
  async updateBankDetails(
    @Body() bankDetails: {
      bankName: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
    },
    @Request() req
  ) {
    const exporter = await this.exporterService.findByUserId(req.user.id);
    const updated = await this.exporterService.update(exporter.id, {
      bankName: bankDetails.bankName,
      bankCode: bankDetails.bankCode,
      accountNumber: bankDetails.accountNumber,
      accountName: bankDetails.accountName,
      bankVerified: true, // Mark as verified since this comes after account verification
    });
    return {
      success: true,
      data: {
        bankName: updated.bankName,
        bankCode: updated.bankCode,
        accountNumber: updated.accountNumber,
        accountName: updated.accountName,
        bankVerified: updated.bankVerified,
      },
    };
  }
}
