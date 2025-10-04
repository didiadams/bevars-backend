import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Otp, OtpType, OtpStatus } from '../entities/otp.entity';
import { User } from '../../user/entities/user.entity';
import { MailService } from '../../mail/mail-service.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(Otp)
    private otpRepository: Repository<Otp>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private mailService: MailService,
  ) {}

  private generateOtpCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  async generateOtp(
    userId: string,
    type: OtpType,
    expirationMinutes: number = 10,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    // Revoke any existing active OTPs of the same type for this user
    await this.otpRepository.update(
      {
        userId,
        type,
        status: OtpStatus.ACTIVE,
      },
      {
        status: OtpStatus.REVOKED,
      },
    );

    const code = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    const otp = this.otpRepository.create({
      code,
      type,
      userId,
      expiresAt,
      ipAddress,
      userAgent,
    });

    await this.otpRepository.save(otp);
    this.logger.log(`OTP generated for user ${userId}, type: ${type}, expires at: ${expiresAt}`);

    return code;
  }

  async verifyOtp(
    userId: string,
    code: string,
    type: OtpType,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<boolean> {
    const otp = await this.otpRepository.findOne({
      where: {
        userId,
        code,
        type,
        status: OtpStatus.ACTIVE,
      },
    });

    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Check if OTP has expired
    if (new Date() > otp.expiresAt) {
      await this.otpRepository.update(otp.id, { status: OtpStatus.EXPIRED });
      throw new BadRequestException('OTP has expired');
    }

    // Increment attempts
    otp.attempts += 1;

    // Check if max attempts exceeded
    if (otp.attempts >= otp.maxAttempts) {
      await this.otpRepository.update(otp.id, { 
        status: OtpStatus.REVOKED,
        attempts: otp.attempts,
      });
      throw new BadRequestException('Too many attempts. Please request a new OTP');
    }

    // Save attempt count
    await this.otpRepository.update(otp.id, { attempts: otp.attempts });

    // Mark OTP as used
    await this.otpRepository.update(otp.id, {
      status: OtpStatus.USED,
      usedAt: new Date(),
      ipAddress,
      userAgent,
    });

    this.logger.log(`OTP verified successfully for user ${userId}, type: ${type}`);
    return true;
  }

  async sendEmailVerificationOtp(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if user's email is already verified
    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Check if user was deactivated by admin
    if (user.isActive === false && (user.isEmailVerified === true || user.isVerified === true)) {
      throw new BadRequestException('Account has been deactivated. Please contact support.');
    }

    const otpCode = await this.generateOtp(userId, OtpType.EMAIL_VERIFICATION, 10, ipAddress, userAgent);
    
    // Send OTP via email
    await this.sendOtpEmail(user.email, otpCode, user.firstName || 'User', OtpType.EMAIL_VERIFICATION);
    
    this.logger.log(`Email verification OTP sent to user ${userId} (${user.email})`);
  }

  async verifyEmailOtp(
    userId: string,
    otpCode: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify OTP
    await this.verifyOtp(userId, otpCode, OtpType.EMAIL_VERIFICATION, ipAddress, userAgent);

    // Check if user was manually deactivated by admin
    // Admin deactivation logic: If user was previously verified (email or documents) 
    // but is now inactive, admin has deactivated them
    const wasUserPreviouslyActive = user.isEmailVerified || user.isVerified;
    
    if (!user.isActive && wasUserPreviouslyActive) {
      throw new UnauthorizedException('Account has been deactivated by admin. Email verification alone cannot activate your account.');
    }

    // Update user as email verified and activate if it's a fresh account
    const updateData: Partial<User> = { isEmailVerified: true };
    
    // Only activate if user is currently inactive but was never active before
    // (i.e., fresh signup where isActive starts as false)
    if (!user.isActive && !wasUserPreviouslyActive) {
      updateData.isActive = true;
    }

    await this.userRepository.update(userId, updateData);

    this.logger.log(`Email verified successfully for user ${userId} (${user.email})`);
    return true;
  }

  async sendPasswordResetOtp(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if email exists or not for security
      this.logger.warn(`Password reset attempt for non-existent email: ${email}`);
      return;
    }

    if (!user.isActive) {
      throw new BadRequestException('Account is not active');
    }

    const otpCode = await this.generateOtp(user.id, OtpType.PASSWORD_RESET, 15, ipAddress, userAgent);
    
    // Send OTP via email
    await this.sendOtpEmail(user.email, otpCode, user.firstName || 'User', OtpType.PASSWORD_RESET);
    
    this.logger.log(`Password reset OTP sent to user ${user.id} (${email})`);
  }

  private async sendOtpEmail(email: string, otpCode: string, name: string, type: OtpType): Promise<void> {
    let subject: string;
    let htmlContent: string;

    switch (type) {
      case OtpType.EMAIL_VERIFICATION:
        subject = 'Verify Your Email - Bevars';
        htmlContent = this.generateEmailVerificationOtpHtml(otpCode, name);
        break;
      case OtpType.PASSWORD_RESET:
        subject = 'Password Reset Code - Bevars';
        htmlContent = this.generatePasswordResetOtpHtml(otpCode, name);
        break;
      default:
        subject = 'Your OTP Code - Bevars';
        htmlContent = this.generateGenericOtpHtml(otpCode, name);
    }

    await this.mailService.sendEmail({
      email,
      subject,
      html: htmlContent,
      text: `Your OTP code is: ${otpCode}. This code will expire in ${type === OtpType.PASSWORD_RESET ? '15' : '10'} minutes.`,
      metadata: { type: 'otp', otpType: type },
    });
  }

  private generateEmailVerificationOtpHtml(otpCode: string, name: string): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification - Bevars</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333333;
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
      }
      .email-container {
        max-width: 600px;
        margin: 20px auto;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .email-header {
        background: linear-gradient(135deg, #059669, #047857);
        color: #ffffff;
        padding: 40px 20px;
        text-align: center;
      }
      .email-header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
      }
      .email-body {
        padding: 40px 30px;
        text-align: center;
      }
      .otp-container {
        background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
        border: 2px solid #059669;
        border-radius: 12px;
        padding: 30px;
        margin: 30px 0;
      }
      .otp-code {
        font-size: 36px;
        font-weight: 900;
        color: #059669;
        letter-spacing: 8px;
        margin: 10px 0;
        font-family: 'Courier New', monospace;
      }
      .email-footer {
        text-align: center;
        padding: 20px;
        background-color: #f8fafc;
        border-top: 1px solid #e2e8f0;
        font-size: 14px;
        color: #64748b;
      }
      .warning {
        background-color: #fef3c7;
        border: 1px solid #f59e0b;
        color: #92400e;
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
        font-size: 14px;
      }
      .logo {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }
      .logo-icon {
        width: 32px;
        height: 32px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }
      @media only screen and (max-width: 600px) {
        .email-container {
          margin: 10px;
          width: auto;
        }
        .email-body {
          padding: 30px 20px;
        }
        .otp-code {
          font-size: 28px;
          letter-spacing: 4px;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <div class="logo">
          <div class="logo-icon">🌱</div>
          <h1>Bevars</h1>
        </div>
        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Email Verification</p>
      </div>
      <div class="email-body">
        <h2 style="color: #1e293b; margin-bottom: 20px;">Welcome to Bevars, ${name}!</h2>
        <p style="font-size: 16px; color: #475569; margin-bottom: 30px;">
          To complete your registration and secure your account, please enter the verification code below:
        </p>
        
        <div class="otp-container">
          <p style="margin: 0 0 10px 0; font-weight: 600; color: #059669;">Your Verification Code</p>
          <div class="otp-code">${otpCode}</div>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">
            Enter this code in the verification form
          </p>
        </div>

        <div class="warning">
          <strong>⏰ Important:</strong> This verification code will expire in <strong>10 minutes</strong> for security reasons.
        </div>

        <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
          If you didn't create an account with Bevars, please ignore this email. 
          For security reasons, please do not share this code with anyone.
        </p>
      </div>
      <div class="email-footer">
        <p>Need help? <a href="mailto:support@bevars.com" style="color: #059669; text-decoration: none;">Contact Support</a></p>
        <p>&copy; ${new Date().getFullYear()} Bevars. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
    `;
  }

  private generatePasswordResetOtpHtml(otpCode: string, name: string): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - Bevars</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333333;
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
      }
      .email-container {
        max-width: 600px;
        margin: 20px auto;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .email-header {
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        color: #ffffff;
        padding: 40px 20px;
        text-align: center;
      }
      .email-header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
      }
      .email-body {
        padding: 40px 30px;
        text-align: center;
      }
      .otp-container {
        background: linear-gradient(135deg, #fef2f2, #fee2e2);
        border: 2px solid #dc2626;
        border-radius: 12px;
        padding: 30px;
        margin: 30px 0;
      }
      .otp-code {
        font-size: 36px;
        font-weight: 900;
        color: #dc2626;
        letter-spacing: 8px;
        margin: 10px 0;
        font-family: 'Courier New', monospace;
      }
      .email-footer {
        text-align: center;
        padding: 20px;
        background-color: #f8fafc;
        border-top: 1px solid #e2e8f0;
        font-size: 14px;
        color: #64748b;
      }
      .warning {
        background-color: #fef3c7;
        border: 1px solid #f59e0b;
        color: #92400e;
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
        font-size: 14px;
      }
      .logo {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }
      .logo-icon {
        width: 32px;
        height: 32px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }
      @media only screen and (max-width: 600px) {
        .email-container {
          margin: 10px;
          width: auto;
        }
        .email-body {
          padding: 30px 20px;
        }
        .otp-code {
          font-size: 28px;
          letter-spacing: 4px;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <div class="logo">
          <div class="logo-icon">🔒</div>
          <h1>Bevars</h1>
        </div>
        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Password Reset</p>
      </div>
      <div class="email-body">
        <h2 style="color: #1e293b; margin-bottom: 20px;">Password Reset Request</h2>
        <p style="font-size: 16px; color: #475569; margin-bottom: 30px;">
          Hi ${name}, we received a request to reset your password. Enter the code below to create a new password:
        </p>
        
        <div class="otp-container">
          <p style="margin: 0 0 10px 0; font-weight: 600; color: #dc2626;">Your Reset Code</p>
          <div class="otp-code">${otpCode}</div>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">
            Enter this code to reset your password
          </p>
        </div>

        <div class="warning">
          <strong>⏰ Important:</strong> This reset code will expire in <strong>15 minutes</strong> for security reasons.
        </div>

        <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
          If you didn't request a password reset, please ignore this email or contact support if you have concerns.
        </p>
      </div>
      <div class="email-footer">
        <p>Need help? <a href="mailto:support@bevars.com" style="color: #dc2626; text-decoration: none;">Contact Support</a></p>
        <p>&copy; ${new Date().getFullYear()} Bevars. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
    `;
  }

  private generateGenericOtpHtml(otpCode: string, name: string): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your OTP Code - Bevars</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333333;
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
      }
      .email-container {
        max-width: 600px;
        margin: 20px auto;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .email-header {
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: #ffffff;
        padding: 40px 20px;
        text-align: center;
      }
      .email-body {
        padding: 40px 30px;
        text-align: center;
      }
      .otp-container {
        background: #f8fafc;
        border: 2px solid #6366f1;
        border-radius: 12px;
        padding: 30px;
        margin: 30px 0;
      }
      .otp-code {
        font-size: 36px;
        font-weight: 900;
        color: #6366f1;
        letter-spacing: 8px;
        margin: 10px 0;
        font-family: 'Courier New', monospace;
      }
      @media only screen and (max-width: 600px) {
        .otp-code {
          font-size: 28px;
          letter-spacing: 4px;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <h1>Your OTP Code</h1>
      </div>
      <div class="email-body">
        <h2>Hello ${name},</h2>
        <p>Here is your requested OTP code:</p>
        <div class="otp-container">
          <div class="otp-code">${otpCode}</div>
        </div>
      </div>
    </div>
  </body>
</html>
    `;
  }

  // Clean up expired OTPs every hour
  @Cron('0 0 * * * *')
  async cleanupExpiredOtps(): Promise<void> {
    try {
      const result = await this.otpRepository.update(
        {
          status: OtpStatus.ACTIVE,
          expiresAt: LessThan(new Date()),
        },
        {
          status: OtpStatus.EXPIRED,
        },
      );

      if (result.affected > 0) {
        this.logger.log(`Cleaned up ${result.affected} expired OTPs`);
      }
    } catch (error) {
      this.logger.error('Failed to clean up expired OTPs', error.stack);
    }
  }

  // Get OTP statistics for monitoring
  async getOtpStats(userId?: string): Promise<any> {
    const baseQuery = this.otpRepository.createQueryBuilder('otp');
    
    if (userId) {
      baseQuery.where('otp.userId = :userId', { userId });
    }

    const [total, active, used, expired, revoked] = await Promise.all([
      baseQuery.getCount(),
      baseQuery.clone().andWhere('otp.status = :status', { status: OtpStatus.ACTIVE }).getCount(),
      baseQuery.clone().andWhere('otp.status = :status', { status: OtpStatus.USED }).getCount(),
      baseQuery.clone().andWhere('otp.status = :status', { status: OtpStatus.EXPIRED }).getCount(),
      baseQuery.clone().andWhere('otp.status = :status', { status: OtpStatus.REVOKED }).getCount(),
    ]);

    return {
      total,
      active,
      used,
      expired,
      revoked,
    };
  }
}