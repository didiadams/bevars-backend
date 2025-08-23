import { Injectable } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { Exporter, VerificationStatus } from '../entities/exporter.entity';

@Injectable()
export class ExporterRepository extends Repository<Exporter> {
  constructor(private dataSource: DataSource) {
    super(Exporter, dataSource.createEntityManager());
  }

  async findByUserId(userId: string): Promise<Exporter | null> {
    return this.findOne({
      where: { userId },
      relations: ['user'],
    });
  }

  async findByRegistrationNumber(companyRegistrationNumber: string): Promise<Exporter | null> {
    return this.findOne({
      where: { companyRegistrationNumber },
    });
  }

  async findVerified(): Promise<Exporter[]> {
    return this.find({
      where: { verificationStatus: VerificationStatus.APPROVED },
      relations: ['user'],
    });
  }

  async findByCategories(productCategories: string[]): Promise<Exporter[]> {
    return this.createQueryBuilder('exporter')
      .leftJoinAndSelect('exporter.user', 'user')
      .where('exporter.productCategories && :categories', { 
        categories: productCategories 
      })
      .getMany();
  }

  async findByDestination(destination: string): Promise<Exporter[]> {
    return this.createQueryBuilder('exporter')
      .leftJoinAndSelect('exporter.user', 'user')
      .where(':destination = ANY(exporter.exportDestinations)', { destination })
      .getMany();
  }

  async getTopRated(limit: number = 10): Promise<Exporter[]> {
    return this.find({
      order: { averageRating: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  async getFeatured(): Promise<Exporter[]> {
    return this.find({
      where: { isFeatured: true, isActive: true },
      relations: ['user'],
      order: { averageRating: 'DESC' },
    });
  }
}
