import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { Exporter, VerificationStatus, ExporterCategory, ExporterVerificationTier } from './entities/exporter.entity';
import { VerificationDocument } from 'src/common/entities/verification-document.entity';
import { VerificationRequirement } from 'src/common/entities/verification-requirement.entity';
import { CreateExporterDto } from './dto/create-exporter.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateExporterDto } from './dto/update-exporter.dto';
import { VerifyExporterDto } from './dto/verify-exporter.dto';
import { SourcingRequest, RequestStatus } from '../sourcing-request/entities/sourcing-request.entity';
import { Offer, OfferStatus } from '../offer/entities/offer.entity';
import { OfferService } from '../offer/offer.service';

@Injectable()
export class ExporterService {
  constructor(
    @InjectRepository(Exporter)
    private exporterRepository: Repository<Exporter>,
    @InjectRepository(VerificationDocument)
    private verificationDocumentRepository: Repository<VerificationDocument>,
    @InjectRepository(SourcingRequest)
    private sourcingRequestRepository: Repository<SourcingRequest>,
    @InjectRepository(Offer)
    private offerRepository: Repository<Offer>,
    @InjectRepository(VerificationRequirement)
    private verificationRequirementRepository: Repository<VerificationRequirement>,
    private cloudinaryService: CloudinaryService,
    @Inject(forwardRef(() => OfferService))
    private offerService: OfferService,
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
    const exporters = await this.exporterRepository.find({
      relations: ['user', 'offers'],
      ...options,
    });

    // sanitize nested user objects before returning
    return exporters.map(exp => ({
      ...exp,
      user: exp.user ? ({
        id: exp.user.id,
        email: exp.user.email,
        firstName: exp.user.firstName,
        lastName: exp.user.lastName,
        companyName: exp.user.companyName,
        role: exp.user.role,
        isVerified: exp.user.isVerified,
        isActive: exp.user.isActive,
        status: exp.user.status,
        phoneNumber: exp.user.phoneNumber,
        countryName: exp.user.countryName,
      }) : null,
    } as any));
  }

  async findOne(id: string): Promise<Exporter> {
    const exporter = await this.exporterRepository.findOne({
      where: { id },
      relations: ['user', 'offers'],
    });

    if (!exporter) {
      throw new NotFoundException(`Exporter with ID ${id} not found`);
    }

    // sanitize nested user
    if (exporter && exporter.user) {
      exporter.user = ({
        id: exporter.user.id,
        email: exporter.user.email,
        firstName: exporter.user.firstName,
        lastName: exporter.user.lastName,
        companyName: exporter.user.companyName,
        role: exporter.user.role,
        isVerified: exporter.user.isVerified,
        isActive: exporter.user.isActive,
        status: exporter.user.status,
        phoneNumber: exporter.user.phoneNumber,
        countryName: exporter.user.countryName,
      }) as any;
    }

    return exporter;
  }

  async findByUserId(userId: string): Promise<Exporter> {
    const exporter = await this.findByUserIdOptional(userId);

    if (!exporter) {
      throw new NotFoundException(`Exporter for user ID ${userId} not found`);
    }

    return exporter;
  }

  /**
   * Find exporter by user ID without throwing an exception.
   * Returns null if not found.
   */
  async findByUserIdOptional(userId: string): Promise<Exporter | null> {
    const exporter = await this.exporterRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user', 'offers'],
    });

    if (!exporter) {
      return null;
    }

    if (exporter && exporter.user) {
      exporter.user = ({
        id: exporter.user.id,
        email: exporter.user.email,
        firstName: exporter.user.firstName,
        lastName: exporter.user.lastName,
        companyName: exporter.user.companyName,
        role: exporter.user.role,
        isVerified: exporter.user.isVerified,
        isActive: exporter.user.isActive,
        status: exporter.user.status,
        phoneNumber: exporter.user.phoneNumber,
        countryName: exporter.user.countryName,
      }) as any;
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
  ): Promise<{ url: string; documentType: string; verificationTier?: string; message?: string }> {
    const exporter = await this.findOne(exporterId);

    if (exporter.verificationStatus === VerificationStatus.APPROVED) {
      throw new BadRequestException('Exporter is already verified');
    }

    try {
      const uploadResult = await this.cloudinaryService.uploadImage(file);
      const fileUrl = uploadResult.secure_url;

      // Check if document already exists - update instead of creating duplicate
      let doc = await this.verificationDocumentRepository.findOne({ 
        where: { exporter: { id: exporter.id }, documentType } 
      });
      
      if (doc) {
        // Update existing document
        doc.fileUrl = fileUrl;
        doc.fileName = file?.originalname || null;
        doc.mimeType = file?.mimetype || null;
        doc.status = VerificationStatus.PENDING;
      } else {
        // Create new document
        doc = this.verificationDocumentRepository.create({
          exporter: exporter,
          ownerId: exporter.id,
          documentType,
          fileUrl,
          fileName: file?.originalname || null,
          mimeType: file?.mimetype || null,
          status: VerificationStatus.PENDING,
        });
      }
      await this.verificationDocumentRepository.save(doc);

      // Don't change verification status during upload - user must explicitly submit for review
      // The getVerificationOverview method will calculate the correct display status based on document count

      return { 
        url: fileUrl, 
        documentType
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

    // Fetch required documents from verification_requirement table
    const requirements = await this.verificationRequirementRepository.find({ where: { ownerType: 'exporter', required: true } });
    const requiredDocumentTypes = requirements.map(r => r.documentType);

    // Count persisted documents first
    const persisted = await this.verificationDocumentRepository.find({ where: { exporter: { id: exporter.id } } });
    const persistedTypes = persisted.map(p => p.documentType);

  // Only consider persisted verification documents
  const missingDocuments = requiredDocumentTypes.filter(dt => !persistedTypes.includes(dt));

    if (missingDocuments.length > 0) {
      throw new BadRequestException(`Missing required documents: ${missingDocuments.join(', ')}`);
    }

    exporter.verificationStatus = VerificationStatus.UNDER_REVIEW;

    return await this.exporterRepository.save(exporter);
  }


  // Verification overview
  async getVerificationOverview(userId: string) {
    const exporter = await this.findByUserId(userId);
    
    // Count all uploaded documents (persisted)
    const allDocs = await this.verificationDocumentRepository.find({ where: { exporter: { id: exporter.id } } });
    
    // Get required documents count from requirements table
    const requirements = await this.verificationRequirementRepository.find({ where: { ownerType: 'exporter', required: true } });
    // Default to 3 if no requirements set (matches frontend: business_registration, export_license, tax_certificate)
    const totalRequired = requirements.length || 3;
    
    const documentsUploaded = allDocs.length;
    
    // Determine the correct status based on actual progress
    let status: string;
    if (exporter.verificationStatus === VerificationStatus.APPROVED) {
      status = 'approved';
    } else if (exporter.verificationStatus === VerificationStatus.REJECTED) {
      status = 'rejected';
    } else if (exporter.verificationStatus === VerificationStatus.UNDER_REVIEW) {
      status = 'under_review';
    } else if (documentsUploaded === 0) {
      // No documents uploaded yet - show as not started
      status = 'not_started';
    } else if (documentsUploaded < totalRequired) {
      // Some documents uploaded but not all - show as in progress
      status = 'in_progress';
    } else {
      // All required documents uploaded but not yet submitted for review
      status = 'in_progress';
    }
    
    const isVerified = exporter.verificationStatus === VerificationStatus.APPROVED;
      
    return {
      status,
      documentsUploaded,
      totalRequired,
      isVerified,
      reviewNotes: exporter.verificationNotes,
      submittedDate: exporter.verificationReviewedAt,
      approvedDate: exporter.isVerified ? exporter.verificationReviewedAt : null,
      reviewerName: exporter.verificationReviewedBy,
    };
  }

  async listVerificationDocuments(userId: string) {
    const exporter = await this.findByUserId(userId);
    // Return persisted documents only
    const persisted = await this.verificationDocumentRepository.find({ where: { exporter: { id: exporter.id } } });
    return persisted.map(d => ({ documentId: d.documentType, fileUrl: d.fileUrl, status: d.status, uploadedAt: d.uploadedAt }));
  }

  async getVerificationDocument(userId: string, documentId: string) {
    const exporter = await this.findByUserId(userId);
    const persisted = await this.verificationDocumentRepository.findOne({ where: { exporter: { id: exporter.id }, documentType: documentId } });
  if (!persisted) throw new NotFoundException('Document not found');
  return { documentId: persisted.documentType, fileUrl: persisted.fileUrl, status: persisted.status };
  }

  async deleteVerificationDocument(userId: string, documentId: string) {
    const exporter = await this.findByUserId(userId);
    // Delete persisted doc if exists
    const persisted = await this.verificationDocumentRepository.findOne({ where: { exporter: { id: exporter.id }, documentType: documentId } });
    if (persisted) {
      await this.verificationDocumentRepository.remove(persisted);
    }

    // No legacy JSON blob to update; persisted record removed above

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
    
    // Set FULL tier when admin approves
    if (status === VerificationStatus.APPROVED) {
      exporter.verificationTier = ExporterVerificationTier.FULL;
    }

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
    // Persist each uploaded document to the shared VerificationDocument table
    for (const doc of uploadDto) {
      const record = this.verificationDocumentRepository.create({
        exporter: exporter,
        ownerId: exporter.id,
        documentType: doc.documentType,
        fileUrl: doc.fileUrl,
        fileName: undefined,
        mimeType: undefined,
        status: VerificationStatus.PENDING,
      });
      await this.verificationDocumentRepository.save(record);
    }

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

  /**
   * Enhanced search with pagination and optimization for millions of exporters
   * 
   * SCALABILITY STRATEGIES:
   * 1. **Database Indexes** (CRITICAL for millions of records):
   *    - CREATE INDEX idx_exporter_verified ON exporter(isVerified);
   *    - CREATE INDEX idx_exporter_featured ON exporter(isFeatured);
   *    - CREATE INDEX idx_exporter_rating ON exporter(averageRating);
   *    - CREATE INDEX idx_exporter_crops ON exporter USING GIN(primaryCrops);
   *    - CREATE INDEX idx_user_country ON user(countryName, countryCode);
   *    - CREATE INDEX idx_exporter_active ON exporter(isActive) WHERE isActive = true;
   * 
   * 2. **Search Optimization**:
   *    - Full-text search for crop names (PostgreSQL ts_vector)
   *    - Elasticsearch/OpenSearch for complex queries
   *    - Redis caching for popular searches
   * 
   * 3. **Pagination & Limits**:
   *    - Cap results at 50 per page (prevents expensive queries)
   *    - Use cursor-based pagination for large datasets
   *    - Implement search result caching
   * 
   * 4. **Relevance Scoring**:
   *    - Verified exporters ranked higher
   *    - Featured placement for premium users
   *    - Multi-factor ordering (rating + experience + activity)
   * 
   * 5. **Query Optimization**:
   *    - Filter early (WHERE clauses before JOINs)
   *    - Use EXISTS instead of JOINs where possible
   *    - Limit data fetched with specific SELECT fields
   */
  async findAllWithFilters(filters: {
    page?: number;
    limit?: number;
    category?: string;
    country?: string;
    verified?: boolean;
    search?: string;
  }): Promise<{ exporters: Exporter[]; total: number; page: number; totalPages: number }> {
    console.log('=== SEARCH DEBUG ===');
    console.log('Filters received:', filters);
    
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 10, 50); // Cap limit at 50 for performance
    const skip = (page - 1) * limit;

    const queryBuilder = this.exporterRepository
      .createQueryBuilder('exporter')
      .leftJoinAndSelect('exporter.user', 'user');

    // Debug: Let's see all exporters first
    const allExporters = await this.exporterRepository.find({ relations: ['user'] });
    console.log('Total exporters in database:', allExporters.length);
    allExporters.forEach((exp, index) => {
      console.log(`Exporter ${index + 1}:`, {
        id: exp.id,
        companyName: exp.user?.companyName,
        primaryCrops: exp.primaryCrops,
        productCategories: exp.productCategories,
        businessDescription: exp.businessDescription,
        isVerified: exp.isVerified,
        exportDestinations: exp.exportDestinations,
        userCountryName: exp.user?.countryName,
        userCountryCode: exp.user?.countryCode,
      });
    });

    // Early filtering for performance - most restrictive filters first
    queryBuilder.andWhere('exporter.isActive = :isActive', { isActive: true }); // Only active exporters

    if (filters.verified !== undefined) {
      queryBuilder.andWhere('exporter.isVerified = :verified', { verified: filters.verified });
    }

    if (filters.category) {
      queryBuilder.andWhere('exporter.productCategories ILIKE :categoryLike', { categoryLike: `%${filters.category}%` });
    }

    if (filters.country) {
      // Search by user's country name or country code
      queryBuilder.andWhere(
        '(user.countryName ILIKE :countryLike OR user.countryCode ILIKE :countryLike)', 
        { countryLike: `%${filters.country}%` }
      );
    }

    if (filters.search) {
      // Search for specific crops in primaryCrops (stored as comma-separated text) or general business info
      console.log('Adding search filter for:', filters.search);
      
      // Create a mapping of crop names/terms to crop IDs
      const cropMapping: Record<string, string> = {
        'cashew': 'cashew',
        'cashew nuts': 'cashew',
        'cashew nut': 'cashew',
        'sesame': 'sesame',
        'sesame seeds': 'sesame',
        'ginger': 'ginger',
        'cocoa': 'cocoa',
        'cocoa beans': 'cocoa',
        'coffee': 'coffee',
        'coffee beans': 'coffee',
        'tea': 'tea',
        'tea leaves': 'tea',
        'shea butter': 'shea_butter',
        'shea': 'shea_butter',
        'palm oil': 'palm_oil',
        'palm': 'palm_oil',
        'rubber': 'rubber',
        'cotton': 'cotton',
        'hibiscus': 'hibiscus',
        'turmeric': 'turmeric',
        'black pepper': 'black_pepper',
        'pepper': 'black_pepper',
        'groundnut': 'groundnut',
        'groundnuts': 'groundnut',
        'peanut': 'groundnut',
        'peanuts': 'groundnut',
        'soybean': 'soybean',
        'soybeans': 'soybean',
        'sorghum': 'sorghum',
        'millet': 'millet',
        'maize': 'maize',
        'corn': 'maize',
        'beans': 'beans',
        'cowpeas': 'beans',
      };
      
      // Normalize the search term and look for crop ID
      const normalizedSearch = filters.search.toLowerCase().trim();
      const cropId = cropMapping[normalizedSearch];
      
      console.log('Normalized search:', normalizedSearch);
      console.log('Found crop ID:', cropId);
      
      if (cropId) {
        // Search for the specific crop ID in primaryCrops
        queryBuilder.andWhere('exporter.primaryCrops ILIKE :cropSearch', { 
          cropSearch: `%${cropId}%` 
        });
      } else {
        // Fallback to general search in business info and company name
        queryBuilder.andWhere(
          '(exporter.businessDescription ILIKE :searchLike OR user.companyName ILIKE :searchLike)',
          { 
            searchLike: `%${filters.search}%` 
          }
        );
      }
    }

    console.log('Final query SQL:', queryBuilder.getSql());
    console.log('Query parameters:', queryBuilder.getParameters());

    const [exporters, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      // Multi-factor ordering for better relevance with millions of records:
      // 1. Verified exporters first (business credibility)
      .addOrderBy('exporter.isVerified', 'DESC')
      // 2. Featured exporters (premium placement)
      .addOrderBy('exporter.isFeatured', 'DESC') 
      // 3. Average rating (quality indicator)
      .addOrderBy('exporter.averageRating', 'DESC')
      // 4. Number of completed orders (experience)
      .addOrderBy('exporter.completedOrders', 'DESC')
      // 5. Recent activity (freshness)
      .addOrderBy('exporter.updatedAt', 'DESC')
      .getManyAndCount();

    console.log('Search results:', { 
      found: exporters.length, 
      total,
      exporters: exporters.map(e => ({
        id: e.id,
        companyName: e.user?.companyName,
        primaryCrops: e.primaryCrops
      }))
    });
    console.log('=== END SEARCH DEBUG ===');

    return {
      exporters,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get total count of active exporters in the system
   * Used for displaying system-wide statistics
   */
  async getTotalExportersCount(): Promise<{ 
    total: number; 
    verified: number; 
    active: number; 
    countries: number; 
  }> {
    const [
      total,
      verified,
      active,
      countryCount
    ] = await Promise.all([
      // Total exporters
      this.exporterRepository.count(),
      
      // Verified exporters
      this.exporterRepository.count({
        where: { isVerified: true }
      }),
      
      // Active exporters
      this.exporterRepository.count({
        where: { isActive: true }
      }),
      
      // Unique countries count
      this.exporterRepository
        .createQueryBuilder('exporter')
        .leftJoin('exporter.user', 'user')
        .select('COUNT(DISTINCT user.countryName)', 'count')
        .where('user.countryName IS NOT NULL')
        .getRawOne()
        .then(result => parseInt(result?.count || '0'))
    ]);

    return {
      total,
      verified,
      active,
      countries: countryCount,
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
    
    // Get exporter's productCategories, primaryCrops, and exportDestinations for filtering
    const exporterCategories = exporter?.productCategories || [];
    const exporterCrops = exporter?.primaryCrops || [];
    const exporterDestinations = exporter?.exportDestinations || [];
    
    // Build query for active requests
    let queryBuilder = this.sourcingRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.globalBuyer', 'globalBuyer')
      .leftJoinAndSelect('globalBuyer.user', 'user')
      .leftJoinAndSelect('request.offers', 'offers')
      .where('request.status = :status', { status: RequestStatus.ACTIVE })
      .andWhere('request.quotationDeadline >= :now', { now: new Date() })
      .andWhere('request.isPublic = :isPublic', { isPublic: true });

    // Smart filtering by productCategories and/or primaryCrops
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

    const requests = await queryBuilder
      .orderBy('request.createdAt', 'DESC')
      .take(5)
      .getMany();

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
    
    // Get all offers for this exporter, prioritizing negotiated ones
    const offers = await this.offerRepository.find({
      where: { exporterId: exporter.id },
      relations: ['sourcingRequest', 'sourcingRequest.globalBuyer', 'sourcingRequest.globalBuyer.user'],
      order: { 
        updatedAt: 'DESC', // Use updatedAt to show recently negotiated offers first
        createdAt: 'DESC' 
      },
      take: 10 // Increased to show more offers including negotiated ones
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
      updatedAt: this.getTimeAgo(offer.updatedAt),
      urgency: offer.sourcingRequest.urgencyLevel,
      hasNegotiation: offer.status === 'under_negotiation',
    }));
  }

  async getNegotiatedOffers(userId: string) {
    const exporter = await this.findByUserId(userId);
    
    // Get only offers that are under negotiation
    const negotiatedOffers = await this.offerRepository.find({
      where: { 
        exporterId: exporter.id,
        status: 'under_negotiation' as any
      },
      relations: ['sourcingRequest', 'sourcingRequest.globalBuyer', 'sourcingRequest.globalBuyer.user'],
      order: { updatedAt: 'DESC' }
    });

    return negotiatedOffers.map(offer => ({
      id: offer.id,
      request: offer.sourcingRequest.title,
      buyer: offer.sourcingRequest.globalBuyer.user?.firstName 
        ? `${offer.sourcingRequest.globalBuyer.user.firstName} ${offer.sourcingRequest.globalBuyer.user.lastName}`
        : offer.sourcingRequest.globalBuyer.user?.companyName || 'Unknown Buyer',
      price: `$${offer.totalPrice.toLocaleString()}`,
      status: offer.status,
      submittedAt: this.getTimeAgo(offer.createdAt),
      updatedAt: this.getTimeAgo(offer.updatedAt),
      urgency: offer.sourcingRequest.urgencyLevel,
      hasNegotiation: true,
      negotiationNotes: offer.negotiationNotes,
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
    
    // Use the offer service's findOne method to get original values
    const offer = await this.offerService.findOne(offerId, userId);

    // Verify exporter ownership
    if (offer.exporterId !== exporter.id) {
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
        currency: offer.currency || 'USD',
        // Include original values if available (when under negotiation)
        originalUnitPrice: (offer as any).originalPricePerUnit ? Number((offer as any).originalPricePerUnit) : undefined,
        originalTotalPrice: (offer as any).originalTotalPrice ? Number((offer as any).originalTotalPrice) : undefined,
      },
      quantity: {
        requested: Number(request.quantity),
        offered: Number(offer.availableQuantity),
        unit: request.unit || 'units',
        // Include original quantity if available
        originalOffered: (offer as any).originalAvailableQuantity ? Number((offer as any).originalAvailableQuantity) : undefined,
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
