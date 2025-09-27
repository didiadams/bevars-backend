import { IsString, IsOptional } from 'class-validator';

export class InviteExporterDto {
  @IsString()
  exporterId: string;

  @IsOptional()
  @IsString()
  message?: string;
}
