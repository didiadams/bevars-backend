import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Exporter, VerificationStatus, ExporterCategory } from './entities/exporter.entity';
import { CreateExporterDto } from './dto/create-exporter.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateExporterDto } from './dto/update-exporter.dto';
import { VerifyExporterDto } from './dto/verify-exporter.dto';
import { SourcingRequest, RequestStatus } from '../sourcing-request/entities/sourcing-request.entity';
import { Offer, OfferStatus } from '../offer/entities/offer.entity';

@Injectable()
export class ExporterService {
  constructor(
    @InjectRepository(Exporter)
    private exporterRepository: Repository<Exporter>,
    @InjectRepository(SourcingRequest)
    private sourcingRequestRepository: Repository<SourcingRequest>,
    @InjectRepository(Offer)
    private offerRepository: Repository<Offer>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(createExporterDto: CreateExporterDto & { userId?: string }): Promise<Exporter> {
    // Map the DTO properties to match the entity
    const exporterData = {
      userId: createExporterDto.userId,
      companyRegistrationNumber: createExporterDto.companyRegistrationNumber,
      businessLicenseNumber: createExporterDto.exportLicenseNumber,
      taxIdentificationNumber: createExporterDto.taxIdNumber,
      productCategories: createExporterDto.productCategories as ExporterCategory[],
      exportDestinations: createExporterDto.exportDestinations,
      businessDescription: createExporterDto.companyDescription,
      verificationStatus: VerificationStatus.PENDING,
    };

    const exporter = this.exporterRepository.create(exporterData);
    return await this.exporterRepository.save(exporter);
  }

  async findAll(options?: FindManyOptions<Exporter>): Promise<Exporter[]> {
    return await this.exporterRepository.find({
      relations: ['user', 'offers'],
      ...options,
    });
  }

  async findOne(id: string): Promise<Exporter> {
    const exporter = await this.exporterRepository.findOne({
      where: { id },
      relations: ['user', 'offers'],
    });

    if (!exporter) {
      throw new NotFoundException(`Exporter with ID ${id} not found`);
    }

    return exporter;
  }

  async findByUserId(userId: string): Promise<Exporter> {
    const exporter = await this.exporterRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user', 'offers'],
    });

    if (!exporter) {
      throw new NotFoundException(`Exporter for user ID ${userId} not found`);
    }

    return exporter;
  }

  async update(id: string, updateExporterDto: UpdateExporterDto): Promise<Exporter> {
    const exporter = await this.findOne(id);
    
    Object.assign(exporter, updateExporterDto);
    
    return await this.exporterRepository.save(exporter);
  }

  async remove(id: string): Promise<void> {
    const exporter = await this.findOne(id);
    await this.exporterRepository.remove(exporter);
  }

  async uploadVerificationDocument(
    exporterId: string,
    documentType: string,
    file: any, // Changed from Express.Multer.File
  ): Promise<{ url: string; documentType: string }> {
    const exporter = await this.findOne(exporterId);

    if (exporter.verificationStatus === VerificationStatus.APPROVED) {
      throw new BadRequestException('Exporter is already verified');
    }

    try {
      const uploadResult = await this.cloudinaryService.uploadImage(file); // Changed method name

      // Update verification documents
      const currentDocs = exporter.verificationDocuments || {};
      currentDocs[documentType] = uploadResult.secure_url;

      await this.exporterRepository.update(exporterId, {
        verificationDocuments: currentDocs,
      });

      return {
        url: uploadResult.secure_url,
        documentType,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to upload document: ${error.message}`);
    }
  }

  async submitForVerification(exporterId: string): Promise<Exporter> {
    const exporter = await this.findOne(exporterId);

    if (exporter.verificationStatus === VerificationStatus.APPROVED) {
      throw new BadRequestException('Exporter is already verified');
    }

    // Align required documents with frontend IDs
    const requiredDocuments = [
      'cac_certificate',
      'export_license',
      'nafdac_certificate',
      'phytosanitary_certificate',
      'tax_clearance',
    ];

    const submittedDocuments = Object.keys(exporter.verificationDocuments || {});
    const missingDocuments = requiredDocuments.filter(
      doc => !submittedDocuments.includes(doc),
    );

    if (missingDocuments.length > 0) {
      throw new BadRequestException(
        `Missing required documents: ${missingDocuments.join(', ')}`,
      );
    }

    exporter.verificationStatus = VerificationStatus.UNDER_REVIEW;

    return await this.exporterRepository.save(exporter);
  }

  // Verification overview mirroring GlobalBuyerService
  async getVerificationOverview(userId: string) {
    const exporter = await this.findByUserId(userId);
    // Align required documents with frontend IDs
    const requiredIds = [
      'cac_certificate',
      'export_license',
      'nafdac_certificate',
      'phytosanitary_certificate',
      'tax_clearance',
    ];
    const docs = exporter.verificationDocuments || {};
    const documentsUploaded = requiredIds.filter(k => !!(docs as any)[k]).length;
    const totalRequired = requiredIds.length;
    const status = exporter.verificationStatus
      ? exporter.verificationStatus.toLowerCase()
      : 'not_started';
    return {
      status,
      documentsUploaded,
      totalRequired,
      reviewNotes: exporter.verificationNotes,
      submittedDate: exporter.verificationReviewedAt, // best available timestamp
      approvedDate: exporter.isVerified ? exporter.verificationReviewedAt : null,
      reviewerName: exporter.verificationReviewedBy,
      creditRating: undefined,
      verificationTier: undefined,
    };
  }

  async listVerificationDocuments(userId: string) {
    const exporter = await this.findByUserId(userId);
    const docs = exporter.verificationDocuments || {};
    return Object.keys(docs).map((key) => ({ documentId: key, fileUrl: (docs as any)[key] }));
  }

  async getVerificationDocument(userId: string, documentId: string) {
    const exporter = await this.findByUserId(userId);
    const docs = exporter.verificationDocuments || {};
    const fileUrl = (docs as any)[documentId];
    if (!fileUrl) {
      throw new NotFoundException('Document not found');
    }
    return { documentId, fileUrl };
  }

  async deleteVerificationDocument(userId: string, documentId: string) {
    const exporter = await this.findByUserId(userId);
    const docs = { ...(exporter.verificationDocuments || {}) } as Record<string, string>;
    if (!docs[documentId]) {
      throw new NotFoundException('Document not found');
    }
    delete docs[documentId];
    await this.exporterRepository.update(exporter.id, { verificationDocuments: docs as any });
    return { success: true };
  }

  async verifyExporter(
    exporterId: string,
    verifyExporterDto: VerifyExporterDto,
    adminUserId: string,
  ): Promise<Exporter> {
    const exporter = await this.findOne(exporterId);

    if (exporter.verificationStatus === VerificationStatus.APPROVED) {
      throw new BadRequestException('Exporter is already verified');
    }

    const { status, notes } = verifyExporterDto;

    exporter.verificationStatus = status;
    exporter.verificationNotes = notes;
    exporter.isVerified = status === VerificationStatus.APPROVED;
    exporter.verificationReviewedAt = new Date();
    exporter.verificationReviewedBy = adminUserId;

    return await this.exporterRepository.save(exporter);
  }

  async getVerifiedExporters(): Promise<Exporter[]> {
    return await this.exporterRepository.find({
      where: { verificationStatus: VerificationStatus.APPROVED },
      relations: ['user'],
      order: { verificationReviewedAt: 'DESC' },
    });
  }

  async getPendingVerifications(): Promise<Exporter[]> {
    return await this.exporterRepository.find({
      where: { verificationStatus: VerificationStatus.UNDER_REVIEW },
      relations: ['user'],
      order: { verificationReviewedAt: 'ASC' },
    });
  }

  async searchExporters(query: {
    productCategories?: string[];
    exportDestinations?: string[];
    minimumRating?: number;
    verifiedOnly?: boolean;
  }): Promise<Exporter[]> {
    const queryBuilder = this.exporterRepository
      .createQueryBuilder('exporter')
      .leftJoinAndSelect('exporter.user', 'user');

    if (query.verifiedOnly) {
      queryBuilder.andWhere('exporter.verificationStatus = :status', {
        status: VerificationStatus.APPROVED,
      });
    }

    if (query.productCategories && query.productCategories.length > 0) {
      queryBuilder.andWhere('exporter.productCategories && :categories', {
        categories: query.productCategories,
      });
    }

    if (query.exportDestinations && query.exportDestinations.length > 0) {
      queryBuilder.andWhere('exporter.exportDestinations && :destinations', {
        destinations: query.exportDestinations,
      });
    }

    if (query.minimumRating) {
      queryBuilder.andWhere('exporter.averageRating >= :rating', {
        rating: query.minimumRating,
      });
    }

    return await queryBuilder
      .orderBy('exporter.averageRating', 'DESC')
      .addOrderBy('exporter.completedOrders', 'DESC')
      .getMany();
  }

  async updateRating(exporterId: string): Promise<void> {
    // This would typically be called after an order is completed and rated
    const result = await this.exporterRepository
      .createQueryBuilder('exporter')
      .leftJoin('exporter.offers', 'offer')
      .leftJoin('offer.order', 'order')
      .select('AVG(order.rating)', 'avgRating')
      .addSelect('COUNT(order.id)', 'totalReviews')
      .where('exporter.id = :exporterId', { exporterId })
      .andWhere('order.rating IS NOT NULL')
      .getRawOne();

    if (result && result.totalReviews > 0) {
      await this.exporterRepository.update(exporterId, {
        averageRating: parseFloat(result.avgRating),
        totalReviews: parseInt(result.totalReviews),
      });
    }
  }

  async incrementOfferCount(exporterId: string): Promise<void> {
    await this.exporterRepository.increment(
      { id: exporterId },
      'completedOrders',
      1,
    );
  }

  async getExporterStats(exporterId: string): Promise<{
    completedOrders: number;
    averageRating: number;
    verificationStatus: VerificationStatus;
    joinedDate: Date;
  }> {
    const exporter = await this.findOne(exporterId);

    return {
      completedOrders: exporter.completedOrders,
      averageRating: exporter.averageRating,
      verificationStatus: exporter.verificationStatus,
      joinedDate: exporter.user.createdAt,
    };
  }

  // Additional methods for controller support
  async updateByUserId(userId: string, updateExporterDto: UpdateExporterDto): Promise<Exporter> {
    const exporter = await this.findByUserId(userId);
    Object.assign(exporter, updateExporterDto);
    return await this.exporterRepository.save(exporter);
  }

  async updateCropsByUserId(userId: string, crops: string[]): Promise<Exporter> {
    const exporter = await this.findByUserId(userId);
    (exporter as any).primaryCrops = crops; // assuming a json/text array field exists or will be added
    return await this.exporterRepository.save(exporter);
  }

  async uploadVerificationDocuments(
    userId: string,
    uploadDto: { documentType: string; fileUrl: string }[]
  ): Promise<{ success: boolean; message: string }> {
    const exporter = await this.findByUserId(userId);

    if (exporter.verificationStatus === VerificationStatus.APPROVED) {
      throw new BadRequestException('Exporter is already verified');
    }

    const currentDocs = exporter.verificationDocuments || {};
    
    uploadDto.forEach(doc => {
      currentDocs[doc.documentType] = doc.fileUrl;
    });

    await this.exporterRepository.update(exporter.id, {
      verificationDocuments: currentDocs,
    });

    return {
      success: true,
      message: 'Documents uploaded successfully'
    };
  }

  async rateExporter(
    exporterId: string,
    raterId: string,
    ratingData: { rating: number; comment?: string }
  ): Promise<{ success: boolean; newAverageRating: number }> {
    // This would typically involve creating a rating record and updating the average
    // For now, let's just update the rating directly
    const exporter = await this.findOne(exporterId);
    
    // Simple average calculation (in real implementation, you'd store individual ratings)
    const totalRatings = exporter.totalReviews + 1;
    const newAverage = ((exporter.averageRating * exporter.totalReviews) + ratingData.rating) / totalRatings;

    await this.exporterRepository.update(exporterId, {
      averageRating: Math.round(newAverage * 100) / 100, // Round to 2 decimal places
      totalReviews: totalRatings,
    });

    return {
      success: true,
      newAverageRating: newAverage
    };
  }

  // Enhanced search with pagination
  async findAllWithFilters(filters: {
    page?: number;
    limit?: number;
    category?: string;
    country?: string;
    verified?: boolean;
    search?: string;
  }): Promise<{ exporters: Exporter[]; total: number; page: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.exporterRepository
      .createQueryBuilder('exporter')
      .leftJoinAndSelect('exporter.user', 'user');

    if (filters.verified !== undefined) {
      queryBuilder.andWhere('exporter.isVerified = :verified', { verified: filters.verified });
    }

    if (filters.category) {
      queryBuilder.andWhere(':category = ANY(exporter.productCategories)', { category: filters.category });
    }

    if (filters.country) {
      queryBuilder.andWhere(':country = ANY(exporter.exportDestinations)', { country: filters.country });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(exporter.businessDescription LIKE :search OR user.companyName LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    const [exporters, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('exporter.averageRating', 'DESC')
      .getManyAndCount();

    return {
      exporters,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getExporterOffers(exporterId: string): Promise<any[]> {
    const exporter = await this.exporterRepository.findOne({
      where: { id: exporterId },
      relations: ['offers', 'offers.sourcingRequest', 'offers.sourcingRequest.globalBuyer'],
    });

    if (!exporter) {
      throw new NotFoundException(`Exporter with ID ${exporterId} not found`);
    }

    return exporter.offers || [];
  }

  // Dashboard methods
  async getDashboardStats(userId: string) {
    const exporter = await this.findByUserId(userId);
    
    // Get active offers count
    const activeOffers = await this.offerRepository.count({
      where: { 
        exporterId: exporter.id,
        status: OfferStatus.PENDING 
      }
    });

    // Get new requests count (active requests not expired)
    const newRequests = await this.sourcingRequestRepository.count({
      where: {
        status: RequestStatus.ACTIVE,
        quotationDeadline: MoreThanOrEqual(new Date()),
        isPublic: true
      }
    });

    // Get completed deals (accepted offers)
    const completedDeals = await this.offerRepository.count({
      where: { 
        exporterId: exporter.id,
        status: OfferStatus.ACCEPTED 
      }
    });

    // Calculate total revenue from accepted offers
    const acceptedOffers = await this.offerRepository.find({
      where: { 
        exporterId: exporter.id,
        status: OfferStatus.ACCEPTED 
      },
      select: ['totalPrice']
    });
    
    const revenue = acceptedOffers.reduce((sum, offer) => sum + Number(offer.totalPrice), 0);

    // Calculate success rate (accepted offers / total offers)
    const totalOffers = await this.offerRepository.count({
      where: { exporterId: exporter.id }
    });
    
    const successRate = totalOffers > 0 ? Math.round((completedDeals / totalOffers) * 100) : 0;

    // Calculate growth rate (this month vs last month)
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const thisMonthOffers = await this.offerRepository.count({
      where: { 
        exporterId: exporter.id,
        createdAt: MoreThanOrEqual(thisMonth)
      }
    });
    
    const lastMonthOffers = await this.offerRepository.count({
      where: { 
        exporterId: exporter.id,
        createdAt: Between(lastMonth, thisMonth)
      }
    });

    const growthRate = lastMonthOffers > 0 
      ? `+${Math.round(((thisMonthOffers - lastMonthOffers) / lastMonthOffers) * 100)}%`
      : "+0%";

    // Calculate average response time (mock for now, would need activity tracking)
    const avgResponseTime = "1.8h"; // This would need to be calculated from actual response times

    return {
      activeOffers,
      newRequests,
      completedDeals,
      revenue,
      growthRate,
      avgResponseTime,
      successRate,
      rating: exporter.averageRating || 0,
    };
  }

  async getDashboardRequests(userId: string) {
    const exporter = await this.findByUserId(userId);
    
    // Get active requests that match exporter's product categories
    const requests = await this.sourcingRequestRepository.find({
      where: {
        status: RequestStatus.ACTIVE,
        quotationDeadline: MoreThanOrEqual(new Date()),
        isPublic: true
      },
      relations: ['globalBuyer', 'globalBuyer.user', 'offers'],
      order: { createdAt: 'DESC' },
      take: 5
    });

    // For each request, check if current exporter has submitted an offer
    const requestsWithOfferInfo = await Promise.all(
      requests.map(async (request) => {
        // Count total offers for this request
        const totalOffers = await this.offerRepository.count({
          where: { sourcingRequestId: request.id }
        });

        // Check if current exporter has submitted an offer
        const hasSubmittedOffer = await this.offerRepository.count({
          where: { 
            sourcingRequestId: request.id,
            exporterId: exporter.id 
          }
        }) > 0;

        return {
          id: request.id,
          title: request.title,
          buyer: request.globalBuyer.user?.firstName 
            ? `${request.globalBuyer.user.firstName} ${request.globalBuyer.user.lastName}`
            : request.globalBuyer.user?.companyName || 'Unknown Buyer',
          budget: request.budgetMin && request.budgetMax 
            ? `$${request.budgetMin.toLocaleString()} - $${request.budgetMax.toLocaleString()}`
            : request.budgetMin 
            ? `$${request.budgetMin.toLocaleString()}+`
            : 'Budget not specified',
          deadline: new Date(request.quotationDeadline).toLocaleDateString(),
          urgency: request.urgencyLevel,
          location: request.deliveryCountry,
          description: request.description.substring(0, 100) + (request.description.length > 100 ? '...' : ''),
          hasSubmittedOffer,
          totalOffers,
        };
      })
    );

    return requestsWithOfferInfo;
  }

  async getDashboardOffers(userId: string) {
    const exporter = await this.findByUserId(userId);
    
    const offers = await this.offerRepository.find({
      where: { exporterId: exporter.id },
      relations: ['sourcingRequest', 'sourcingRequest.globalBuyer', 'sourcingRequest.globalBuyer.user'],
      order: { createdAt: 'DESC' },
      take: 5
    });

    return offers.map(offer => ({
      id: offer.id,
      request: offer.sourcingRequest.title,
      buyer: offer.sourcingRequest.globalBuyer.user?.firstName 
        ? `${offer.sourcingRequest.globalBuyer.user.firstName} ${offer.sourcingRequest.globalBuyer.user.lastName}`
        : offer.sourcingRequest.globalBuyer.user?.companyName || 'Unknown Buyer',
      price: `$${offer.totalPrice.toLocaleString()}`,
      status: offer.status,
      submittedAt: this.getTimeAgo(offer.createdAt),
      urgency: offer.sourcingRequest.urgencyLevel,
    }));
  }

  async getDashboardActivity(userId: string) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const exporter = await this.findByUserId(userId);
    if (!exporter) {
      throw new Error('Exporter not found');
    }
    
    // Get recent offers
    const recentOffers = await this.offerRepository.find({
      where: { exporterId: exporter.id },
      relations: ['sourcingRequest', 'sourcingRequest.globalBuyer', 'sourcingRequest.globalBuyer.user'],
      order: { createdAt: 'DESC' },
      take: 3
    });

    const activities = [];

    // Add offer submissions
    for (const offer of recentOffers) {
      activities.push({
        type: "offer_submitted",
        message: `Submitted offer for ${offer.sourcingRequest.title}`,
        time: this.getTimeAgo(offer.createdAt),
      });
    }

    // Add profile views (mock for now)
    activities.push({
      type: "profile_viewed",
      message: "Your profile was viewed 12 times",
      time: "4h ago",
    });

    // Add message received (mock for now)
    if (recentOffers.length > 0) {
      const buyerName = recentOffers[0].sourcingRequest?.globalBuyer?.user?.firstName || 
                       recentOffers[0].sourcingRequest?.globalBuyer?.user?.companyName || 
                       'Buyer';
      activities.push({
        type: "message_received",
        message: `New message from ${buyerName}`,
        time: "6h ago",
      });
    }

    return activities.slice(0, 4); // Return max 4 activities
  }

  async getDashboardNotifications(userId: string) {
    const exporter = await this.findByUserId(userId);
    
    const notifications = [];

    // Check for new requests matching exporter's categories
    const newRequests = await this.sourcingRequestRepository.count({
      where: {
        status: RequestStatus.ACTIVE,
        quotationDeadline: MoreThanOrEqual(new Date()),
        isPublic: true,
        createdAt: MoreThanOrEqual(new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      }
    });

    if (newRequests > 0) {
      notifications.push({
        id: 1,
        type: "request",
        message: `${newRequests} new request${newRequests > 1 ? 's' : ''} available`,
        time: "3m ago",
        urgent: true,
      });
    }

    // Check for offer status changes
    const pendingOffers = await this.offerRepository.count({
      where: { 
        exporterId: exporter.id,
        status: OfferStatus.PENDING 
      }
    });

    if (pendingOffers > 0) {
      notifications.push({
        id: 2,
        type: "offer",
        message: `${pendingOffers} offer${pendingOffers > 1 ? 's' : ''} pending review`,
        time: "25m ago",
        urgent: false,
      });
    }

    // Check for accepted offers
    const acceptedOffers = await this.offerRepository.find({
      where: { 
        exporterId: exporter.id,
        status: OfferStatus.ACCEPTED,
        createdAt: MoreThanOrEqual(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      },
      relations: ['sourcingRequest', 'sourcingRequest.globalBuyer', 'sourcingRequest.globalBuyer.user']
    });

    if (acceptedOffers.length > 0) {
      notifications.push({
        id: 3,
        type: "offer",
        message: `Your offer for ${acceptedOffers[0].sourcingRequest.title} was accepted`,
        time: "1h ago",
        urgent: false,
      });
    }

    return notifications;
  }

  async getRequestOffers(requestId: string, userId: string) {
    const exporter = await this.findByUserId(userId);
    
    // Get all offers for this request (limited view for competitive reasons)
    const offers = await this.offerRepository.find({
      where: { sourcingRequestId: requestId },
      relations: ['exporter', 'exporter.user'],
      order: { createdAt: 'DESC' }
    });

    return offers.map(offer => ({
      id: offer.id,
      exporterName: offer.exporter.user?.companyName || 
                   `${offer.exporter.user?.firstName || ''} ${offer.exporter.user?.lastName || ''}`.trim() || 
                   'Anonymous Exporter',
      isVerified: offer.exporter.isVerified,
      submittedAt: this.getTimeAgo(offer.createdAt),
      status: offer.status,
      // Don't show sensitive pricing info to competitors
      isMyOffer: offer.exporterId === exporter.id,
      ...(offer.exporterId === exporter.id && {
        // Only show full details for exporter's own offer
        totalPrice: offer.totalPrice,
        pricePerUnit: offer.pricePerUnit,
        currency: offer.currency,
        leadTime: offer.leadTime,
        validUntil: offer.validUntil,
      })
    }));
  }

  async getMyOfferForRequest(requestId: string, userId: string) {
    const exporter = await this.findByUserId(userId);
    
    const offer = await this.offerRepository.findOne({
      where: { 
        sourcingRequestId: requestId,
        exporterId: exporter.id 
      },
      relations: ['sourcingRequest', 'sourcingRequest.globalBuyer', 'sourcingRequest.globalBuyer.user']
    });

    if (!offer) {
      // Return null instead of throwing an exception - this is an expected case
      return null;
    }

    return {
      id: offer.id,
      requestTitle: offer.sourcingRequest.title,
      buyerName: offer.sourcingRequest.globalBuyer.user?.companyName ||
                 `${offer.sourcingRequest.globalBuyer.user?.firstName || ''} ${offer.sourcingRequest.globalBuyer.user?.lastName || ''}`.trim() ||
                 'Unknown Buyer',
      totalPrice: offer.totalPrice,
      pricePerUnit: offer.pricePerUnit,
      currency: offer.currency,
      availableQuantity: offer.availableQuantity,
      leadTime: offer.leadTime,
      validUntil: offer.validUntil,
      status: offer.status,
      submittedAt: offer.createdAt,
      productSpecifications: offer.productSpecifications,
      qualityAssurance: offer.qualityAssurance,
      packagingDetails: offer.packagingDetails,
      paymentTerms: offer.paymentTerms,
      additionalNotes: offer.additionalNotes,
    };
  }

  async getOfferById(offerId: string, userId: string) {
    const exporter = await this.findByUserId(userId);
    
    const offer = await this.offerRepository.findOne({
      where: { 
        id: offerId,
        exporterId: exporter.id 
      },
      relations: [
        'sourcingRequest', 
        'sourcingRequest.globalBuyer', 
        'sourcingRequest.globalBuyer.user'
      ]
    });

    if (!offer) {
      throw new NotFoundException('Offer not found or you do not have permission to view it');
    }

    const request = offer.sourcingRequest;
    const buyer = request.globalBuyer;
    const buyerUser = buyer.user;

    return {
      id: offer.id,
      requestId: request.id,
      requestTitle: request.title,
      buyer: {
        name: buyerUser ? `${buyerUser.firstName || ''} ${buyerUser.lastName || ''}`.trim() : 'Unknown Contact',
        company: buyerUser?.companyName || 'Unknown Company',
        location: request.deliveryCountry || 'Unknown Location'
      },
      product: {
        name: request.productName || 'Product',
        category: request.productCategory || 'Unknown Category',
        specifications: offer.productSpecifications || 'No specifications provided'
      },
      pricing: {
        unitPrice: Number(offer.pricePerUnit),
        totalPrice: Number(offer.totalPrice),
        currency: offer.currency || 'USD'
      },
      quantity: {
        requested: Number(request.quantity),
        offered: Number(offer.availableQuantity),
        unit: request.unit || 'units'
      },
      delivery: {
        method: offer.shippingDetails || 'Standard Shipping',
        timeframe: offer.leadTime ? `${offer.leadTime} days` : 'Not specified',
        location: `${request.deliveryCity || ''} ${request.deliveryCountry || ''}`.trim() || 'To be determined',
        terms: offer.shippingDetails || 'Standard terms apply'
      },
      payment: {
        terms: offer.paymentTerms || 'Net 30',
        method: 'Bank Transfer' // Default, could be enhanced
      },
      status: offer.status,
      submittedAt: offer.createdAt ? new Date(offer.createdAt).toLocaleDateString() : 'Unknown date',
      validUntil: offer.validUntil ? new Date(offer.validUntil).toLocaleDateString() : 'No expiry set',
      notes: offer.additionalNotes || '',
      // Optional: Add attachments if you have that functionality
      attachments: offer.attachments ? offer.attachments.map((url, index) => ({
        id: `${offer.id}-${index}`,
        name: `Attachment ${index + 1}`,
        url: url,
        type: 'file'
      })) : []
    };
  }

  // Helper method to calculate time ago
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  }
}
