import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { MailService } from 'src/mail/mail-service.service';
import { UserRepositoryModule } from './repository/user-repository.module';
import { MailModule } from 'src/mail/mail-service.module';
import { ResponseService } from 'src/common/services/response.service';
import { CommonModule } from 'src/common/common.module';
import { CustomConfigModule } from 'src/config/config.module';

@Module({
  imports: [UserRepositoryModule, MailModule, CommonModule, CustomConfigModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
