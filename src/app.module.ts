import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { CommonModule } from './common/common.module';
import typeorm from './database/database.config';
import { GlobalBuyerModule } from './global-buyer/global-buyer.module';
import { ExporterModule } from './exporter/exporter.module';
import { SourcingRequestModule } from './sourcing-request/sourcing-request.module';
import { OfferModule } from './offer/offer.module';
import { OrderModule } from './order/order.module';
import { MarketTrendsModule } from './market-trends/market-trends.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { MailModule } from './mail/mail.module';


// {
//         type: 'mysql',
//         host: configService.get('DATABASE_HOST'),
//         port: +configService.get<number>('DATABASE_PORT'),
//         username: configService.get('DATABASE_USER'),
//         password: configService.get('DATABASE_PASSWORD'),
//         database: configService.get('DATABASE_NAME'),
//         entities: [__dirname + '/**/*.entity{.ts,.js}'],
//         synchronize: configService.get('NODE_ENV') !== 'production',
//       }

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typeorm],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => (configService.get('typeorm')),
      inject: [ConfigService],
    }),
    UserModule,
    AuthModule,
    GlobalBuyerModule,
    ExporterModule,
    SourcingRequestModule,
    OfferModule,
    OrderModule,
    MarketTrendsModule,
    AdminModule,
    CommonModule,
    CloudinaryModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
