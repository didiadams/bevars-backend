import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExporterService } from './exporter.service';
import { CreateExporterDto } from './dto/create-exporter.dto';
import { UpdateExporterDto } from './dto/update-exporter.dto';
import { UploadVerificationDocumentsDto } from './dto/upload-verification-documents.dto';


@Controller('api/v1/exporter')
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

  @Put('verification/submit')
  async submitForVerification(@Request() req) {
    const exporter = await this.exporterService.findByUserId(req.user.id);
    return this.exporterService.submitForVerification(exporter.id);
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
}
