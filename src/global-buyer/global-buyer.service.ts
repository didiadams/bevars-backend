
import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, In } from 'typeorm';
import { GlobalBuyerRepository } from './repositories/global-buyer.repository';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateGlobalBuyerDto } from './dto/create-global-buyer.dto';
import { UpdateGlobalBuyerDto } from './dto/update-global-buyer.dto';
import { GlobalBuyerProfileDto } from './dto/global-buyer-profile.dto';
import { GlobalBuyer } from './entities/global-buyer.entity';
import { VerificationDocument } from 'src/common/entities/verification-document.entity';
import { VerificationRequirement } from 'src/common/entities/verification-requirement.entity';
import { User } from '../user/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';
import { Exporter } from '../exporter/entities/exporter.entity';
import { SourcingRequest, RequestStatus } from '../sourcing-request/entities/sourcing-request.entity';
import { Offer } from '../offer/entities/offer.entity';
import { VerificationStatus } from '../exporter/entities/exporter.entity';


@Injectable()
export class GlobalBuyerService {
  // Fetch a single verification document by documentId (correct placement inside class)
  async getVerificationDocument(userId: string, documentId: string) {
    const buyer = await this.findByUserId(userId);
    // Always read verification documents from the persisted shared verification table
    const doc = await this.sharedVerificationRepo.findOne({ where: { buyer: { id: buyer.id }, documentType: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    return { documentId, fileUrl: doc.fileUrl, fileName: doc.fileName, status: doc.status, uploadedAt: doc.uploadedAt };
  }
  // List uploaded documents for a user (persistent)
  async listVerificationDocuments(userId: string) {
    const buyer = await this.findByUserId(userId);
    // Always return persisted shared verification documents
    const persisted = await this.sharedVerificationRepo.find({ where: { buyer: { id: buyer.id } } });
    if (!persisted || persisted.length === 0) return [];
    return persisted.map(d => ({ documentId: d.documentType, fileUrl: d.fileUrl, fileName: d.fileName, status: d.status, uploadedAt: d.uploadedAt }));
  }

  // Delete an uploaded document (persistent)
  async deleteVerificationDocument(userId: string, documentId: string) {
    const buyer = await this.findByUserId(userId);
    // Only remove persisted verification documents. Legacy buyer columns are no longer used.
    const persisted = await this.sharedVerificationRepo.findOne({ where: { buyer: { id: buyer.id }, documentType: documentId } });
    if (!persisted) throw new NotFoundException('Document not found');
    await this.sharedVerificationRepo.remove(persisted);
    return { success: true };
  }
  constructor(
    private readonly globalBuyerRepository: GlobalBuyerRepository,
    @Inject(forwardRef(() => CloudinaryService))
    private readonly cloudinaryService: CloudinaryService,
    @InjectRepository(VerificationDocument)
    private readonly sharedVerificationRepo: Repository<VerificationDocument>,
  @InjectRepository(VerificationRequirement)
  private readonly verificationRequirementRepository: Repository<VerificationRequirement>,
    @InjectRepository(Exporter)
    private readonly exporterRepository: Repository<Exporter>,
    @InjectRepository(SourcingRequest)
    private readonly sourcingRequestRepository: Repository<SourcingRequest>,
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
  ) {}

  async create(createDto: CreateGlobalBuyerDto & { userId: string }): Promise<GlobalBuyer> {
    const globalBuyer = this.globalBuyerRepository.create({
      ...createDto,
      userId: createDto.userId,
    });

    return this.globalBuyerRepository.save(globalBuyer as any as GlobalBuyer);
  }

  // Verification document upload and status tracking
  // Removed in-memory verificationStore. All verification data is now persisted in the database.

  async getVerificationOverview(userId: string) {
    const buyer = await this.findByUserId(userId);
    // Get required document types from DB for buyer. If none are configured yet,
    // fall back to the default list used by the frontend so totalRequired isn't 0.
    const requirements = await this.verificationRequirementRepository.find({ where: { ownerType: 'buyer' } });
    let requiredTypes = requirements.filter(r => r.required).map(r => r.documentType);
    if (!requiredTypes || requiredTypes.length === 0) {
      // Fallback default (mirror frontend `globalBuyerDocumentRequirements` required items)
      requiredTypes = [
        'company_registration',
        'business_license',
        'tax_registration',
        'bank_statement',
        'financial_statement',
      ];
    }

    // Count persisted documents first
    const persistedCount = await this.sharedVerificationRepo.count({ where: { buyer: { id: buyer.id }, documentType: In(requiredTypes) } });
    // Only consider persisted documents for verification progress
    const documentsUploaded = persistedCount;
    const totalRequired = requiredTypes.length;
    const status = buyer.status || 'not_started';
    const reviewNotes = buyer.reviewNotes;
    const submittedDate = buyer.submittedDate;
    const approvedDate = buyer.approvedDate;
    const reviewerName = buyer.reviewerName;
    const creditRating = buyer.creditRating;
    const verificationTier = buyer.verificationTier || 'standard';
    return {
      status,
      documentsUploaded,
      totalRequired,
      reviewNotes,
      submittedDate,
      approvedDate,
      reviewerName,
      creditRating,
      verificationTier,
    };
  }

  async uploadVerificationDocument(userId: string, documentId: string, fileName: string, file: Express.Multer.File) {
    const buyer = await this.findByUserId(userId);
    const result = await this.cloudinaryService.uploadImage(file);
    const fileUrl = typeof result === 'object' && 'secure_url' in result ? result.secure_url : '';
    // Persist to shared verification table for richer metadata
    const doc = this.sharedVerificationRepo.create({
      buyer: buyer,
      ownerId: buyer.id,
      documentType: documentId,
      fileUrl,
      fileName,
      mimeType: file?.mimetype || null,
      status: VerificationStatus.PENDING,
    });
    await this.sharedVerificationRepo.save(doc);
    return { success: true, fileUrl };
// Ensure GlobalBuyer entity has these columns:
// companyRegistrationUrl: string
// businessLicenseUrl: string
// taxRegistrationUrl: string
// bankStatementUrl: string
// financialStatementUrl: string
// tradeReferencesUrl: string
// creditReportUrl: string
// facilityPhotosUrl: string
// certificationsUrl: string
  }

  async submitVerification(userId: string) {
    // Persist status in database
    const buyer = await this.findByUserId(userId);
    if (!buyer) throw new NotFoundException('Buyer not found');
    // Mark as under review and record submitted timestamp
    buyer.status = VerificationStatus.UNDER_REVIEW;
    buyer.submittedDate = new Date();
    await this.globalBuyerRepository.save(buyer);

    // No longer using in-memory store
    return { success: true };
  }

  async getVerificationMessages(userId: string) {
  // TODO: If you want to persist messages, store them in the database (not in memory)
  // For now, return an empty array or fetch from DB if implemented
  return [];
  }

  async addVerificationMessage(userId: string, from: string, message: string, type: string = 'info') {
  // TODO: Persist messages to the database if needed
  return { success: true };
  }

  async findOne(id: string): Promise<GlobalBuyer> {
    const globalBuyer = await this.globalBuyerRepository.findOne({
      where: { id },
      relations: ['user', 'sourcingRequests'],
    });

    if (!globalBuyer) {
      throw new NotFoundException('Global buyer not found');
    }

    // sanitize nested user
    if (globalBuyer && (globalBuyer as any).user) {
      (globalBuyer as any).user = ({
        id: (globalBuyer as any).user.id,
        email: (globalBuyer as any).user.email,
        firstName: (globalBuyer as any).user.firstName,
        lastName: (globalBuyer as any).user.lastName,
        companyName: (globalBuyer as any).user.companyName,
        role: (globalBuyer as any).user.role,
        isVerified: (globalBuyer as any).user.isVerified,
        isActive: (globalBuyer as any).user.isActive,
        status: (globalBuyer as any).user.status,
        phoneNumber: (globalBuyer as any).user.phoneNumber,
        countryName: (globalBuyer as any).user.countryName,
      }) as any;
    }

    return globalBuyer;
  }

  async findByUserId(userId: string): Promise<GlobalBuyer> {
    const globalBuyer = await this.globalBuyerRepository.findByUserId(userId);

    if (!globalBuyer) {
      throw new NotFoundException('Global buyer profile not found');
    }

    if (globalBuyer && (globalBuyer as any).user) {
      (globalBuyer as any).user = ({
        id: (globalBuyer as any).user.id,
        email: (globalBuyer as any).user.email,
        firstName: (globalBuyer as any).user.firstName,
        lastName: (globalBuyer as any).user.lastName,
        companyName: (globalBuyer as any).user.companyName,
        role: (globalBuyer as any).user.role,
        isVerified: (globalBuyer as any).user.isVerified,
        isActive: (globalBuyer as any).user.isActive,
        status: (globalBuyer as any).user.status,
        phoneNumber: (globalBuyer as any).user.phoneNumber,
        countryName: (globalBuyer as any).user.countryName,
      }) as any;
    }

    return globalBuyer;
  }

  async updateByUserId(userId: string, updateDto: UpdateGlobalBuyerDto): Promise<GlobalBuyer> {
    const globalBuyer = await this.findByUserId(userId);
    
    Object.assign(globalBuyer, updateDto);
    return this.globalBuyerRepository.save(globalBuyer as any as GlobalBuyer);
  }

  async getDashboardStats(userId: string): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);
  
    const stats = await this.globalBuyerRepository.getDashboardStats(globalBuyer.id);
    // Debug: cross-check using direct repository count to ensure SQL aggregation correctness
    try {
      const directActiveCount = await this.sourcingRequestRepository.count({ where: { globalBuyerId: globalBuyer.id, status: RequestStatus.ACTIVE } });
      console.log('dashboardStats(repo):', { rawStats: stats, directActiveCount });
    } catch (e) {
      console.warn('Failed to run directActiveCount check', e?.message || e);
    }
    return {
      activeSourcingRequests: stats.activeSourcingRequests || 0,
      totalOffers: stats.totalOffers || 0,
      completedOrders: globalBuyer.totalOrdersPlaced || 0,
      totalSpent: globalBuyer.totalValueOrdered || 0,
      averageOrderValue: stats.averageOrderValue || 0,
      preferredExporters: stats.preferredExporters || 0,
    };
  }

  async getMySourcingRequests(userId: string): Promise<any[]> {
    const globalBuyer = await this.findByUserId(userId);
    return this.globalBuyerRepository.getSourcingRequests(globalBuyer.id);
  }

  async getReceivedOffers(userId: string): Promise<any[]> {
    const globalBuyer = await this.findByUserId(userId);
    return this.globalBuyerRepository.getReceivedOffers(globalBuyer.id);
  }

  async acceptOffer(offerId: string, userId: string): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Logic to accept offer and create order
    // This would integrate with the offer service and order service
    return { message: 'Offer accepted successfully', offerId };
  }

  async rejectOffer(offerId: string, userId: string, reason?: string): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Logic to reject offer with reason
    return { message: 'Offer rejected', offerId, reason };
  }

  async negotiateOffer(offerId: string, userId: string, negotiationData: any): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Logic to create counter-offer or negotiate terms
    return { message: 'Negotiation sent', offerId, negotiationData };
  }

  async addToPreferred(userId: string, exporterId: string): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Note: The GlobalBuyer entity doesn't have preferredExporters field
    // This would need to be implemented with a separate PreferredExporter entity
    // For now, return a placeholder response
    return { message: 'Exporter added to preferred list' };
  }

  async removeFromPreferred(userId: string, exporterId: string): Promise<any> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Note: The GlobalBuyer entity doesn't have preferredExporters field
    // This would need to be implemented with a separate PreferredExporter entity
    // For now, return a placeholder response
    return { message: 'Exporter removed from preferred list' };
  }

  async getPreferredExporters(userId: string): Promise<any[]> {
    const globalBuyer = await this.findByUserId(userId);
    return this.globalBuyerRepository.getPreferredExporters(globalBuyer.id);
  }

  async updatePaymentInfo(userId: string, paymentInfo: any): Promise<GlobalBuyer> {
    const globalBuyer = await this.findByUserId(userId);
    
    // Note: The GlobalBuyer entity doesn't have paymentMethods or billingAddress fields
    // These would need to be added to the entity or implemented in a separate PaymentInfo entity
    globalBuyer.preferredPaymentMethod = paymentInfo.preferredPaymentMethod;
    globalBuyer.creditLimit = paymentInfo.creditLimit;
    
    return this.globalBuyerRepository.save(globalBuyer as any as GlobalBuyer);
  }

  async getDashboardNotifications(userId: string) {
    const buyer = await this.findByUserId(userId);
    
    const notifications = [];

    // Check for new offers on buyer's sourcing requests
    const newOffers = await this.offerRepository.createQueryBuilder('offer')
      .innerJoin('offer.sourcingRequest', 'request')
      .where('request.globalBuyerId = :buyerId', { buyerId: buyer.id })
      .andWhere('offer.status = :status', { status: 'pending' })
      .andWhere('offer.createdAt >= :timeFrame', { 
        timeFrame: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      })
      .getCount();

    if (newOffers > 0) {
      notifications.push({
        id: 1,
        type: "offer",
        message: `${newOffers} new offer${newOffers > 1 ? 's' : ''} received`,
        time: "30m ago",
        urgent: true,
      });
    }

    // Check for expiring sourcing requests
    const expiringRequests = await this.sourcingRequestRepository.count({
      where: {
        globalBuyerId: buyer.id,
        status: RequestStatus.ACTIVE,
        quotationDeadline: Between(
          new Date(),
          new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // Next 2 days
        )
      }
    });

    if (expiringRequests > 0) {
      notifications.push({
        id: 2,
        type: "request",
        message: `${expiringRequests} request${expiringRequests > 1 ? 's' : ''} expiring soon`,
        time: "1h ago",
        urgent: false,
      });
    }

    // Check verification status
    if (buyer.status === 'not_started' || buyer.status === 'in_progress') {
      notifications.push({
        id: 3,
        type: "verification",
        message: "Complete your account verification to access premium features",
        time: "2h ago",
        urgent: false,
      });
    }

    return notifications.slice(0, 5); // Return max 5 notifications
  }

  async getPlatformStats(): Promise<{ verifiedExporters: number; successfulMatchesPercent: number; tradeVolume: number; }>{
    // Verified exporters
    const verifiedExporters = await this.exporterRepository.count({ where: { isVerified: true } });

    // Placeholders until order/match data exists
    const successfulMatchesPercent = 0;
    const tradeVolume = 0;

    return { verifiedExporters, successfulMatchesPercent, tradeVolume };
  }
}
