import { IsEmail, IsString, Length, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'User ID',
    example: 'uuid-string',
  })
  @IsUUID('4', { message: 'Invalid user ID format' })
  userId: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString({ message: 'OTP code must be a string' })
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  otpCode: string;
}

export class VerifyEmailOtpDto extends VerifyOtpDto {}

export class SendEmailVerificationDto {
  @ApiProperty({
    description: 'User ID',
    example: 'uuid-string',
  })
  @IsUUID('4', { message: 'Invalid user ID format' })
  userId: string;
}

export class ResendOtpDto {
  @ApiProperty({
    description: 'User ID',
    example: 'uuid-string',
  })
  @IsUUID('4', { message: 'Invalid user ID format' })
  userId: string;
}