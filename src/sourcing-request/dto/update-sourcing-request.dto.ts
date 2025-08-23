import { PartialType } from '@nestjs/mapped-types';
import { CreateSourcingRequestDto } from './create-sourcing-request.dto';

export class UpdateSourcingRequestDto extends PartialType(CreateSourcingRequestDto) {}
