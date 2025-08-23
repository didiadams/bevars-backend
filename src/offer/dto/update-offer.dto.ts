import { PartialType } from '@nestjs/mapped-types';
import { CreateOfferDto } from './create-offer.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateOfferDto extends PartialType(CreateOfferDto) {
  @IsOptional()
  @IsString()
  negotiationNotes?: string;
}
