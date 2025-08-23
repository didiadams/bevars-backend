import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { Exporter, VerificationStatus, ExporterCategory } from './entities/exporter.entity';
import { CreateExporterDto } from './dto/create-exporter.dto';

import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateExporterDto } from './dto/update-exporter.dto';
import { VerifyExporterDto } from './dto/verify-exporter.dto';

@Injectable()
export class ExporterService {
  constructor(
    @InjectRepository(Exporter)
    private exporterRepository: Repository<Exporter>,
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

    const requiredDocuments = [
      'companyRegistration',
      'exportLicense',
      'taxCertificate',
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
        '(exporter.businessDescription ILIKE :search OR user.username ILIKE :search)',
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
}
