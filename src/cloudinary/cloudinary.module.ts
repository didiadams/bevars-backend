import { Module } from '@nestjs/common';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';
import { UploadsController } from './uploads.controller';

@Module({
  providers: [CloudinaryProvider, CloudinaryService],
  controllers: [UploadsController],
  exports: [CloudinaryProvider, CloudinaryService],
})
export class CloudinaryModule {}
