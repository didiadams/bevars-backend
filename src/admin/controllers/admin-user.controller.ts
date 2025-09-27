import { Controller, Get, Post, Put, Param, Query, Body, UseGuards, Request, ParseIntPipe, ParseBoolPipe } from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';
import { AdminGuard } from '../guards/admin.guard';
import { AdminUserService } from '../services/admin-user.service';
import { UserRole, UserStatus } from '../../user/entities/user.entity';

// DTOs for request validation
class ToggleUserStatusDto {
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}

class ToggleUserVerificationDto {
  @IsBoolean()
  @IsNotEmpty()
  isVerified: boolean;
}

class UpdateDocumentStatusDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

class UpdateBuyerDocumentStatusDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

class UpdateExporterVerificationStatusDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

class BulkUserActionDto {
  userIds: string[];
  action: 'activate' | 'deactivate' | 'verify' | 'unverify' | 'suspend';
}

class SearchUsersDto {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  isVerified?: boolean;
  page?: number;
  limit?: number;
}

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  // Get all users with pagination and filtering
  @Get()
  async getAllUsers(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('isVerified', new ParseBoolPipe({ optional: true })) isVerified?: boolean,
  ) {
    return this.adminUserService.getAllUsers(page, limit, role, status, isVerified);
  }

  // Get all exporters with pagination and filtering
  @Get('exporters')
  async getAllExporters(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('isVerified') isVerified?: boolean,
    @Query('search') search?: string,
  ) {
    return this.adminUserService.getAllExporters(page, limit, { verificationStatus, isVerified, search });
  }

  // Get all global buyers with pagination and filtering
  @Get('global-buyers')
  async getAllGlobalBuyers(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
    @Query('verificationTier') verificationTier?: string,
    @Query('isVerified') isVerified?: boolean,
    @Query('search') search?: string,
  ) {
    return this.adminUserService.getAllGlobalBuyers(page, limit, { verificationTier, isVerified, search });
  }

  // Search users with advanced filtering
  @Post('search')
  async searchUsers(@Body() searchDto: SearchUsersDto) {
    return this.adminUserService.searchUsers(searchDto);
  }

  // Bulk user actions
  @Post('bulk-action')
  async bulkUserAction(
    @Body() dto: BulkUserActionDto,
    @Request() req: any,
  ) {
    return this.adminUserService.bulkUserAction(
      dto.userIds,
      dto.action,
      req.user.sub
    );
  }

  // Export users data
  @Get('export')
  async exportUsers(
    @Query('format') format: 'csv' | 'excel' = 'csv',
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
  ) {
    return this.adminUserService.exportUsers(format, { role, status });
  }

  // Debug route for exporters
  @Get('debug/exporters')
  async debugExporters() {
    return this.adminUserService.debugGetAllExporters();
  }

  // Get user by ID - MUST BE AFTER specific routes
  @Get(':id')
  async getUserById(@Param('id') userId: string) {
    return this.adminUserService.getUserById(userId);
  }

  // Get user details with additional info
  @Get(':id/details')
  async getUserDetails(@Param('id') userId: string) {
    return this.adminUserService.getUserById(userId);
  }

  // Toggle user active status
  @Put(':id/toggle-status')
  async toggleUserStatus(
    @Param('id') userId: string,
    @Body() dto: ToggleUserStatusDto,
    @Request() req: any,
  ) {
    return this.adminUserService.toggleUserStatus(userId, dto.isActive, req.user.sub);
  }

  // Toggle user verification
  @Put(':id/toggle-verification')
  async toggleUserVerification(
    @Param('id') userId: string,
    @Body() dto: ToggleUserVerificationDto,
    @Request() req: any,
  ) {
    return this.adminUserService.toggleUserVerification(userId, dto.isVerified, req.user.sub);
  }

  // Get all pending verification documents (both buyer and exporter)
  @Get('documents/pending')
  async getAllPendingDocuments(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return this.adminUserService.getAllPendingDocuments(page, limit);
  }

  // Get verification documents (legacy endpoint for buyer documents only)
  @Get('documents/verification')
  async getVerificationDocuments(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
    @Query('status') status?: string,
  ) {
    return this.adminUserService.getVerificationDocuments(page, limit, status);
  }

  // Get document details
  @Get('documents/:id/details')
  async getDocumentDetails(
    @Param('id') documentId: string,
    @Query('type') type: 'buyer' | 'exporter',
  ) {
    return this.adminUserService.getDocumentDetails(documentId, type);
  }

  // Update buyer document verification status
  @Put('documents/buyer/:id/status')
  async updateBuyerDocumentStatus(
    @Param('id') buyerId: string,
    @Body() dto: UpdateBuyerDocumentStatusDto,
    @Request() req: any,
  ) {
    console.log('@@@Updating buyer document status:', { buyerId, status: dto.status, rejectionReason: dto.rejectionReason });
    return this.adminUserService.updateBuyerDocumentStatus(
      buyerId, 
      dto.status, 
      req.user.sub, 
      dto.rejectionReason
    );
  }


  // Update exporter verification status
  @Put('documents/exporter/:id/status')
  async updateExporterVerificationStatus(
    @Param('id') exporterId: string,
    @Body() dto: UpdateExporterVerificationStatusDto,
    @Request() req: any,
  ) {
    console.log('Updating exporter verification status:', { exporterId, status: dto.status, rejectionReason: dto.rejectionReason });
    return this.adminUserService.updateExporterVerificationStatus(
      exporterId, 
      dto.status, 
      req.user.sub, 
      dto.rejectionReason
    );
  }

  // Update document verification status (legacy endpoint)
  @Put('documents/:id/status')
  async updateDocumentStatus(
    @Param('id') documentId: string,
    @Body() dto: UpdateDocumentStatusDto,
    @Request() req: any,
  ) {
    // Default to buyer document for backward compatibility
    return this.adminUserService.updateBuyerDocumentStatus(
      documentId, 
      dto.status, 
      req.user.sub, 
      dto.rejectionReason
    );
  }
}