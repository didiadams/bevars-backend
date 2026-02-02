import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, UserRole, UserStatus } from '../../user/entities/user.entity';
import { GlobalBuyer, BuyerVerificationTier } from '../../global-buyer/entities/global-buyer.entity';
import { Exporter, VerificationStatus, ExporterVerificationTier } from '../../exporter/entities/exporter.entity';
import { VerificationDocument } from '../../common/entities/verification-document.entity';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(GlobalBuyer)
    private globalBuyerRepository: Repository<GlobalBuyer>,
    @InjectRepository(Exporter)
    private exporterRepository: Repository<Exporter>,
  @InjectRepository(VerificationDocument)
  private verificationDocRepository: Repository<VerificationDocument>,
    @Inject(forwardRef(() => AdminAuditService))
    private auditService: AdminAuditService,
  ) {}

  // Get all users with pagination and filtering
  async getAllUsers(page: number = 1, limit: number = 20, role?: UserRole, status?: UserStatus, isVerified?: boolean) {
    const skip = (page - 1) * limit;
    
    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.globalBuyer', 'globalBuyer')
      .leftJoinAndSelect('user.exporter', 'exporter')
      .select([
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.phoneNumber',
        'user.countryName',
        'user.role',
        'user.companyName',
        'user.isVerified',
        'user.isActive',
        'user.status',
        'user.createdAt',
        'user.updatedAt',
        'globalBuyer.id',
        'globalBuyer.verificationTier',
        'globalBuyer.buyerType',
        'exporter.id',
        'exporter.verificationStatus',
        'exporter.businessDescription'
      ])
      .skip(skip)
      .take(limit)
      .orderBy('user.createdAt', 'DESC');

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    if (isVerified !== undefined) {
      queryBuilder.andWhere('user.isVerified = :isVerified', { isVerified });
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get user by ID with full details
  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['globalBuyer', 'exporter'],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        countryCode: true,
        countryName: true,
        role: true,
        companyName: true,
        isVerified: true,
        isActive: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Ensure password (and any sensitive fields) are never returned
    const { password: _, ...safeUser } = user as any;
    return safeUser;
  }

  // Activate/Deactivate user
  async toggleUserStatus(userId: string, isActive: boolean, adminId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot modify admin user status');
    }



    const newStatus = isActive ? UserStatus.ACTIVE : UserStatus.SUSPENDED;
    const updateData = { 
      isActive,
      status: newStatus,
    };

  

    // Try using save() instead of update() to ensure the entity is properly updated
    user.isActive = isActive;
    user.status = newStatus;
    
    const savedUser = await this.userRepository.save(user);


    // Double-check by fetching fresh from database
    const freshUser = await this.userRepository.findOne({ where: { id: userId } });
  

    // Log admin action (we'll implement this in the logging service)
    await this.logAdminAction(adminId, `${isActive ? 'Activated' : 'Deactivated'} user: ${user.email}`);

    return { success: true, message: `User ${isActive ? 'activated' : 'deactivated'} successfully` };
  }

  // Verify/Unverify user
  async toggleUserVerification(userId: string, isVerified: boolean, adminId: string) {
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      relations: ['globalBuyer', 'exporter']
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.update(userId, { isVerified });

    // Update role-specific verification
    if (user.role === UserRole.EXPORTER && user.exporter) {
      await this.exporterRepository.update(user.exporter.id, {
        verificationStatus: isVerified ? VerificationStatus.APPROVED : VerificationStatus.PENDING
      });
    } else if (user.role === UserRole.GLOBAL_BUYER && user.globalBuyer) {
      await this.globalBuyerRepository.update(user.globalBuyer.id, {
        verificationTier: isVerified ? BuyerVerificationTier.FULL : BuyerVerificationTier.NONE
      });
    }

    await this.logAdminAction(adminId, `${isVerified ? 'Verified' : 'Unverified'} user: ${user.email}`);

    return { success: true, message: `User ${isVerified ? 'verified' : 'unverified'} successfully` };
  }

  // Get all exporters with filtering and pagination
  async getAllExporters(page: number = 1, limit: number = 20, filters?: {
    verificationStatus?: string;
    isVerified?: boolean;
    search?: string;
  }) {
    const skip = (page - 1) * limit;
    
    const queryBuilder = this.exporterRepository.createQueryBuilder('exporter')
      .leftJoinAndSelect('exporter.user', 'user')
      .select([
        'exporter.id',
        'exporter.verificationStatus',
          'exporter.businessDescription',
        'exporter.productCategories',
        'exporter.yearsInBusiness',
        'exporter.exportCapacityPerMonth',
        'exporter.isVerified',
        'exporter.createdAt',
        'exporter.updatedAt',
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.role',
        'user.companyName',
        'user.countryName',
        'user.phoneNumber',
        'user.isVerified',
        'user.isActive',
        'user.status'
      ])
      .skip(skip)
      .take(limit)
      .orderBy('exporter.createdAt', 'DESC');

    if (filters?.verificationStatus) {
      queryBuilder.andWhere('exporter.verificationStatus = :verificationStatus', 
        { verificationStatus: filters.verificationStatus });
    }

    if (filters?.isVerified !== undefined) {
      queryBuilder.andWhere('exporter.isVerified = :isVerified', 
        { isVerified: filters.isVerified });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR user.companyName ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    const [exporters, total] = await queryBuilder.getManyAndCount();

    // Transform the data to match frontend AdminUser interface expectations
    const transformedExporters = exporters.map(exporter => ({
      id: exporter.user.id,
      email: exporter.user.email,
      firstName: exporter.user.firstName,
      lastName: exporter.user.lastName,
      role: exporter.user.role,
      companyName: exporter.user.companyName,
      countryName: exporter.user.countryName,
      phoneNumber: exporter.user.phoneNumber,
      isVerified: exporter.user.isVerified,
      isActive: exporter.user.isActive,
      status: exporter.user.status,
      createdAt: exporter.createdAt,
      updatedAt: exporter.updatedAt,
      exporter: {
        id: exporter.id,
        verificationStatus: exporter.verificationStatus,
        businessDescription: exporter.businessDescription,
        productCategories: exporter.productCategories,
        exportDestinations: exporter.exportDestinations,
      }
    }));

    return {
      exporters: transformedExporters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get all global buyers with filtering and pagination
  async getAllGlobalBuyers(page: number = 1, limit: number = 20, filters?: {
    verificationTier?: string;
    isVerified?: boolean;
    search?: string;
  }) {
    const skip = (page - 1) * limit;
    
    const queryBuilder = this.globalBuyerRepository.createQueryBuilder('buyer')
      .leftJoinAndSelect('buyer.user', 'user')
      .leftJoinAndSelect('buyer.verificationDocuments', 'docs')
      .select([
        'buyer.id',
        'buyer.verificationTier',
        'buyer.buyerType',
        'buyer.businessDescription',
        'buyer.interestedCategories',
        'buyer.operatingCountries',
        'buyer.status',
        'buyer.createdAt',
        'buyer.updatedAt',
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.role',
        'user.companyName',
        'user.countryName',
        'user.phoneNumber',
        'user.isVerified',
        'user.isActive',
        'user.status',
        'docs.id',
        'docs.documentType',
        'docs.status'
      ])
      .skip(skip)
      .take(limit)
      .orderBy('buyer.createdAt', 'DESC');

    if (filters?.verificationTier) {
      queryBuilder.andWhere('buyer.verificationTier = :verificationTier', 
        { verificationTier: filters.verificationTier });
    }

    if (filters?.isVerified !== undefined) {
      queryBuilder.andWhere('user.isVerified = :isVerified', 
        { isVerified: filters.isVerified });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR user.companyName ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    const [buyers, total] = await queryBuilder.getManyAndCount();

    // Transform the data to match frontend expectations
    const transformedBuyers = buyers.map(buyer => ({
      id: buyer.user.id,
      email: buyer.user.email,
      firstName: buyer.user.firstName,
      lastName: buyer.user.lastName,
      role: buyer.user.role,
      companyName: buyer.user.companyName,
      countryName: buyer.user.countryName,
      phoneNumber: buyer.user.phoneNumber,
      isVerified: buyer.user.isVerified,
      isActive: buyer.user.isActive,
      status: buyer.user.status,
      createdAt: buyer.createdAt,
      updatedAt: buyer.updatedAt,
      globalBuyer: {
        id: buyer.id,
        verificationTier: buyer.verificationTier,
        buyerType: buyer.buyerType,
        businessDescription: buyer.businessDescription,
        interestedCategories: buyer.interestedCategories,
        operatingCountries: buyer.operatingCountries,
      }
    }));

    return {
      buyers: transformedBuyers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get detailed user information including all related data
  async getUserDetails(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['globalBuyer', 'globalBuyer.verificationDocuments', 'exporter'],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        countryCode: true,
        countryName: true,
        role: true,
        companyName: true,
        isVerified: true,
        isActive: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      // Add additional metadata for admin use
      metadata: {
        totalDocuments: user.globalBuyer?.verificationDocuments?.length || 0,
  pendingDocuments: user.globalBuyer?.verificationDocuments?.filter(doc => doc.status === VerificationStatus.PENDING)?.length || 0,
        hasVerificationDocuments: user.exporter?.verificationDocuments !== null,
        lastActivity: user.updatedAt,
      }
    };
  }

  // Enhanced dashboard statistics with more details
  async getDashboardStats() {
    const [
      totalUsers,
      totalExporters,
      totalBuyers,
      pendingVerifications,
      recentRegistrations,
      // Additional stats
      verifiedExporters,
      verifiedBuyers,
      pendingExporterDocs,
      pendingBuyerDocs,
      activeUsers,
      suspendedUsers
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { role: UserRole.EXPORTER } }),
      this.userRepository.count({ where: { role: UserRole.GLOBAL_BUYER } }),
      this.userRepository.count({ where: { isVerified: false } }),
      this.userRepository.find({
        take: 10,
        order: { createdAt: 'DESC' },
        select: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt']
      }),
      // Additional counts
      this.exporterRepository.count({ where: { isVerified: true } }),
      this.globalBuyerRepository.count({ where: { verificationTier: BuyerVerificationTier.FULL } }),
      this.exporterRepository.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
  this.verificationDocRepository.count({ where: { status: VerificationStatus.PENDING } }),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { status: UserStatus.SUSPENDED } })
    ]);

    return {
      totalUsers,
      totalExporters,
      totalBuyers,
      activeUsers,
      suspendedUsers,
      pendingVerifications,
      verifiedExporters,
      verifiedBuyers,
      pendingExporterDocs,
      pendingBuyerDocs,
      recentRegistrations,
      verificationRate: totalUsers > 0 ? ((totalUsers - pendingVerifications) / totalUsers * 100).toFixed(1) : '0',
      exporterVerificationRate: totalExporters > 0 ? ((verifiedExporters / totalExporters) * 100).toFixed(1) : '0',
      buyerVerificationRate: totalBuyers > 0 ? ((verifiedBuyers / totalBuyers) * 100).toFixed(1) : '0',
    };
  }

  // Get verification documents
// admin-user.service.ts
async getVerificationDocuments(page = 1, limit = 20, status?: VerificationStatus | string) {
  let buyers: any[] = [];
  let buyersCount = 0;

  // Valid document statuses (from VerificationDocument entity enum)
  const validDocStatuses = ['pending', 'under_review', 'approved', 'rejected'];
  // Valid buyer statuses (from GlobalBuyer entity)
  const validBuyerStatuses = ['not_started', 'in_progress', 'submitted', 'under_review', 'approved', 'rejected'];

  try {
    // If a status filter is provided, fetch buyers based on matching verification documents
    if (status) {
      const requestedStatuses = Array.isArray(status) ? status : status.split(',');
      
      // Separate statuses for document query vs buyer query
      const docStatuses = requestedStatuses.filter(s => validDocStatuses.includes(s));
      const buyerStatuses = requestedStatuses.filter(s => validBuyerStatuses.includes(s));

      const buyerMap = new Map<string, any>();

      // Find documents matching the requested statuses (only if we have valid doc statuses)
      if (docStatuses.length > 0) {
        const matchedDocs = await this.verificationDocRepository
          .createQueryBuilder('doc')
          .leftJoinAndSelect('doc.buyer', 'buyer')
          .leftJoinAndSelect('buyer.user', 'user')
          .where('doc.status IN (:...docStatuses)', { docStatuses })
          .getMany();

        // Group documents by buyer id
        for (const d of matchedDocs) {
          if (!d.buyer) continue;
          const bId = d.buyer.id;
          if (!buyerMap.has(bId)) {
            buyerMap.set(bId, { buyer: d.buyer, docs: [] });
          }
          buyerMap.get(bId).docs.push(d);
        }
      }

      // Also include buyers whose global buyer.status matches the requested statuses
      if (buyerStatuses.length > 0) {
        const buyersByStatus = await this.globalBuyerRepository
          .createQueryBuilder('buyer')
          .leftJoinAndSelect('buyer.user', 'user')
          .leftJoinAndSelect('buyer.verificationDocuments', 'docs')
          .where('buyer.status IN (:...buyerStatuses)', { buyerStatuses })
          .getMany();

        for (const b of buyersByStatus) {
          if (!buyerMap.has(b.id)) {
            buyerMap.set(b.id, { buyer: b, docs: b.verificationDocuments || [] });
          }
        }
      }

      // Convert to array of buyers (do NOT apply per-entity pagination here)
      const allBuyerEntries = Array.from(buyerMap.values()).map((entry) => ({ buyer: entry.buyer, docs: entry.docs }));
      buyersCount = allBuyerEntries.length;

      // Attach verificationDocuments for later normalization step
      buyers = allBuyerEntries.map((entry) => ({ ...entry.buyer, verificationDocuments: entry.docs }));
    } else {
      const qbBuyer = this.globalBuyerRepository.createQueryBuilder('buyer')
        .leftJoinAndSelect('buyer.user', 'user')
        .leftJoinAndSelect('buyer.verificationDocuments', 'documents')
        .skip((page - 1) * limit)
        .take(limit);

      const result = await qbBuyer.getManyAndCount();
      buyers = result[0];
      buyersCount = result[1];
    }

  // Valid exporter verification statuses
  const validExporterStatuses = ['pending', 'under_review', 'approved', 'rejected'];

  const qbExporter = this.exporterRepository.createQueryBuilder('exporter')
    .leftJoinAndSelect('exporter.user', 'user');

  if (status) {
    const requestedStatuses = Array.isArray(status) ? status : status.split(',');
    // Filter to only valid exporter statuses
    const exporterStatuses = requestedStatuses.filter(s => validExporterStatuses.includes(s));
    
    if (exporterStatuses.length > 0) {
      qbExporter.andWhere('exporter.verificationStatus IN (:...exporterStatuses)', { exporterStatuses });
      // When status filter is present we'll fetch the full set and apply unified pagination later
      const [exportersFull] = await qbExporter.getManyAndCount();
      var exportersList = exportersFull;
      var exportersCount = exportersList.length;
    } else {
      // No valid exporter statuses requested, return empty
      var exportersList = [] as typeof exportersList;
      var exportersCount = 0;
    }
  } else {
    qbExporter.skip((page - 1) * limit).take(limit);
    const [exporters, exportersCountTemp] = await qbExporter.getManyAndCount();
    var exportersList = exporters;
    var exportersCount = exportersCountTemp;
  }

    const buyerResults = await Promise.all(buyers.map(async (buyer) => {
    // If verificationDocuments already attached (from status-based lookup), use them; otherwise fetch persisted docs
    const docs =
      (buyer.verificationDocuments && buyer.verificationDocuments.length)
        ? buyer.verificationDocuments
        : await this.verificationDocRepository.find({ where: { buyer: { id: buyer.id } } });

    return {
      id: buyer.id,
      type: 'buyer' as const,
      user: {
        id: buyer.user.id,
        email: buyer.user.email,
        firstName: buyer.user.firstName,
        lastName: buyer.user.lastName,
        companyName: buyer.user.companyName,
        role: buyer.user.role,
        isVerified: buyer.user.isVerified,
        isActive: buyer.user.isActive,
        status: buyer.user.status,
        phoneNumber: buyer.user.phoneNumber,
        countryName: buyer.user.countryName,
      },
      documents: docs.map(d => ({ documentType: d.documentType, fileUrl: d.fileUrl, status: d.status, uploadedAt: d.uploadedAt })),
      status: buyer.status,
      uploadedAt: buyer.createdAt,
      entityId: buyer.id,
    };
  }));
  

  // Normalize Exporter docs by fetching persisted verification documents
  const exporterResults = await Promise.all(exportersList.map(async (exporter) => {
    const docs = await this.verificationDocRepository.find({ where: { exporter: { id: exporter.id } } });
    return {
      id: exporter.id,
      type: 'exporter' as const,
      user: {
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
      },
      documents: docs.map(d => ({ documentType: d.documentType, fileUrl: d.fileUrl, status: d.status, uploadedAt: d.uploadedAt })),
      status: exporter.verificationStatus,
      uploadedAt: exporter.createdAt,
      entityId: exporter.id,
    };
  }));

  // Combine buyer and exporter results, sort by uploadedAt and apply unified pagination
  const combined = [...buyerResults, ...exporterResults];
  combined.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  const skip = (page - 1) * limit;
  const paged = combined.slice(skip, skip + limit);

  return {
    data: paged,
    pagination: {
      page,
      limit,
      total: buyersCount + exportersCount,
      totalPages: Math.ceil((buyersCount + exportersCount) / limit),
    },
  };
  } catch (error) {
    console.error('Error fetching verification documents:', error);
    throw error;
  }
}

  // Get all pending documents (both buyer and exporter)
  async getAllPendingDocuments(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    // First, let's check if there are ANY buyer documents at all
    const totalBuyerDocs = await this.verificationDocRepository.count();
 
    
    // Get buyer documents (pending verification)
    const buyerDocsQuery = this.verificationDocRepository.createQueryBuilder('doc')
      .leftJoinAndSelect('doc.buyer', 'buyer')
      .leftJoinAndSelect('buyer.user', 'user')
      .select([
        'doc.id',
        'doc.documentType',
        'doc.fileUrl',
        'doc.status',
        'doc.uploadedAt',
        'buyer.id',
        'buyer.businessDescription',
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.companyName'
      ])
  .where('doc.status IN (:...statuses)', { statuses: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW] })
      .orderBy('doc.uploadedAt', 'DESC');

    const [buyerDocs, buyerTotal] = await buyerDocsQuery.getManyAndCount();
    
   
    
    // If no docs with status filter, let's try without any filter
    if (buyerDocs.length === 0) {
      const allBuyerDocsQuery = this.verificationDocRepository.createQueryBuilder('doc')
        .leftJoinAndSelect('doc.buyer', 'buyer')
        .leftJoinAndSelect('buyer.user', 'user')
        .select([
          'doc.id',
          'doc.documentType',
          'doc.fileUrl',
          'doc.status',
          'doc.uploadedAt',
          'buyer.id',
          'buyer.businessDescription',
          'user.id',
          'user.email',
          'user.firstName',
          'user.lastName',
          'user.companyName'
        ])
        .orderBy('doc.uploadedAt', 'DESC');

      const [allBuyerDocs] = await allBuyerDocsQuery.getManyAndCount();
     
    
    }

    // Get exporter documents (those with pending verification status)
    const exporterDocsQuery = this.exporterRepository.createQueryBuilder('exporter')
      .leftJoinAndSelect('exporter.user', 'user')
      .select([
        'exporter.id',
        'exporter.verificationStatus',
        'exporter.createdAt',
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.companyName'
      ])
      .where('exporter.verificationStatus = :status', { status: VerificationStatus.PENDING })
      .orderBy('exporter.createdAt', 'DESC');

    const [exporterDocs, exporterTotal] = await exporterDocsQuery.getManyAndCount();

    // Combine and format results
    const allDocuments = [
      ...buyerDocs.map(doc => ({
        id: doc.id,
        type: 'buyer',
        documentType: doc.documentType,
        fileUrl: doc.fileUrl,
        status: doc.status,
        uploadedAt: doc.uploadedAt,
        user: {
          id: doc.buyer.user.id,
          email: doc.buyer.user.email,
          firstName: doc.buyer.user.firstName,
          lastName: doc.buyer.user.lastName,
          companyName: doc.buyer.user.companyName
        },
        entityId: doc.buyer.id
      })),
      ...await Promise.all(exporterDocs.map(async (exporter) => ({
        id: exporter.id,
        type: 'exporter',
        documentType: 'verification_package',
        documents: await this.verificationDocRepository.find({ where: { exporter: { id: exporter.id } } }),
        status: exporter.verificationStatus,
        uploadedAt: exporter.createdAt,
        user: {
          id: exporter.user.id,
          email: exporter.user.email,
          firstName: exporter.user.firstName,
          lastName: exporter.user.lastName,
          companyName: exporter.user.companyName
        },
        entityId: exporter.id
      })))
    ];

    // Sort by upload date and paginate
    allDocuments.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    const paginatedDocs = allDocuments.slice(skip, skip + limit);

    return {
      documents: paginatedDocs,
      pagination: {
        page,
        limit,
        total: buyerTotal + exporterTotal,
        totalPages: Math.ceil((buyerTotal + exporterTotal) / limit),
      },
    };
  }


  // Approve/Reject buyer verification document
  async updateBuyerDocumentStatus(buyerId: string, status: 'approved' | 'rejected', adminId: string, rejectionReason?: string) {
     const buyer = await this.globalBuyerRepository.findOne({
      where: { id: buyerId },
      relations: ['user']
    });

    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    //
    // Only two valid outcomes: approved or rejected. Use VerificationStatus enum
    if (status === VerificationStatus.APPROVED) {
      // Mirror exporter behavior: mark buyer as approved and record reviewer metadata
      // Set FULL tier when admin approves
      await this.globalBuyerRepository.update(buyerId, {
        status: VerificationStatus.APPROVED,
        reviewerName: adminId,
        approvedDate: new Date(),
        reviewNotes: 'Documents approved by admin',
        verificationTier: BuyerVerificationTier.FULL,
      });

      await this.userRepository.update(buyer.user.id, { isVerified: true });

    } else if (status === 'rejected') {
      // Mirror exporter rejection: mark buyer as rejected and save reviewer notes
      await this.globalBuyerRepository.update(buyerId, {
        status: 'rejected',
        reviewerName: adminId,
        approvedDate: new Date(),
        reviewNotes: rejectionReason || 'Documents rejected by admin',
      });

      await this.userRepository.update(buyer.user.id, { isVerified: false });

    } else {
      // Defensive: if an unexpected status value is passed, reject the operation
      throw new BadRequestException('Invalid status value. Allowed values are "approved" or "rejected".');
    }



    await this.logAdminAction(adminId, `${status} buyer document for user: ${buyer.user.email}${rejectionReason ? ` - Reason: ${rejectionReason}` : ''}`);

    return { 
      success: true, 
      message: `Document ${status} successfully${status === 'rejected' ? ' and deleted for re-upload' : ''}` 
    };
  }

  // Approve/Reject exporter verification
  async updateExporterVerificationStatus(exporterId: string, status: 'approved' | 'rejected', adminId: string, rejectionReason?: string) {
    const exporter = await this.exporterRepository.findOne({
      where: { id: exporterId },
      relations: ['user']
    });

    if (!exporter) {
      throw new NotFoundException('Exporter not found');
    }
  
    if (status === VerificationStatus.APPROVED) {
      // Set FULL tier when admin approves
      await this.exporterRepository.update(exporterId, { 
        verificationStatus: VerificationStatus.APPROVED,
        isVerified: true,
        verificationTier: ExporterVerificationTier.FULL,
        verificationReviewedBy: adminId,
        verificationReviewedAt: new Date(),
        verificationNotes: 'Documents approved by admin'
      });
      
      await this.userRepository.update(exporter.user.id, { isVerified: true });
    }
    if (status === 'rejected') {
      await this.exporterRepository.update(exporterId, { 
      verificationStatus: VerificationStatus.REJECTED,
      isVerified: false,
      verificationReviewedBy: adminId,
      verificationReviewedAt: new Date(),
      verificationNotes: rejectionReason || 'Documents rejected by admin'
      });
      await this.userRepository.update(exporter.user.id, { isVerified: false });
    }

    await this.logAdminAction(adminId, `${status} exporter verification for user: ${exporter.user.email}${rejectionReason ? ` - Reason: ${rejectionReason}` : ''}`);

    return { 
      success: true, 
      message: `Exporter verification ${status} successfully${status === 'rejected' ? ' - documents cleared for re-upload' : ''}` 
    };
  }

  // Get document verification details
  async getDocumentDetails(documentId: string, type: 'buyer' | 'exporter') {
    if (type === 'buyer') {
      const document = await this.verificationDocRepository.findOne({
        where: { id: documentId },
        relations: ['buyer', 'buyer.user']
      });

      if (!document) {
        throw new NotFoundException('Buyer document not found');
      }

      return {
        id: document.id,
        type: 'buyer',
        documentType: document.documentType,
        fileUrl: document.fileUrl,
        status: document.status,
        uploadedAt: document.uploadedAt,
        user: {
          id: document.buyer.user.id,
          email: document.buyer.user.email,
          firstName: document.buyer.user.firstName,
          lastName: document.buyer.user.lastName,
          companyName: document.buyer.user.companyName
        },
        buyer: {
          id: document.buyer.id,
          businessDescription: document.buyer.businessDescription,
          buyerType: document.buyer.buyerType,
          verificationTier: document.buyer.verificationTier
        }
      };
    } else {
      const exporter = await this.exporterRepository.findOne({
        where: { id: documentId },
        relations: ['user']
      });

      if (!exporter) {
        throw new NotFoundException('Exporter not found');
      }

      const docs = await this.verificationDocRepository.find({ where: { exporter: { id: exporter.id } } });
      return {
        id: exporter.id,
        type: 'exporter',
        documents: docs.map(d => ({ documentType: d.documentType, fileUrl: d.fileUrl, status: d.status, uploadedAt: d.uploadedAt })),
        status: exporter.verificationStatus,
        uploadedAt: exporter.createdAt,
        verificationNotes: exporter.verificationNotes,
        user: {
          id: exporter.user.id,
          email: exporter.user.email,
          firstName: exporter.user.firstName,
          lastName: exporter.user.lastName,
          companyName: exporter.user.companyName
        },
        exporter: {
          id: exporter.id,
          businessDescription: exporter.businessDescription,
          productCategories: exporter.productCategories,
          yearsInBusiness: exporter.yearsInBusiness,
          exportCapacityPerMonth: exporter.exportCapacityPerMonth
        }
      };
    }
  }

  // Debug method to check all buyer documents
  async getAllBuyerDocuments() {
    const allDocs = await this.verificationDocRepository.find({
      relations: ['buyer', 'buyer.user'],
      select: {
        id: true,
        documentType: true,
        status: true,
        uploadedAt: true,
        buyer: {
          id: true,
          user: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
  
    
    return allDocs;
  }

  // Debug method to check all exporters (for debugging only)
  async debugGetAllExporters() {
    const allExporters = await this.exporterRepository.find({ relations: ['user'] });
    const withDocs = await Promise.all(allExporters.map(async (exp) => {
      const docs = await this.verificationDocRepository.find({ where: { exporter: { id: exp.id } } });
      // sanitize nested user on exporter before returning
      const safeExporterUser = exp.user ? ({
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
      }) : null;

      const safeExporter = {
        id: exp.id,
        verificationStatus: exp.verificationStatus,
        businessDescription: exp.businessDescription,
        productCategories: exp.productCategories,
        yearsInBusiness: exp.yearsInBusiness,
        exportCapacityPerMonth: exp.exportCapacityPerMonth,
        isVerified: exp.isVerified,
        createdAt: exp.createdAt,
        updatedAt: exp.updatedAt,
        user: safeExporterUser,
      };

      return { exporter: safeExporter, documents: docs };
    }));



    return withDocs;
  }

  // Search users with advanced filtering
  async searchUsers(searchDto: {
    search?: string;
    role?: UserRole;
    status?: UserStatus;
    isVerified?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const skip = (page - 1) * limit;
    
    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.globalBuyer', 'globalBuyer')
      .leftJoinAndSelect('user.exporter', 'exporter')
      .select([
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.phoneNumber',
        'user.countryName',
        'user.role',
        'user.companyName',
        'user.isVerified',
        'user.isActive',
        'user.status',
        'user.createdAt',
        'user.updatedAt',
        'globalBuyer.id',
        'globalBuyer.verificationTier',
        'globalBuyer.buyerType',
        'exporter.id',
        'exporter.verificationStatus',
        'exporter.businessDescription'
      ])
      .skip(skip)
      .take(limit)
      .orderBy('user.createdAt', 'DESC');

    if (searchDto.search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR user.companyName ILIKE :search)',
        { search: `%${searchDto.search}%` }
      );
    }

    if (searchDto.role) {
      queryBuilder.andWhere('user.role = :role', { role: searchDto.role });
    }

    if (searchDto.status) {
      queryBuilder.andWhere('user.status = :status', { status: searchDto.status });
    }

    if (searchDto.isVerified !== undefined) {
      queryBuilder.andWhere('user.isVerified = :isVerified', { isVerified: searchDto.isVerified });
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Bulk user operations
  async bulkUserAction(
    userIds: string[],
    action: 'activate' | 'deactivate' | 'verify' | 'unverify' | 'suspend',
    adminId: string
  ) {
    const results = [];
    
    for (const userId of userIds) {
      try {
        switch (action) {
          case 'activate':
            await this.toggleUserStatus(userId, true, adminId);
            break;
          case 'deactivate':
            await this.toggleUserStatus(userId, false, adminId);
            break;
          case 'verify':
            await this.toggleUserVerification(userId, true, adminId);
            break;
          case 'unverify':
            await this.toggleUserVerification(userId, false, adminId);
            break;
          case 'suspend':
            await this.userRepository.update(userId, { 
              status: UserStatus.SUSPENDED,
              isActive: false 
            });
            await this.logAdminAction(adminId, `Suspended user: ${userId}`);
            break;
        }
        results.push({ userId, success: true });
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }

    return {
      success: true,
      message: `Bulk ${action} operation completed`,
      results,
      totalProcessed: userIds.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
    };
  }

  // Export user data
  async exportUsers(
    format: 'csv' | 'excel',
    filters?: { role?: UserRole; status?: UserStatus }
  ) {
    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.globalBuyer', 'globalBuyer')
      .leftJoinAndSelect('user.exporter', 'exporter')
      .select([
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.phoneNumber',
        'user.countryName',
        'user.role',
        'user.companyName',
        'user.isVerified',
        'user.isActive',
        'user.status',
        'user.createdAt',
        'globalBuyer.verificationTier',
        'globalBuyer.buyerType',
        'exporter.verificationStatus',
        'exporter.businessDescription'
      ])
      .orderBy('user.createdAt', 'DESC');

    if (filters?.role) {
      queryBuilder.andWhere('user.role = :role', { role: filters.role });
    }

    if (filters?.status) {
      queryBuilder.andWhere('user.status = :status', { status: filters.status });
    }

    const users = await queryBuilder.getMany();

    // Transform data for export
    const exportData = users.map(user => ({
      ID: user.id,
      Email: user.email,
      'First Name': user.firstName,
      'Last Name': user.lastName,
      'Company Name': user.companyName || '',
      'Phone Number': user.phoneNumber || '',
      Country: user.countryName || '',
      Role: user.role,
      'Is Verified': user.isVerified ? 'Yes' : 'No',
      'Is Active': user.isActive ? 'Yes' : 'No',
      Status: user.status,
      'Registration Date': user.createdAt.toISOString().split('T')[0],
      'Verification Tier': user.globalBuyer?.verificationTier || '',
      'Buyer Type': user.globalBuyer?.buyerType || '',
      'Exporter Verification': user.exporter?.verificationStatus || '',
    }));

    return {
      format,
      data: exportData,
      count: exportData.length,
      generatedAt: new Date().toISOString(),
      filename: `users_export_${new Date().toISOString().split('T')[0]}.${format}`,
    };
  }

  // Get user activity logs (placeholder - in production, you'd have a dedicated activity log table)
  async getUserActivity(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    // For now, return audit logs related to this user
    const auditResponse = await this.auditService.getAdminActivityLogs(1, 100);
    
    // Filter logs related to this user
    const userLogs = auditResponse.logs.filter(log => 
      log.action.includes(userId) || log.details?.userId === userId
    );

    const paginatedLogs = userLogs.slice(skip, skip + limit);

    return {
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        total: userLogs.length,
        totalPages: Math.ceil(userLogs.length / limit),
      },
    };
  }

  // Private method to log admin actions
  private async logAdminAction(adminId: string, action: string) {
    await this.auditService.logAdminAction(adminId, action);
  }

  
}