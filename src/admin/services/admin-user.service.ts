import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../../user/entities/user.entity';
import { GlobalBuyer, VerificationTier } from '../../global-buyer/entities/global-buyer.entity';
import { Exporter, VerificationStatus } from '../../exporter/entities/exporter.entity';
import { BuyerVerificationDocument } from '../../global-buyer/entities/buyer-verification-document.entity';
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
    @InjectRepository(BuyerVerificationDocument)
    private verificationDocRepository: Repository<BuyerVerificationDocument>,
    @Inject(forwardRef(() => AdminAuditService))
    private auditService: AdminAuditService,
  ) {}

  // Get all users with pagination and filtering
  async getAllUsers(page: number = 1, limit: number = 20, role?: UserRole, status?: UserStatus) {
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
        'user.lastLoginAt',
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

    return user;
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

    await this.userRepository.update(userId, { 
      isActive,
      status: isActive ? UserStatus.ACTIVE : UserStatus.SUSPENDED,
    });

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
        verificationTier: isVerified ? VerificationTier.PREMIUM : VerificationTier.STANDARD
      });
    }

    await this.logAdminAction(adminId, `${isVerified ? 'Verified' : 'Unverified'} user: ${user.email}`);

    return { success: true, message: `User ${isVerified ? 'verified' : 'unverified'} successfully` };
  }

  // Get dashboard statistics
  async getDashboardStats() {
    const [
      totalUsers,
      totalExporters,
      totalBuyers,
      pendingVerifications,
      recentRegistrations
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { role: UserRole.EXPORTER } }),
      this.userRepository.count({ where: { role: UserRole.GLOBAL_BUYER } }),
      this.userRepository.count({ where: { isVerified: false } }),
      this.userRepository.find({
        take: 10,
        order: { createdAt: 'DESC' },
        select: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt']
      })
    ]);

    const activeUsers = await this.userRepository.count({ where: { isActive: true } });
    const suspendedUsers = await this.userRepository.count({ where: { status: UserStatus.SUSPENDED } });

    return {
      totalUsers,
      totalExporters,
      totalBuyers,
      activeUsers,
      suspendedUsers,
      pendingVerifications,
      recentRegistrations,
      verificationRate: totalUsers > 0 ? ((totalUsers - pendingVerifications) / totalUsers * 100).toFixed(1) : '0',
    };
  }

  // Get verification documents
  async getVerificationDocuments(page: number = 1, limit: number = 20, status?: string) {
    const skip = (page - 1) * limit;
    
    const queryBuilder = this.verificationDocRepository.createQueryBuilder('doc')
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
      .skip(skip)
      .take(limit)
      .orderBy('doc.uploadedAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('doc.status = :status', { status });
    }

    const [documents, total] = await queryBuilder.getManyAndCount();

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Approve/Reject verification document
  async updateDocumentStatus(documentId: string, status: 'approved' | 'rejected', adminId: string) {
    const document = await this.verificationDocRepository.findOne({
      where: { id: documentId },
      relations: ['buyer', 'buyer.user']
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.verificationDocRepository.update(documentId, { status });

    // If approved, update user verification
    if (status === 'approved') {
      await this.userRepository.update(document.buyer.user.id, { isVerified: true });
      await this.globalBuyerRepository.update(document.buyer.id, { 
        verificationTier: VerificationTier.PREMIUM 
      });
    }

    await this.logAdminAction(adminId, `${status} document for user: ${document.buyer.user.email}`);

    return { success: true, message: `Document ${status} successfully` };
  }

  // Private method to log admin actions
  private async logAdminAction(adminId: string, action: string) {
    await this.auditService.logAdminAction(adminId, action);
  }
}