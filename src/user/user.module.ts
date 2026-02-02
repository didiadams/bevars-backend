import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { MailModule } from '../mail/mail-service.module';
import { UserRepositoryModule } from './repository/user-repository.module';
import { CommonModule } from 'src/common/common.module';
import { CustomConfigModule } from 'src/config/config.module';
import { OnboardingReminderService } from './services/onboarding-reminder.service';
import { Exporter } from '../exporter/entities/exporter.entity';
import { GlobalBuyer } from '../global-buyer/entities/global-buyer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Exporter, GlobalBuyer]),
    UserRepositoryModule, 
    MailModule, 
    CommonModule, 
    CustomConfigModule
  ],
  controllers: [UserController],
  providers: [UserService, OnboardingReminderService],
  exports: [UserService, OnboardingReminderService],
})
export class UserModule {}
