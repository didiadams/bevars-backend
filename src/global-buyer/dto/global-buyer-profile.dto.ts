import { IsOptional, IsString, IsArray, IsNumber, IsEnum, IsBoolean } from 'class-validator';
import { BuyerType, PreferredPaymentMethod } from '../entities/global-buyer.entity';

export class GlobalBuyerProfileDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(BuyerType)
  buyerType?: BuyerType;

  @IsOptional()
  @IsString()
  businessRegistrationNumber?: string;

  @IsOptional()
  @IsString()
  taxIdentificationNumber?: string;

  @IsOptional()
  @IsString()
  importLicenseNumber?: string;

  @IsOptional()
  @IsString()
  businessDescription?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  linkedinProfile?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestedCategories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operatingCountries?: string[];

  @IsOptional()
  @IsNumber()
  averageOrderValue?: number;

  @IsOptional()
  @IsEnum(PreferredPaymentMethod)
  preferredPaymentMethod?: PreferredPaymentMethod;

  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @IsOptional()
  @IsNumber()
  totalOrdersPlaced?: number;

  @IsOptional()
  @IsNumber()
  totalValueOrdered?: number;

  @IsOptional()
  @IsNumber()
  averageRating?: number;

  @IsOptional()
  @IsNumber()
  totalReviews?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  preferredCommunicationMethod?: string;

  @IsOptional()
  @IsString()
  createdAt?: string;

  @IsOptional()
  @IsString()
  updatedAt?: string;
}
