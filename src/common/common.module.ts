// common/common.module.ts
import { Module, Global } from '@nestjs/common';
import { CropsController } from './controllers/crops.controller';
import { ResponseService } from './services/response.service';

@Global()
@Module({
  controllers: [CropsController],
  providers: [ResponseService],
  exports: [ResponseService],
})
export class CommonModule {}
