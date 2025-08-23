import { PartialType } from '@nestjs/mapped-types';
import { CreateGlobalBuyerDto } from './create-global-buyer.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateGlobalBuyerDto extends PartialType(CreateGlobalBuyerDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;
}
