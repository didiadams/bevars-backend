import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { AdminUserService } from '../services/admin-user.service';
import { AdminAuditService } from '../services/admin-audit.service';
import { SourcingRequestService } from '../../sourcing-request/sourcing-request.service';
import { OfferService } from '../../offer/offer.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly sourcingRequestService: SourcingRequestService,
    private readonly offerService: OfferService,
    private readonly adminUserService: AdminUserService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  // ADMIN ROUTES
  @Get('admin/stats')
  @UseGuards(AdminGuard)
  async getAdminDashboardStats() {
    return this.adminUserService.getDashboardStats();
  }

  @Get('admin/activities')
  @UseGuards(AdminGuard)
  async getAdminRecentActivities() {
    return this.adminAuditService.getAdminActivityLogs(1, 10);
  }

  // EXISTING USER ROUTES
  @Get('global-buyer/analytics')
  @UseGuards(JwtAuthGuard)
  async getGlobalBuyerAnalytics(@Request() req) {
    const userId = req.user.globalBuyerId || req.user.id;
    
    // Get user's sourcing requests
    const myRequests = await this.sourcingRequestService.getMyRequests(userId);
    
    // Calculate analytics
    const totalRequests = myRequests.length;
    const activeRequests = myRequests.filter(r => r.status === 'active').length;
    const totalOffers = myRequests.reduce((sum, r) => sum + r.offerCount, 0);
    const avgOffersPerRequest = totalRequests > 0 ? totalOffers / totalRequests : 0;
    
    // Get recent activity
    const recentRequests = myRequests.slice(0, 5);
    
    return {
      totalRequests,
      activeRequests,
      closedRequests: myRequests.filter(r => r.status === 'closed').length,
      totalOffers,
      avgOffersPerRequest: Math.round(avgOffersPerRequest * 100) / 100,
      recentRequests: recentRequests.map(r => ({
        id: r.id,
        title: r.title,
        status: r.status,
        offerCount: r.offerCount,
        createdAt: r.createdAt,
        quotationDeadline: r.quotationDeadline,
      })),
    };
  }

  @Get('exporter/analytics')
  @UseGuards(JwtAuthGuard)
  async getExporterAnalytics(@Request() req) {
    const userId = req.user.exporterId || req.user.id;
    
    // Get exporter's offer statistics
    const offerStats = await this.offerService.getOfferStatistics(userId);
    const myOffers = await this.offerService.getExporterOffers(userId);
    
    // Calculate success rate
    const successRate = offerStats.totalOffers > 0 
      ? (offerStats.acceptedOffers / offerStats.totalOffers) * 100 
      : 0;
    
    return {
      ...offerStats,
      successRate: Math.round(successRate * 100) / 100,
      recentOffers: myOffers.slice(0, 5).map(o => ({
        id: o.id,
        sourcingRequestTitle: o.sourcingRequest?.title,
        status: o.status,
        totalPrice: o.totalPrice,
        createdAt: o.createdAt,
      })),
    };
  }

  @Get('sourcing-requests')
  @UseGuards(JwtAuthGuard)
  async getDashboardSourcingRequests(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string
  ) {
    const userId = req.user.globalBuyerId || req.user.id;
    
    if (req.user.role === 'global-buyer') {
      // Get user's own sourcing requests
      const requests = await this.sourcingRequestService.getMyRequests(userId, status as any);
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedRequests = requests.slice(startIndex, endIndex);
      
      return {
        requests: paginatedRequests,
        total: requests.length,
        page,
        totalPages: Math.ceil(requests.length / limit),
      };
    } else {
      // For exporters, get public sourcing requests
      return this.sourcingRequestService.findAll({
        page,
        limit,
      });
    }
  }

  @Get('offers')
  @UseGuards(JwtAuthGuard)
  async getDashboardOffers(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string
  ) {
    const userId = req.user.exporterId || req.user.globalBuyerId || req.user.id;
    
    if (req.user.role === 'exporter') {
      // Get exporter's offers
      const offers = await this.offerService.getExporterOffers(userId, status);
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedOffers = offers.slice(startIndex, endIndex);
      
      return {
        offers: paginatedOffers,
        total: offers.length,
        page,
        totalPages: Math.ceil(offers.length / limit),
      };
    } else {
      // For global buyers, get offers received on their sourcing requests
      // This would require a new method in OfferService
      return {
        offers: [],
        total: 0,
        page,
        totalPages: 0,
      };
    }
  }

  @Get('market-insights')
  @UseGuards(JwtAuthGuard)
  async getMarketInsights() {
    // Get featured sourcing requests as market insights
    const featuredRequests = await this.sourcingRequestService.getFeatured();
    const categories = await this.sourcingRequestService.getCategories();
    
    return {
      featuredRequests: featuredRequests.slice(0, 3),
      topCategories: categories.slice(0, 5),
      marketTrends: [
        {
          category: 'Agricultural Products',
          trend: 'up',
          percentage: '+12%',
          description: 'Increased demand for organic products',
        },
        {
          category: 'Technology',
          trend: 'stable',
          percentage: '+2%',
          description: 'Steady growth in tech exports',
        },
      ],
    };
  }

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  async getNotifications(@Request() req) {
    // Mock notifications for now - in a real app, you'd have a notifications service
    const notifications = [
      {
        id: '1',
        type: 'offer_received',
        title: 'New offer received',
        message: 'You received a new offer for your sourcing request',
        isRead: false,
        createdAt: new Date(),
      },
      {
        id: '2',
        type: 'request_expires_soon',
        title: 'Sourcing request expires soon',
        message: 'Your sourcing request will expire in 2 days',
        isRead: false,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ];
    
    return {
      notifications,
      unreadCount: notifications.filter(n => !n.isRead).length,
    };
  }

  @Get('profile-completion')
  @UseGuards(JwtAuthGuard)
  async getProfileCompletion(@Request() req) {
    // Calculate profile completion percentage
    const user = req.user;
    const completionFields = [
      'firstName',
      'lastName', 
      'email',
      'phone',
      'companyName',
      'country',
    ];
    
    const completedFields = completionFields.filter(field => user[field]);
    const completionPercentage = (completedFields.length / completionFields.length) * 100;
    
    return {
      percentage: Math.round(completionPercentage),
      missingFields: completionFields.filter(field => !user[field]),
      suggestions: [
        'Complete your profile to increase trust with potential partners',
        'Add a company description to stand out',
        'Upload verification documents for better credibility',
      ],
    };
  }
}
