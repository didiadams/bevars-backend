import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { BetterAuthController } from './better-auth.controller';
import { BetterAuthService } from './better-auth.service';
import { User } from '../user/entities/user.entity';
import { GlobalBuyer } from '../global-buyer/entities/global-buyer.entity';
import { Exporter } from '../exporter/entities/exporter.entity';
import { UserModule } from 'src/user/user.module';
import { CustomConfigModule } from 'src/config/config.module';
import { CommonModule } from 'src/common/common.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { CustomConfigService } from 'src/config/config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, GlobalBuyer, Exporter]),
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CustomConfigModule,
    CommonModule,
    JwtModule.registerAsync({
      imports: [CustomConfigModule],
      useFactory: async (configService: CustomConfigService) => ({
        secret: configService.jwtSecret,
        signOptions: { expiresIn: '7d' },
      }),
      inject: [CustomConfigService],
    }),
  ],
  providers: [
    AuthService,
    BetterAuthService,
    LocalStrategy,
    JwtStrategy,
  ],
  controllers: [AuthController, BetterAuthController],
})
export class AuthModule {}
