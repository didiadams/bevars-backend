import { IsString, IsNumber, IsEnum, IsOptional, IsArray, IsDateString, IsDecimal, Min, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentTerms } from '../entities/offer.entity';

export class CreateOfferDto {
  @IsString()
  sourcingRequestId: string;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  pricePerUnit: number;

  @IsString()
  currency: string;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  availableQuantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  minimumOrderQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  leadTime?: number; // in days

  @IsOptional()
  @IsDateString()
  estimatedDeliveryDate?: string;

  @IsEnum(PaymentTerms)
  paymentTerms: PaymentTerms;

  @IsOptional()
  @IsString()
  qualityAssurance?: string;

  @IsOptional()
  @IsString()
  productSpecifications?: string;

  @IsOptional()
  @IsString()
  packagingDetails?: string;

  @IsOptional()
  @IsString()
  shippingDetails?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  shippingCost?: number;

  @IsOptional()
  @IsString()
  insuranceDetails?: string;

  @IsOptional()
  @IsString()
  certifications?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  additionalNotes?: string;

  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
