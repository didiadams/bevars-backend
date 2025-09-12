import { Controller, Get, Post, Put, Param, Query, Body, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';
import { AdminUserService } from '../services/admin-user.service';
import { UserRole, UserStatus } from '../../user/entities/user.entity';

// DTOs for request validation
class ToggleUserStatusDto {
  isActive: boolean;
}

class ToggleUserVerificationDto {
  isVerified: boolean;
}

class UpdateDocumentStatusDto {
  status: 'approved' | 'rejected';
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
  ) {
    return this.adminUserService.getAllUsers(page, limit, role, status);
  }

  // Get user by ID
  @Get(':id')
  async getUserById(@Param('id') userId: string) {
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

  // Get verification documents
  @Get('documents/verification')
  async getVerificationDocuments(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
    @Query('status') status?: string,
  ) {
    return this.adminUserService.getVerificationDocuments(page, limit, status);
  }

  // Update document verification status
  @Put('documents/:id/status')
  async updateDocumentStatus(
    @Param('id') documentId: string,
    @Body() dto: UpdateDocumentStatusDto,
    @Request() req: any,
  ) {
    return this.adminUserService.updateDocumentStatus(documentId, dto.status, req.user.sub);
  }
}