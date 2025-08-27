
import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalBuyerRepository } from './repositories/global-buyer.repository';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateGlobalBuyerDto } from './dto/create-global-buyer.dto';
import { UpdateGlobalBuyerDto } from './dto/update-global-buyer.dto';
import { GlobalBuyerProfileDto } from './dto/global-buyer-profile.dto';
import { GlobalBuyer } from './entities/global-buyer.entity';
import { BuyerVerificationDocument } from './entities/buyer-verification-document.entity';
import { User } from '../user/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GlobalBuyerService {
  // Fetch a single verification document by documentId (correct placement inside class)
  async getVerificationDocument(userId: string, documentId: string) {
    const buyer = await this.findByUserId(userId);
    // Map frontend document IDs to closest entity columns
    const docColumnMap: Record<string, keyof GlobalBuyer> = {
      company_registration: 'certificateUrl', // Certificate of Incorporation
      business_license: 'businessLicenseUrl',
      tax_registration: 'taxIdUrl',
      bank_statement: 'optionalDoc1Url', // Use optionalDoc1Url for bank statement
      financial_statement: 'optionalDoc2Url', // Use optionalDoc2Url for financial statement
      trade_references: 'passportUrl', // Use passportUrl for trade references (or add new column)
      credit_report: 'photoUrl', // Use photoUrl for credit report (or add new column)
      facility_photos: 'photoUrl', // Use photoUrl for facility photos
    certifications: 'industryCertificationsUrl', // Use new column for industry certifications
    };
    const column = docColumnMap[documentId];
    if (!column) throw new BadRequestException('Invalid document type');
    const fileUrl = (buyer as any)[column];
    if (!fileUrl) throw new NotFoundException('Document not found');
    return { documentId, fileUrl };
  }
  // List uploaded documents for a user (persistent)
  async listVerificationDocuments(userId: string) {
    const buyer = await this.findByUserId(userId);
    // Return all document URLs for the user, matching frontend document IDs
    return [
      {
        documentId: 'company_registration',
        fileUrl: buyer.certificateUrl,
        fileName: buyer.certificateUrl ? 'Company Registration' : undefined,
        uploadedAt: buyer.certificateUrl ? new Date() : undefined,
      },
      {
        documentId: 'business_license',
        fileUrl: buyer.businessLicenseUrl,
        fileName: buyer.businessLicenseUrl ? 'Business License' : undefined,
        uploadedAt: buyer.businessLicenseUrl ? new Date() : undefined,
      },
      {
        documentId: 'tax_registration',
        fileUrl: buyer.taxIdUrl,
        fileName: buyer.taxIdUrl ? 'Tax Registration' : undefined,
        uploadedAt: buyer.taxIdUrl ? new Date() : undefined,
      },
      {
        documentId: 'bank_statement',
        fileUrl: buyer.optionalDoc1Url,
        fileName: buyer.optionalDoc1Url ? 'Bank Statement' : undefined,
        uploadedAt: buyer.optionalDoc1Url ? new Date() : undefined,
      },
      {
        documentId: 'financial_statement',
        fileUrl: buyer.optionalDoc2Url,
        fileName: buyer.optionalDoc2Url ? 'Financial Statement' : undefined,
        uploadedAt: buyer.optionalDoc2Url ? new Date() : undefined,
      },
      {
        documentId: 'trade_references',
        fileUrl: buyer.passportUrl,
        fileName: buyer.passportUrl ? 'Trade References' : undefined,
        uploadedAt: buyer.passportUrl ? new Date() : undefined,
      },
      {
        documentId: 'credit_report',
        fileUrl: buyer.photoUrl,
        fileName: buyer.photoUrl ? 'Credit Report' : undefined,
        uploadedAt: buyer.photoUrl ? new Date() : undefined,
      },
        {
          documentId: 'certifications',
          fileUrl: buyer.industryCertificationsUrl,
          fileName: buyer.industryCertificationsUrl ? 'Industry Certifications' : undefined,
          uploadedAt: buyer.industryCertificationsUrl ? new Date() : undefined,
        },
      {
        documentId: 'facility_photos',
        fileUrl: buyer.photoUrl,
        fileName: buyer.photoUrl ? 'Facility Photos' : undefined,
        uploadedAt: buyer.photoUrl ? new Date() : undefined,
      },
      {
        documentId: 'certifications',
        fileUrl: buyer.industryCertificationsUrl,
        fileName: buyer.industryCertificationsUrl ? 'Industry Certifications' : undefined,
        uploadedAt: buyer.industryCertificationsUrl ? new Date() : undefined,
      },
    ].filter(doc => !!doc.fileUrl);
  }

  // Delete an uploaded document (persistent)
  async deleteVerificationDocument(userId: string, documentId: string) {
    const buyer = await this.findByUserId(userId);
    // Map frontend document IDs to closest entity columns
    const docColumnMap: Record<string, keyof GlobalBuyer> = {
      company_registration: 'certificateUrl',
      business_license: 'businessLicenseUrl',
      tax_registration: 'taxIdUrl',
      bank_statement: 'optionalDoc1Url',
      financial_statement: 'optionalDoc2Url',
      trade_references: 'passportUrl',
      credit_report: 'photoUrl',
      facility_photos: 'photoUrl',
      certifications: 'industryCertificationsUrl',
    };
    const column = docColumnMap[documentId];
    if (!column) throw new NotFoundException('Document type not found');
    if (!(buyer as any)[column]) throw new NotFoundException('Document not found');
    (buyer as any)[column] = null;
    await this.globalBuyerRepository.save(buyer);
    return { success: true };
  }
  constructor(
    private readonly globalBuyerRepository: GlobalBuyerRepository,
    @Inject(forwardRef(() => CloudinaryService))
    private readonly cloudinaryService: CloudinaryService,
    @InjectRepository(BuyerVerificationDocument)
    private readonly verificationDocumentRepository: Repository<BuyerVerificationDocument>,
  ) {}

  async create(createDto: CreateGlobalBuyerDto & { userId: string }): Promise<GlobalBuyer> {
    const globalBuyer = this.globalBuyerRepository.create({
      ...createDto,
      userId: createDto.userId,
    });

    return this.globalBuyerRepository.save(globalBuyer as any as GlobalBuyer);
  }

  // Verification document upload and status tracking
  private verificationStore: Record<string, {
  status: 'not_started' | 'in_progress' | 'submitted' | 'under_review' | 'approved' | 'rejected',
    documents: Record<string, { fileName: string, fileUrl: string, uploadedAt: Date, status: string }>,
    messages: Array<{ id: string, from: string, message: string, timestamp: Date, type: string }>,
    reviewNotes?: string,
    submittedDate?: Date,
    approvedDate?: Date,
    reviewerName?: string,
    creditRating?: string,
    verificationTier?: 'standard' | 'premium' | 'enterprise',
  }> = {};

  async getVerificationOverview(userId: string) {
    // Required document columns (match frontend)
    const requiredColumns: Array<keyof GlobalBuyer> = [
      'certificateUrl', // company_registration
      'businessLicenseUrl', // business_license
      'taxIdUrl', // tax_registration
      'optionalDoc1Url', // bank_statement
      'optionalDoc2Url', // financial_statement
    ];
    const buyer = await this.findByUserId(userId);
    // Count uploaded required documents
    const documentsUploaded = requiredColumns.filter(col => !!(buyer as any)[col]).length;
    const totalRequired = requiredColumns.length;
    // Use status from verificationStore if available, else default
    let status = 'not_started';
    let reviewNotes, submittedDate, approvedDate, reviewerName, creditRating, verificationTier;
    if (this.verificationStore[userId]) {
      const store = this.verificationStore[userId];
      status = store.status;
      reviewNotes = store.reviewNotes;
      submittedDate = store.submittedDate;
      approvedDate = store.approvedDate;
      reviewerName = store.reviewerName;
      creditRating = store.creditRating;
      verificationTier = store.verificationTier;
    } else {
      verificationTier = 'standard';
    }
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

    // Map frontend document IDs to closest entity columns
    const docColumnMap: Record<string, keyof GlobalBuyer> = {
      company_registration: 'certificateUrl',
      business_license: 'businessLicenseUrl',
      tax_registration: 'taxIdUrl',
      bank_statement: 'optionalDoc1Url',
      financial_statement: 'optionalDoc2Url',
      trade_references: 'passportUrl',
      credit_report: 'photoUrl',
      facility_photos: 'photoUrl',
      certifications: 'industryCertificationsUrl',
    };
    const column = docColumnMap[documentId];
    if (!column) throw new BadRequestException('Invalid document type');
    (buyer as any)[column] = fileUrl;
    await this.globalBuyerRepository.save(buyer);
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
    if (!this.verificationStore[userId]) {
      // Initialize verificationStore for user if not present
      this.verificationStore[userId] = {
        status: 'in_progress',
        documents: {},
        messages: [],
        verificationTier: 'standard',
      };
    }
    this.verificationStore[userId].status = 'submitted';
    this.verificationStore[userId].submittedDate = new Date();
    this.verificationStore[userId].messages.push({
      id: uuidv4(),
      from: 'system',
      message: 'Verification submitted for review.',
      timestamp: new Date(),
      type: 'info',
    });
    return { success: true };
  }

  async getVerificationMessages(userId: string) {
    if (!this.verificationStore[userId]) {
      this.verificationStore[userId] = {
        status: 'not_started',
        documents: {},
        messages: [],
        verificationTier: 'standard',
      };
    }
    return this.verificationStore[userId].messages;
  }

  async addVerificationMessage(userId: string, from: string, message: string, type: string = 'info') {
    if (!this.verificationStore[userId]) {
      this.verificationStore[userId] = {
        status: 'not_started',
        documents: {},
        messages: [],
        verificationTier: 'standard',
      };
    }
    this.verificationStore[userId].messages.push({
      id: uuidv4(),
      from,
      message,
      timestamp: new Date(),
      type,
    });
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

    return globalBuyer;
  }

  async findByUserId(userId: string): Promise<GlobalBuyer> {
    const globalBuyer = await this.globalBuyerRepository.findByUserId(userId);

    if (!globalBuyer) {
      throw new NotFoundException('Global buyer profile not found');
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
}
