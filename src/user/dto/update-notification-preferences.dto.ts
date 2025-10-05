import { IsBoolean, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class EmailNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  negotiationStarted?: boolean;

  @IsOptional()
  @IsBoolean()
  counterOfferReceived?: boolean;

  @IsOptional()
  @IsBoolean()
  negotiationAccepted?: boolean;

  @IsOptional()
  @IsBoolean()
  negotiationDeclined?: boolean;

  @IsOptional()
  @IsBoolean()
  orderCreated?: boolean;

  @IsOptional()
  @IsBoolean()
  orderStatusUpdated?: boolean;

  @IsOptional()
  @IsBoolean()
  marketTrends?: boolean;

  @IsOptional()
  @IsBoolean()
  platformUpdates?: boolean;
}

class PushNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  negotiationStarted?: boolean;

  @IsOptional()
  @IsBoolean()
  counterOfferReceived?: boolean;

  @IsOptional()
  @IsBoolean()
  negotiationAccepted?: boolean;

  @IsOptional()
  @IsBoolean()
  negotiationDeclined?: boolean;

  @IsOptional()
  @IsBoolean()
  orderCreated?: boolean;

  @IsOptional()
  @IsBoolean()
  orderStatusUpdated?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailNotificationPreferencesDto)
  emailNotifications?: EmailNotificationPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PushNotificationPreferencesDto)
  pushNotifications?: PushNotificationPreferencesDto;

  @IsOptional()
  @IsEnum(['immediate', 'daily', 'weekly'])
  frequency?: 'immediate' | 'daily' | 'weekly';
}