import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, HttpException, HttpStatus, forwardRef } from '@nestjs/common';
import { Repository, FindManyOptions, Between, In, DataSource, DeepPartial } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SourcingRequest, RequestStatus, UrgencyLevel, QualityStandards } from './entities/sourcing-request.entity';
import { ExporterService } from '../exporter/exporter.service';

@Injectable()
export class SourcingRequestService {
  constructor(
    @InjectRepository(SourcingRequest)
    private sourcingRequestRepository: Repository<SourcingRequest>,
    @Inject(forwardRef(() => ExporterService))
    private exporterService: ExporterService,
  ) {}

  async findAll(filters: {
    page?: number;
    limit?: number;
    category?: string;
    country?: string;
    minBudget?: number;
    maxBudget?: number;
    urgency?: string;
    search?: string;
    exporterUserId?: string; // Filter by exporter's primaryCrops
  }): Promise<{
    requests: SourcingRequest[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    // If exporterUserId is provided, get their productCategories, primaryCrops, and exportDestinations for filtering
    let exporterCategories: string[] = [];
    let exporterCrops: string[] = [];
    let exporterDestinations: string[] = [];
    if (filters.exporterUserId) {
      try {
        const exporter = await this.exporterService.findByUserId(filters.exporterUserId);
        exporterCategories = exporter?.productCategories || [];
        exporterCrops = exporter?.primaryCrops || [];
        exporterDestinations = exporter?.exportDestinations || [];
      } catch (error) {
        // If exporter not found, continue without filtering
        console.warn('Could not find exporter for filtering:', error.message);
      }
    }

    const queryBuilder = this.sourcingRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.globalBuyer', 'buyer')
      .leftJoinAndSelect('buyer.user', 'user')
      .where('request.status = :status', { status: RequestStatus.ACTIVE })
      .andWhere('request.isPublic = :isPublic', { isPublic: true });

    if (filters.category) {
      queryBuilder.andWhere('request.productCategory = :category', { category: filters.category });
    }

    if (filters.country) {
      queryBuilder.andWhere('request.deliveryCountry = :country', { country: filters.country });
    }

    if (filters.minBudget || filters.maxBudget) {
      if (filters.minBudget && filters.maxBudget) {
        queryBuilder.andWhere('request.budgetMin >= :minBudget AND request.budgetMax <= :maxBudget', {
          minBudget: filters.minBudget,
          maxBudget: filters.maxBudget,
        });
      } else if (filters.minBudget) {
        queryBuilder.andWhere('request.budgetMin >= :minBudget', { minBudget: filters.minBudget });
      } else if (filters.maxBudget) {
        queryBuilder.andWhere('request.budgetMax <= :maxBudget', { maxBudget: filters.maxBudget });
      }
    }

    if (filters.urgency) {
      queryBuilder.andWhere('request.urgencyLevel = :urgency', { urgency: filters.urgency });
    }

    // Smart filtering by exporter's productCategories and/or primaryCrops
    // This ensures exporters only see requests relevant to their products
    const hasCategories = exporterCategories.length > 0;
    const hasCrops = exporterCrops.length > 0;
    
    if (hasCategories || hasCrops) {
      const conditions: string[] = [];
      const params: Record<string, string> = {};
      
      // Match by productCategory (direct category match)
      if (hasCategories) {
        const categoryConditions = exporterCategories.map((_, index) => 
          `LOWER(request.productCategory) = LOWER(:cat${index})`
        ).join(' OR ');
        
        exporterCategories.forEach((cat, index) => {
          params[`cat${index}`] = cat.replace(/_/g, ' ');
        });
        
        conditions.push(`(${categoryConditions})`);
      }
      
      // Match by productName against primaryCrops (keyword match)
      if (hasCrops) {
        const cropConditions = exporterCrops.map((_, index) => 
          `LOWER(request.productName) LIKE LOWER(:crop${index})`
        ).join(' OR ');
        
        exporterCrops.forEach((crop, index) => {
          params[`crop${index}`] = `%${crop.replace(/_/g, ' ')}%`;
        });
        
        conditions.push(`(${cropConditions})`);
      }
      
      // Combine with OR - request matches if it fits any category OR any crop
      queryBuilder.andWhere(`(${conditions.join(' OR ')})`, params);
    }

    // Filter by exporter's export destinations (countries they can ship to)
    // Only show requests where the deliveryCountry is in exporter's exportDestinations
    if (exporterDestinations.length > 0) {
      const destinationConditions = exporterDestinations.map((_, index) => 
        `LOWER(request.deliveryCountry) = LOWER(:dest${index})`
      ).join(' OR ');
      
      const destParams: Record<string, string> = {};
      exporterDestinations.forEach((dest, index) => {
        destParams[`dest${index}`] = dest;
      });
      
      queryBuilder.andWhere(`(${destinationConditions})`, destParams);
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(request.title ILIKE :search OR request.description ILIKE :search OR request.productName ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    const [requests, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('request.urgencyLevel', 'DESC')
      .addOrderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    // sanitize nested user objects before returning
    const safeRequests = requests.map(r => ({
      ...r,
      globalBuyer: r.globalBuyer ? ({
        ...r.globalBuyer,
        user: r.globalBuyer.user ? ({
          id: r.globalBuyer.user.id,
          email: r.globalBuyer.user.email,
          firstName: r.globalBuyer.user.firstName,
          lastName: r.globalBuyer.user.lastName,
          companyName: r.globalBuyer.user.companyName,
          role: r.globalBuyer.user.role,
          isVerified: r.globalBuyer.user.isVerified,
          isActive: r.globalBuyer.user.isActive,
          status: r.globalBuyer.user.status,
          phoneNumber: r.globalBuyer.user.phoneNumber,
          countryName: r.globalBuyer.user.countryName,
        }) : null,
      }) : null,
    } as any));

    return {
      requests: safeRequests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFeatured(): Promise<SourcingRequest[]> {
    return await this.sourcingRequestRepository.find({
      where: {
        status: RequestStatus.ACTIVE,
        isPublic: true,
        urgencyLevel: In([UrgencyLevel.HIGH, UrgencyLevel.URGENT]),
      },
      relations: ['globalBuyer', 'globalBuyer.user'],
      order: { createdAt: 'DESC' },
      take: 6,
    });
  }

  async getCategories(): Promise<{ category: string; count: number }[]> {
    const result = await this.sourcingRequestRepository
      .createQueryBuilder('request')
      .select('request.productCategory', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('request.status = :status', { status: RequestStatus.ACTIVE })
      .andWhere('request.isPublic = :isPublic', { isPublic: true })
      .groupBy('request.productCategory')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map(item => ({
      category: item.category,
      count: parseInt(item.count),
    }));
  }

  async findOne(id: string, userId?: string): Promise<SourcingRequest> {
    const request = await this.sourcingRequestRepository.findOne({
      where: { id },
      relations: ['globalBuyer', 'globalBuyer.user', 'offers', 'offers.exporter', 'offers.exporter.user'],
    });

    if (!request) {
      throw new NotFoundException(`Sourcing request with ID ${id} not found`);
    }

    // If it's a private request, check if the user has access
    if (!request.isPublic && userId) {
      const hasAccess = 
        request.globalBuyerId === userId || 
        request.invitedExporters?.includes(userId);
      
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this sourcing request');
      }
    }

    // Increment view count if it's a public request or user has access
    if (request.isPublic || userId) {
      await this.sourcingRequestRepository.increment({ id }, 'viewCount', 1);
    }

    return request;
  }

  async create(createDto: any): Promise<SourcingRequest> {
    // Business rule: disallow creating another sourcing request if the buyer already
    // has a pending/active sourcing request. This prevents multiple open requests.
    const existingActive = await this.sourcingRequestRepository.count({
      where: {
        globalBuyerId: createDto.globalBuyerId,
        status: RequestStatus.ACTIVE,
      },
    });

    if (existingActive >= 1) {
      // 409 Conflict indicates the request cannot be completed due to current state
      throw new HttpException(
        { message: 'You already have a pending sourcing request', errorCode: 'ACTIVE_REQUEST_EXISTS' },
        HttpStatus.CONFLICT,
      );
    }

    const request = this.sourcingRequestRepository.create({
      ...createDto,
      status: RequestStatus.ACTIVE,
      isPublic: createDto.isPublic !== false, // Default to true unless explicitly set to false
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const saved = await this.sourcingRequestRepository.save(request as DeepPartial<SourcingRequest>);
      return saved as SourcingRequest;
    } catch (err: any) {
      // Handle unique constraint violation (e.g., concurrent create) - Postgres code 23505
      if (err?.code === '23505') {
        throw new HttpException(
          { message: 'You already have a pending sourcing request', errorCode: 'ACTIVE_REQUEST_EXISTS' },
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async update(id: string, updateDto: any, userId: string): Promise<SourcingRequest> {
    const request = await this.findOne(id);

    // Check if user owns this request
    if (request.globalBuyerId !== userId) {
      throw new ForbiddenException('You can only update your own sourcing requests');
    }

    // Prevent changing productName or currency once offers exist
    if ((request.offerCount || 0) > 0) {
      if (updateDto.productName && updateDto.productName !== request.productName) {
        throw new HttpException(
          { message: 'Cannot change product name after offers have been made', errorCode: 'CANNOT_CHANGE_PRODUCT_NAME' },
          HttpStatus.CONFLICT,
        );
      }
      if (updateDto.currency && updateDto.currency !== request.currency) {
        throw new HttpException(
          { message: 'Cannot change currency after offers have been made', errorCode: 'CANNOT_CHANGE_CURRENCY' },
          HttpStatus.CONFLICT,
        );
      }
    }

  Object.assign(request, updateDto);
  request.updatedAt = new Date();

    const updated = await this.sourcingRequestRepository.save(request as DeepPartial<SourcingRequest>);
    return updated as SourcingRequest;
  }

  async remove(id: string, userId: string): Promise<void> {
    const request = await this.findOne(id);

    // Check if user owns this request
    if (request.globalBuyerId !== userId) {
      throw new ForbiddenException('You can only delete your own sourcing requests');
    }

    await this.sourcingRequestRepository.remove(request);
  }

  async close(id: string, userId: string): Promise<SourcingRequest> {
    const request = await this.findOne(id);

    // Check if user owns this request
    if (request.globalBuyerId !== userId) {
      throw new ForbiddenException('You can only close your own sourcing requests');
    }

    request.status = RequestStatus.CLOSED;
    request.updatedAt = new Date();

    const closed = await this.sourcingRequestRepository.save(request as DeepPartial<SourcingRequest>);
    return closed as SourcingRequest;
  }

  async extendDeadline(
    id: string,
    extendDto: { newDeadline: string; reason?: string },
    userId: string
  ): Promise<SourcingRequest> {
    const request = await this.findOne(id);

    // Check if user owns this request
    if (request.globalBuyerId !== userId) {
      throw new ForbiddenException('You can only extend deadlines for your own sourcing requests');
    }

    const newDeadline = new Date(extendDto.newDeadline);
    if (newDeadline <= new Date()) {
      throw new BadRequestException('New deadline must be in the future');
    }

    request.quotationDeadline = newDeadline;
    request.updatedAt = new Date();

    // You could also log the reason for deadline extension
    if (extendDto.reason) {
      request.additionalNotes = `${request.additionalNotes || ''}\n\nDeadline extended: ${extendDto.reason}`;
    }

    return await this.sourcingRequestRepository.save(request) as any as SourcingRequest;
  }

  async inviteExporter(
    id: string,
    inviteDto: { exporterId: string; message?: string },
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const request = await this.findOne(id);

    // Check if user owns this request
    if (request.globalBuyerId !== userId) {
      throw new ForbiddenException('You can only invite exporters to your own sourcing requests');
    }

    // Add exporter to invited list if not already invited
    const invitedExporters = request.invitedExporters || [];
    if (!invitedExporters.includes(inviteDto.exporterId)) {
      invitedExporters.push(inviteDto.exporterId);
      request.invitedExporters = invitedExporters;
      request.updatedAt = new Date();

      await this.sourcingRequestRepository.save(request) as any;

      // Here you would typically send a notification to the exporter
      // await this.notificationService.notifyExporterInvitation(inviteDto.exporterId, request, inviteDto.message);

      return {
        success: true,
        message: 'Exporter invited successfully'
      };
    }

    return {
      success: false,
      message: 'Exporter already invited'
    };
  }

  async getOffers(id: string, userId?: string): Promise<any[]> {
    const request = await this.findOne(id, userId);

    // Return offers with exporter details
    return await this.sourcingRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.offers', 'offer')
      .leftJoinAndSelect('offer.exporter', 'exporter')
      .leftJoinAndSelect('exporter.user', 'user')
      .where('request.id = :id', { id })
      .getOne()
      .then(req => req?.offers || []);
  }

  async getAnalytics(id: string, userId: string): Promise<{
    viewCount: number;
    offerCount: number;
    averageOfferPrice: number;
    responseRate: number;
    timeRemaining: number;
  }> {
    const request = await this.findOne(id);

    // Check if user owns this request
    if (request.globalBuyerId !== userId) {
      throw new ForbiddenException('You can only view analytics for your own sourcing requests');
    }

    const offers = await this.getOffers(id, userId);
    
    const averageOfferPrice = offers.length > 0 
      ? offers.reduce((sum, offer) => sum + offer.totalPrice, 0) / offers.length 
      : 0;

    const timeRemaining = Math.max(0, 
      new Date(request.quotationDeadline).getTime() - new Date().getTime()
    ) / (1000 * 60 * 60 * 24); // days remaining

    const responseRate = request.viewCount > 0 ? (offers.length / request.viewCount) * 100 : 0;

    return {
      viewCount: request.viewCount,
      offerCount: request.offerCount,
      averageOfferPrice,
      responseRate: Math.round(responseRate * 100) / 100,
      timeRemaining: Math.round(timeRemaining * 100) / 100,
    };
  }

  // Additional utility methods
  async incrementOfferCount(requestId: string): Promise<void> {
    await this.sourcingRequestRepository.increment({ id: requestId }, 'offerCount', 1);
  }

  async decrementOfferCount(requestId: string): Promise<void> {
    await this.sourcingRequestRepository.decrement({ id: requestId }, 'offerCount', 1);
  }

  async syncOfferCounts(): Promise<void> {
    const requests = await this.sourcingRequestRepository.find({
      relations: ['offers'],
    });

    for (const request of requests) {
      const actualOfferCount = request.offers?.length || 0;
      if (request.offerCount !== actualOfferCount) {
        await this.sourcingRequestRepository.update(request.id, {
          offerCount: actualOfferCount,
        });
      }
    }
  }

  async getMyRequests(userId: string, status?: RequestStatus): Promise<SourcingRequest[]> {
    const where: any = { globalBuyerId: userId };
    if (status) {
      where.status = status;
    }

    return await this.sourcingRequestRepository.find({
      where,
      relations: ['offers'],
      order: { createdAt: 'DESC' },
    });
  }

  async getExpiredRequests(): Promise<SourcingRequest[]> {
    return await this.sourcingRequestRepository.find({
      where: {
        status: RequestStatus.ACTIVE,
        quotationDeadline: Between(new Date('1900-01-01'), new Date()),
      },
    });
  }

  async markAsExpired(id: string): Promise<void> {
    await this.sourcingRequestRepository.update(id, {
      status: RequestStatus.EXPIRED,
      updatedAt: new Date(),
    });
  }
}
