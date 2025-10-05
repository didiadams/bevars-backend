import { IsEmail, IsString, Length, IsOptional, IsUUID } from 'class-validator';


export class SendOtpDto {

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}

export class VerifyOtpDto {

  @IsUUID('4', { message: 'Invalid user ID format' })
  userId: string;


  @IsString({ message: 'OTP code must be a string' })
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  otpCode: string;
}

export class VerifyEmailOtpDto extends VerifyOtpDto {}

export class SendEmailVerificationDto {

  @IsUUID('4', { message: 'Invalid user ID format' })
  userId: string;
}

export class ResendOtpDto {

  @IsUUID('4', { message: 'Invalid user ID format' })
  userId: string;
}