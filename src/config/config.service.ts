import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CustomConfigService {
  constructor(private readonly customConfig: ConfigService) {}

  get mailServiceUsername(): string {
    return (
      process.env.MAIL_SERVICE_USERNAME ||
      this.customConfig.get<string>('MAIL_SERVICE_USERNAME')
    );
  }
  get mailServicePassword(): string {
    return (
      process.env.MAIL_SERVICE_PASSWORD ||
      this.customConfig.get<string>('MAIL_SERVICE_PASSWORD')
    );
  }

  get mailPort(): number {
    return (
      parseInt(process.env.MAIL_PORT) ||
      this.customConfig.get<number>('MAIL_PORT') ||
      587
    );
  }

  get frontendUrl(): string {
    return this.customConfig.get<string>('FRONTEND_URL');
  }

  get jwtSecret(): string {
    return this.customConfig.get<string>('JWT_SECRET');
  }

  get adminAccessKey(): string {
    return this.customConfig.get<string>('ADMIN_ACCESS_KEY');
  }
}
