import { IsString, IsArray, IsOptional, IsEmail, IsPhoneNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExporterDto {
  @IsString()
  companyName: string;

  @IsString()
  companyRegistrationNumber: string;

  @IsString()
  businessAddress: string;

  @IsString()
  @IsEmail()
  businessEmail: string;

  @IsString()
  businessPhone: string;

  @IsString()
  contactPersonName: string;

  @IsString()
  contactPersonTitle: string;

  @IsString()
  @IsEmail()
  contactPersonEmail: string;

  @IsString()
  contactPersonPhone: string;

  @IsArray()
  @IsString({ each: true })
  productCategories: string[];

  @IsArray()
  @IsString({ each: true })
  exportDestinations: string[];

  @IsOptional()
  @IsString()
  companyDescription?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsString()
  exportLicenseNumber?: string;

  @IsOptional()
  @IsString()
  taxIdNumber?: string;
}
