import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { MailModule } from '../mail/mail-service.module';
import { UserRepositoryModule } from './repository/user-repository.module';
import { CommonModule } from 'src/common/common.module';
import { CustomConfigModule } from 'src/config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UserRepositoryModule, 
    MailModule, 
    CommonModule, 
    CustomConfigModule
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
