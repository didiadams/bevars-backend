import { Controller, Get, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';
import { AdminAuditService } from '../services/admin-audit.service';

@Controller('admin/audit')
@UseGuards(AdminGuard)
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  // Get admin activity logs
  @Get('logs')
  async getActivityLogs(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return this.auditService.getAdminActivityLogs(page, limit);
  }

  // Get admin statistics
  @Get('stats')
  async getAuditStats() {
    return this.auditService.getAdminStats();
  }
}