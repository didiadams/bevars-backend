import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class ExtendDeadlineDto {
  @IsISO8601()
  newDeadline: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
