// common/common.module.ts
import { Module, Global } from '@nestjs/common';
import { ResponseService } from './services/response.service';

@Global()
@Module({
  providers: [ResponseService],
  exports: [ResponseService],
})
export class CommonModule {}
