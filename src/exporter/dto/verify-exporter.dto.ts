import { IsEnum, IsString, IsArray, IsOptional } from 'class-validator';
import { VerificationStatus } from '../entities/exporter.entity';

export class VerifyExporterDto {
  @IsEnum(VerificationStatus)
  status: VerificationStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  verificationBadges?: string[];
}
