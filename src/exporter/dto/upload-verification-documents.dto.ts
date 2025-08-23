import { IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class VerificationDocumentDto {
  @IsString()
  documentType: string;

  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

export class UploadVerificationDocumentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerificationDocumentDto)
  documents: VerificationDocumentDto[];
}
