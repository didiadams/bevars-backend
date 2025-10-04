import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  Get,
  HttpStatus,
  HttpCode,
  Ip,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { BetterAuthService } from './better-auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { OtpService } from './services/otp.service';
import {
  SendEmailVerificationDto,
  VerifyEmailOtpDto,
  ResendOtpDto,
  SendOtpDto,
} from './dto/otp.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly betterAuthService: BetterAuthService,
    private readonly otpService: OtpService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Post('signup')
  async signup(@Body() createUserDto: CreateUserDto) {
    return this.betterAuthService.signUp(createUserDto.email, createUserDto.password, createUserDto);
  }

  @Post('signin')
  async signin(@Body() loginDto: { email: string; password: string }) {
    return this.betterAuthService.signIn(loginDto.email, loginDto.password);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req) {
    return this.betterAuthService.signOut(req.headers.authorization?.split(' ')[1] || '');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    console.log('=== /auth/me DEBUG ===');
    console.log('JWT payload user object:', req.user);
    console.log('User ID from token (req.user.id):', req.user.id);
    console.log('User email from token:', req.user.email);
    console.log('User role from token:', req.user.role);
    
    const user = await this.betterAuthService.getUser(req.user.id);
    console.log('Database user found:', user ? `${user.email} (${user.role})` : 'null');
    console.log('=== END DEBUG ===');
    
    return {
      statusCode: 200,
      message: "User data retrieved successfully",
      data: user
    };
  }

  // OTP Endpoints
  @Post('send-email-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send email verification OTP' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async sendEmailVerification(
    @Body() sendEmailVerificationDto: SendEmailVerificationDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    await this.otpService.sendEmailVerificationOtp(
      sendEmailVerificationDto.userId,
      ipAddress,
      userAgent,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Email verification OTP sent successfully',
      data: null,
    };
  }

  @Post('verify-email-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email using OTP' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyEmailOtp(
    @Body() verifyEmailOtpDto: VerifyEmailOtpDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    await this.otpService.verifyEmailOtp(
      verifyEmailOtpDto.userId,
      verifyEmailOtpDto.otpCode,
      ipAddress,
      userAgent,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Email verified successfully. Your account is now active.',
      data: null,
    };
  }

  @Post('resend-email-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification OTP' })
  @ApiResponse({ status: 200, description: 'OTP resent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async resendEmailVerification(
    @Body() resendOtpDto: ResendOtpDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    await this.otpService.sendEmailVerificationOtp(
      resendOtpDto.userId,
      ipAddress,
      userAgent,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Email verification OTP resent successfully',
      data: null,
    };
  }

  @Post('check-verification-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if user needs email verification' })
  @ApiResponse({ status: 200, description: 'Verification status retrieved' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async checkVerificationStatus(@Body() { email }: { email: string }) {
    const user = await this.userRepository.findOne({ where: { email } });
    
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      statusCode: HttpStatus.OK,
      needsVerification: !user.isEmailVerified,
      userId: user.id,
      email: user.email,
    };
  }

  @Post('send-password-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send password reset OTP' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  async sendPasswordResetOtp(
    @Body() sendOtpDto: SendOtpDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    await this.otpService.sendPasswordResetOtp(
      sendOtpDto.email,
      ipAddress,
      userAgent,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Password reset OTP sent successfully',
      data: null,
    };
  }
}
