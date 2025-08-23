import { Module } from '@nestjs/common';
import { MailService } from './mail-service.service';
import { ResponseService } from 'src/common/services/response.service';
import { CommonModule } from 'src/common/common.module';
import { CustomConfigModule } from 'src/config/config.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailLog } from './entities/email-log.entity';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    CommonModule,
    CustomConfigModule,
    TypeOrmModule.forFeature([EmailLog]),
    ScheduleModule.forRoot(),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
