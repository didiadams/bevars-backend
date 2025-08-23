import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, IsEnum, IsDateString, IsDecimal } from 'class-validator';
import { UrgencyLevel, QualityStandards, IncoTerms } from '../entities/sourcing-request.entity';

export class CreateSourcingRequestDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  productName: string;

  @IsOptional()
  @IsString()
  productCategory?: string;

  @IsOptional()
  @IsString()
  productVariety?: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsNumber()
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  budgetMax?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  deliveryCountry: string;

  @IsOptional()
  @IsString()
  deliveryCity?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  deliveryPostalCode?: string;

  @IsDateString()
  requiredDeliveryDate: string;

  @IsOptional()
  @IsDateString()
  latestDeliveryDate?: string;

  @IsDateString()
  quotationDeadline: string;

  @IsOptional()
  @IsEnum(IncoTerms)
  preferredIncoTerms?: IncoTerms;

  @IsOptional()
  @IsArray()
  @IsEnum(QualityStandards, { each: true })
  qualityStandards?: QualityStandards[];

  @IsOptional()
  @IsString()
  qualitySpecifications?: string;

  @IsOptional()
  @IsString()
  packagingRequirements?: string;

  @IsOptional()
  @IsString()
  shippingInstructions?: string;

  @IsOptional()
  @IsEnum(UrgencyLevel)
  urgencyLevel?: UrgencyLevel;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  invitedExporters?: string[];

  @IsOptional()
  @IsString()
  additionalNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
