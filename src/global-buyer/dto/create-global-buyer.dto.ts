import { IsEnum, IsOptional, IsString, IsArray, IsNumber, IsDecimal, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BuyerType, PreferredPaymentMethod } from '../entities/global-buyer.entity';

export class CreateGlobalBuyerDto {
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
  @Transform(({ value }) => parseFloat(value))
  averageOrderValue?: number;

  @IsOptional()
  @IsEnum(PreferredPaymentMethod)
  preferredPaymentMethod?: PreferredPaymentMethod;

  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  preferredCommunicationMethod?: string;
}
