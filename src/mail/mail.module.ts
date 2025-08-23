import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailService } from './mail-service.service';
import { EmailLog } from './entities/email-log.entity';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailLog]),
    ScheduleModule.forRoot(),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {} 