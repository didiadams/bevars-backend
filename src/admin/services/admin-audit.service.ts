import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Like } from 'typeorm';
import { EmailLog, EmailStatus } from '../../mail/entities/email-log.entity';

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(EmailLog)
    private emailLogsRepository: Repository<EmailLog>,
  ) {}

  // Log admin actions using the existing email_logs table for now
  // In production, you'd create a dedicated admin_audit_logs table
  async logAdminAction(adminId: string, action: string, details?: any) {
    try {
      await this.emailLogsRepository.save({
        email: `admin-${adminId}@system.local`,
        subject: `Admin Action: ${action}`,
        status: EmailStatus.SENT,
        metadata: {
          adminId,
          action,
          details,
          timestamp: new Date().toISOString(),
          userAgent: 'Admin Panel',
        },
        sentAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to log admin action:', error);
      // Don't throw error - logging should not break main functionality
    }
  }

  // Get admin activity logs
  async getAdminActivityLogs(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const [logs, total] = await this.emailLogsRepository.findAndCount({
      where: {
        email: Like('admin-%@system.local'),
      },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      logs: logs.map(log => ({
        id: log.id,
        adminId: log.metadata?.adminId,
        action: log.metadata?.action,
        details: log.metadata?.details,
        timestamp: log.sentAt || log.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get admin statistics
  async getAdminStats() {
    const totalActions = await this.emailLogsRepository.count({
      where: {
        email: Like('admin-%@system.local'),
      },
    });

    // Get actions from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActions = await this.emailLogsRepository.count({
      where: {
        email: Like('admin-%@system.local'),
        createdAt: MoreThanOrEqual(thirtyDaysAgo),
      },
    });

    return {
      totalActions,
      recentActions,
      lastActivityDate: new Date(),
    };
  }
}