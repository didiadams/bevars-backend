import { PartialType } from '@nestjs/mapped-types';
import { CreateExporterDto } from './create-exporter.dto';

export class UpdateExporterDto extends PartialType(CreateExporterDto) {}
