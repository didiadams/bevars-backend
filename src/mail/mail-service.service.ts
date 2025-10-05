import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog, EmailStatus } from './entities/email-log.entity';
import { Cron } from '@nestjs/schedule';

export interface EmailOptions {
  email: string;
  subject: string;
  text?: string;
  html?: string;
  metadata?: Record<string, any>;
}

export interface OrderNotificationData {
  orderId: string;
  buyerName: string;
  buyerCompany: string;
  cropName: string;
  quantity: number;
  variety: string;
  condition?: string;
  orderDate: Date;
}

export interface NegotiationNotificationData {
  offerId: string;
  buyerName: string;
  buyerCompany: string;
  exporterName: string;
  exporterCompany: string;
  cropName: string;
  originalPrice: number;
  negotiatedPrice?: number;
  quantity: number;
  variety: string;
  negotiationNotes?: string;
  negotiationType: 'initiated' | 'counter_offer' | 'accepted' | 'declined';
  savings?: number;
  priceChange?: number;
  frontendUrl?: string;
}


const generateEmailHtml = (verificationUrl: string, name: string) => `
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
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .email-header {
        background: linear-gradient(135deg, #00313E, #00252F);
        color: #ffffff;
        padding: 30px 20px;
        text-align: center;
      }
      .email-header h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
      }
      .email-body {
        padding: 30px 20px;
        font-size: 16px;
      }
      .email-button {
        display: inline-block;
        margin: 25px 0;
        padding: 12px 24px;
        background-color: #00313E;
        color: #ffffff;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 500;
        transition: background-color 0.3s ease;
      }
      .email-button:hover {
        background-color: #00252F;
      }
      .email-footer {
        text-align: center;
        padding: 20px;
        background-color: #f8f9fa;
        border-top: 1px solid #e9ecef;
        font-size: 14px;
        color: #6c757d;
      }
      .url-container {
        margin: 20px 0;
        padding: 15px;
        background-color: #f8f9fa;
        border-radius: 4px;
        border: 1px solid #e9ecef;
        word-break: break-all;
      }
      .url-container a {
        color: #00313E;
        text-decoration: none;
      }
      .logo {
        max-width: 150px;
        margin-bottom: 20px;
      }
      .divider {
        height: 1px;
        background-color: #e9ecef;
        margin: 20px 0;
      }
      @media only screen and (max-width: 600px) {
        .email-container {
          margin: 10px;
          width: auto;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <h1>Welcome to Bevars</h1>
      </div>
      <div class="email-body">
        <p>Dear ${name},</p>
        <p>Thank you for choosing Bevars. To ensure the security of your account and access all features of our platform, please verify your email address.</p>
        
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="email-button">Verify Email Address</a>
        </div>

        <p>If the button above doesn't work, you can copy and paste the following link into your browser:</p>
        <div class="url-container">
          <a href="${verificationUrl}">${verificationUrl}</a>
        </div>

        <div class="divider"></div>

        <p style="color: #6c757d; font-size: 14px;">
          This verification link will expire in 24 hours. If you did not create an account with Bevars, please disregard this email.
        </p>
      </div>
      <div class="email-footer">
        <p>For assistance, please contact our support team at <a href="mailto:support@bevars.com" style="color: #00313E;">support@bevars.com</a></p>
        <p>&copy; ${new Date().getFullYear()} Bevars. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
`;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private adminEmail: string;
  private emailQueue: Array<{
    options: EmailOptions;
    timestamp: Date;
    attempts: number;
  }> = [];

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(EmailLog)
    private emailLogRepository: Repository<EmailLog>,
  ) {
    this.initializeTransporter();
    this.adminEmail = this.configService.get('ADMIN_EMAIL');
  }

  @Cron('*/30 * * * * *')
  private async processEmailQueue() {
    if (this.emailQueue.length === 0) return;

    const emailJob = this.emailQueue[0];
    try {
      const emailOptions = {
        from: this.configService.get<string>('EMAIL_FROM', 'no-reply@bevars.com'),
        to: emailJob.options.email,
        subject: emailJob.options.subject,
        text: emailJob.options.text,
        html: emailJob.options.html,
      };

      const info = await this.transporter.sendMail(emailOptions);
      
      // Update email log on success
      if (emailJob.options.metadata?.logId) {
        await this.emailLogRepository.update(
          { id: emailJob.options.metadata.logId },
          {
            status: EmailStatus.SENT,
            sentAt: new Date(),
            messageId: info.messageId,
          },
        );
      }

      // Remove the processed email from queue
      this.emailQueue.shift();
    } catch (error) {
      this.logger.error(`Email sending failed: ${error.message}`, error.stack);
      
      // Update email log on failure
      if (emailJob.options.metadata?.logId) {
        await this.emailLogRepository.update(
          { id: emailJob.options.metadata.logId },
          {
            status: EmailStatus.FAILED,
            error: error.message,
            lastAttempt: new Date(),
          },
        );
      }

      // Handle retries
      if (emailJob.attempts < 5) {
        emailJob.attempts++;
        // Move to end of queue for retry
        this.emailQueue.push(this.emailQueue.shift());
      } else {
        // Remove from queue after max attempts
        this.emailQueue.shift();
      }
    }
  }

  private initializeTransporter() {
    // Check which mail configuration to use based on environment variables
    if (this.configService.get<string>('MAIL_HOST')) {
      // Use the standard SMTP configuration
      this.transporter = nodemailer.createTransport({
        host: this.configService.get('MAIL_HOST'),
        port: this.configService.get('MAIL_PORT'),
        secure: this.configService.get('MAIL_SECURE') === 'true',
        auth: {
          user: this.configService.get('MAIL_USER'),
          pass: this.configService.get('MAIL_PASSWORD'),
        },
      });
    } else {
      // Use Mailtrap configuration as fallback
      this.transporter = nodemailer.createTransport({
        host: 'live.smtp.mailtrap.io',
        port: 587,
        auth: {
          user:
            this.configService.get<string>('MAIL_SERVICE_USERNAME') || 'api',
          pass: this.configService.get<string>('MAIL_SERVICE_PASSWORD'),
        },
      });
    }

    // Commented out Gmail OAuth2 configuration for reference
    /*
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: 'farmercomplete3@gmail.com',
        clientId: `${this.configService.get<string>('MAIL_SERVICE_CLIENT_ID')}`,
        clientSecret: `${this.configService.get<string>('MAIL_SERVICE_CLIENT_SECRET')}`,
        refreshToken: `${this.configService.get<string>('MAIL_SERVICE_REFRESH_TOKEN')}`,
        accessToken: `${this.configService.get<string>('MAIL_SERVICE_ACCESS_TOKEN')}`,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    */
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Create email log entry
      const emailLog = await this.emailLogRepository.save({
        email: options.email,
        subject: options.subject,
        status: EmailStatus.QUEUED,
        metadata: options.metadata,
      });

      // Add to queue with retry tracking
      this.emailQueue.push({
        options: {
          ...options,
          metadata: { ...options.metadata, logId: emailLog.id },
        },
        timestamp: new Date(),
        attempts: 0,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to queue email: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to queue email');
    }
  }

  async sendVerificationEmail(email: string, token: string, name: string): Promise<boolean> {
    const verificationUrl = `${this.configService.get<string>('FRONTEND_URL')}/verify-email?token=${token}`;
    const htmlContent = generateEmailHtml(verificationUrl, name);
    console.log(verificationUrl, "htmlContent");
    return this.sendEmail({
      email,
      subject: 'Verify Your Email',
      text: `Click the following link to verify your email: ${verificationUrl}`,
      html: htmlContent,
      metadata: { type: 'verification' },
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${token}`;
    return this.sendEmail({
      email,
      subject: 'Password Reset Request',
      text: `Click the following link to reset your password: ${resetUrl}. 
This link will expire in 15 minutes.

If you did not request a password reset, please ignore this email.`,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
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
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .email-header {
        background: linear-gradient(135deg, #dc3545, #c82333);
        color: #ffffff;
        padding: 30px 20px;
        text-align: center;
      }
      .email-header h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
      }
      .email-body {
        padding: 30px 20px;
        font-size: 16px;
      }
      .email-button {
        display: inline-block;
        margin: 25px 0;
        padding: 12px 24px;
        background-color: #dc3545;
        color: #ffffff;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 500;
        transition: background-color 0.3s ease;
      }
      .email-button:hover {
        background-color: #c82333;
      }
      .email-footer {
        text-align: center;
        padding: 20px;
        background-color: #f8f9fa;
        border-top: 1px solid #e9ecef;
        font-size: 14px;
        color: #6c757d;
      }
      .url-container {
        margin: 20px 0;
        padding: 15px;
        background-color: #f8f9fa;
        border-radius: 4px;
        border: 1px solid #e9ecef;
        word-break: break-all;
      }
      .url-container a {
        color: #dc3545;
        text-decoration: none;
      }
      .divider {
        height: 1px;
        background-color: #e9ecef;
        margin: 20px 0;
      }
      .warning {
        background-color: #fff3cd;
        border: 1px solid #ffeeba;
        color: #856404;
        padding: 15px;
        border-radius: 4px;
        margin: 20px 0;
      }
      @media only screen and (max-width: 600px) {
        .email-container {
          margin: 10px;
          width: auto;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <h1>Reset Your Password</h1>
      </div>
      <div class="email-body">
        <p>Dear User,</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        
        <div style="text-align: center;">
          <a href="${resetUrl}" class="email-button">Reset Password</a>
        </div>

        <p>If the button above doesn't work, you can also copy and paste the following link into your browser:</p>
        <div class="url-container">
          <a href="${resetUrl}">${resetUrl}</a>
        </div>

        <div class="warning">
          <strong>Important:</strong> This link will expire in 15 minutes for security reasons.
        </div>

        <div class="divider"></div>

        <p style="color: #6c757d; font-size: 14px;">
          If you did not request a password reset, please ignore this email or contact support if you have concerns.
        </p>
      </div>
      <div class="email-footer">
        <p>Need help? <a href="mailto:support@bevars.com" style="color: #dc3545;">Contact Support</a></p>
        <p>&copy; ${new Date().getFullYear()} Bevars. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
      `,
      metadata: { type: 'password-reset' },
    });
  }

  private generateKycApprovalEmail(buyerName: string): string {
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745, #218838); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">KYC Verification Approved</h2>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
          <p>Dear ${buyerName || 'Valued Customer'},</p>
          <p>We are pleased to inform you that your KYC verification has been approved. Your account is now fully verified and you can access all features of our platform.</p>
          <p>You can now:</p>
          <ul>
            <li>Place orders</li>
            <li>Access all marketplace features</li>
            <li>Use all payment methods</li>
          </ul>
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>The Bevars Team</p>
        </div>
      </div>
    `;
  }

  private generateKycRejectionEmail(buyerName: string, reason: string): string {
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">KYC Verification Update</h2>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
          <p>Dear ${buyerName || 'Valued Customer'},</p>
          <p>We have reviewed your KYC documents, and unfortunately, we need additional information or clarification.</p>
          <p>Reason: ${reason || 'Please provide clearer documentation.'}</p>
          <p>Please log in to your account and submit the required documents again. Make sure to:</p>
          <ul>
            <li>Provide clear, legible copies of your documents</li>
            <li>Ensure all information is up to date</li>
            <li>Include any additional documents that may help verify your identity</li>
          </ul>
          <p>If you need assistance, please contact our support team.</p>
          <p>Best regards,<br>The Bevars Team</p>
        </div>
      </div>
    `;
  }

  private generateOrderNotificationEmail(data: OrderNotificationData): string {
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745, #218838); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">New Order Notification</h2>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
          <p>A new order has been placed on the platform. Here are the details:</p>
          
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Order ID:</strong> ${data.orderId}</p>
            <p><strong>Buyer:</strong> ${data.buyerName}</p>
            <p><strong>Company:</strong> ${data.buyerCompany}</p>
            <p><strong>Date:</strong> ${data.orderDate.toLocaleDateString()}</p>
          </div>
          
          <h3 style="color: #28a745; margin-top: 30px;">Order Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <thead>
              <tr>
                <th style="background-color: #28a745; color: #ffffff; padding: 12px; text-align: left;">Crop</th>
                <th style="background-color: #28a745; color: #ffffff; padding: 12px; text-align: left;">Quantity</th>
                <th style="background-color: #28a745; color: #ffffff; padding: 12px; text-align: left;">Variety</th>

              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${data.cropName}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${data.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${data.variety}</td>

              </tr>
            </tbody>
          </table>

          <div style="text-align: center;">
            <a href="${this.configService.get<string>('FRONTEND_URL')}/admin/orders" style="display: inline-block; margin: 20px 0; padding: 12px 24px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500; transition: background-color 0.3s ease;">View Order Details</a>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d;">
          <p>This is an automated notification. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Bevars. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  // Temporarily commented out - KYC functionality to be added later
  /*
  async sendKycReviewNotification(
    email: string,
    buyerName: string,
    status: any,
    reason?: string,
  ): Promise<boolean> {
    const subject = status === KycStatus.APPROVED
      ? 'Your KYC Verification is Approved'
      : 'Your KYC Verification Needs Attention';

    const html = status === KycStatus.APPROVED
      ? this.generateKycApprovalEmail(buyerName)
      : this.generateKycRejectionEmail(buyerName, reason);

    return this.sendEmail({
      email,
      subject,
      html,
      metadata: {
        type: 'kyc-review',
        status,
      },
    });
  }

  async sendOrderNotification(data: OrderNotificationData): Promise<boolean> {
    return this.sendEmail({
      email: this.adminEmail,
      subject: `New Order Notification: Order #${data.orderId.substring(0, 8)}`,
      html: this.generateOrderNotificationEmail(data),
      metadata: { 
        type: 'order-notification',
        orderId: data.orderId,
      },
    });
  }

  // Update the getEmailStatus method to work with our in-memory queue
  async getEmailStatus(logId: string): Promise<EmailLog> {
    return this.emailLogRepository.findOne({ where: { id: logId } });
  }

  private generateOrderConfirmationEmail(
    orderId: string,
    buyerName: string,
    orderDate: Date,
    total: number,
    cropName: string,
    quantity: number,
    variety: string,
    price: number,
  ): string {
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745, #218838); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Order Confirmation</h2>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
          <p>Dear ${buyerName || 'Valued Customer'},</p>
          <p>Thank you for your order! We have received your order and it is now being processed.</p>
          
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Order Date:</strong> ${orderDate.toLocaleDateString()}</p>
            <p><strong>Total Amount:</strong> ₦${total.toLocaleString()}</p>
          </div>
          
          <h3 style="color: #28a745; margin-top: 30px;">Order Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <thead>
              <tr>
                <th style="background-color: #28a745; color: #ffffff; padding: 12px; text-align: left;">Crop</th>
                <th style="background-color: #28a745; color: #ffffff; padding: 12px; text-align: left;">Quantity</th>
                <th style="background-color: #28a745; color: #ffffff; padding: 12px; text-align: left;">Variety</th>
                <th style="background-color: #28a745; color: #ffffff; padding: 12px; text-align: left;">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${cropName}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${variety}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">₦${price.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <p>You can track your order status by logging into your account.</p>
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>The Bevars Team</p>
        </div>
        <div style="text-align: center; padding: 20px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d;">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Bevars. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  async sendOrderConfirmation(
    email: string,
    orderId: string,
    buyerName: string,
    orderDate: Date,
    total: number,
    cropName: string,
    quantity: number,
    variety: string,
    price: number,
  ): Promise<boolean> {
    return this.sendEmail({
      email,
      subject: 'Order Confirmation - Bevars',
      html: this.generateOrderConfirmationEmail(
        orderId,
        buyerName,
        orderDate,
        total,
        cropName,
        quantity,
        variety,
        price,
      ),
      metadata: {
        type: 'order-confirmation',
        orderId,
      },
    });
  }
  */

  // Negotiation Email Notifications
  async sendNegotiationInitiatedEmail(data: NegotiationNotificationData, recipientEmail?: string): Promise<boolean> {
    const subject = `Price Negotiation Started - ${data.cropName} Offer`;
    return this.sendEmail({
      email: recipientEmail || `exporter@example.com`, // Use provided email or fallback
      subject,
      html: this.generateNegotiationInitiatedEmail(data),
      metadata: {
        type: 'negotiation-initiated',
        offerId: data.offerId,
      },
    });
  }

  async sendCounterOfferEmail(data: NegotiationNotificationData, recipientEmail?: string): Promise<boolean> {
    const subject = `Counter Offer Received - ${data.cropName}`;
    return this.sendEmail({
      email: recipientEmail || `buyer@example.com`, // Use provided email or fallback
      subject,
      html: this.generateCounterOfferEmail(data),
      metadata: {
        type: 'counter-offer',
        offerId: data.offerId,
      },
    });
  }

  async sendNegotiationAcceptedEmail(data: NegotiationNotificationData, recipientEmail?: string): Promise<boolean> {
    const subject = `Negotiation Accepted - ${data.cropName} Order Confirmed`;
    return this.sendEmail({
      email: recipientEmail || `exporter@example.com`, // Use provided email or fallback
      subject,
      html: this.generateNegotiationAcceptedEmail(data),
      metadata: {
        type: 'negotiation-accepted',
        offerId: data.offerId,
      },
    });
  }

  async sendNegotiationDeclinedEmail(data: NegotiationNotificationData, recipientEmail?: string): Promise<boolean> {
    const subject = `Negotiation Declined - ${data.cropName}`;
    return this.sendEmail({
      email: recipientEmail || `exporter@example.com`, // Use provided email or fallback
      subject,
      html: this.generateNegotiationDeclinedEmail(data),
      metadata: {
        type: 'negotiation-declined',
        offerId: data.offerId,
      },
    });
  }

  private generateNegotiationInitiatedEmail(data: NegotiationNotificationData): string {
    const savingsAmount = data.savings || (data.originalPrice - (data.negotiatedPrice || 0));
    const savingsPercent = data.originalPrice > 0 ? ((savingsAmount / data.originalPrice) * 100).toFixed(1) : '0';
    
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">💰 Price Negotiation Started</h2>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
          <p>Dear ${data.exporterName},</p>
          <p>Great news! <strong>${data.buyerName}</strong> from <strong>${data.buyerCompany}</strong> has initiated a price negotiation for your ${data.cropName} offer.</p>
          
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #3b82f6; margin-top: 0;">Negotiation Details</h3>
            <p><strong>Crop:</strong> ${data.cropName} (${data.variety})</p>
            <p><strong>Quantity:</strong> ${data.quantity.toLocaleString()} units</p>
            <p><strong>Your Original Price:</strong> ₦${data.originalPrice.toLocaleString()}/unit</p>
            <p><strong>Buyer's Counter Price:</strong> ₦${(data.negotiatedPrice || 0).toLocaleString()}/unit</p>
            <p><strong>Price Difference:</strong> <span style="color: #dc3545;">-₦${savingsAmount.toLocaleString()} (-${savingsPercent}%)</span></p>
            ${data.negotiationNotes ? `<p><strong>Buyer's Notes:</strong> "${data.negotiationNotes}"</p>` : ''}
          </div>

          <div style="background-color: #e8f5e8; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>💡 Tip:</strong> Consider the buyer's request carefully. You can accept their offer, make a counter-offer, or politely decline.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.frontendUrl || this.configService.get<string>('FRONTEND_URL')}/dashboard/offers/${data.offerId}" 
               style="display: inline-block; margin: 0 10px; padding: 12px 24px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">View & Respond</a>
            <a href="${data.frontendUrl || this.configService.get<string>('FRONTEND_URL')}/dashboard/offers" 
               style="display: inline-block; margin: 0 10px; padding: 12px 24px; background-color: #6c757d; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">All Offers</a>
          </div>

          <p>Quick response times help build trust and increase your chances of closing the deal!</p>
          <p>Best regards,<br>The Bevars Team</p>
        </div>
        <div style="text-align: center; padding: 20px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d;">
          <p>This is an automated notification. You can manage your email preferences in your dashboard.</p>
          <p>&copy; ${new Date().getFullYear()} Bevars. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  private generateCounterOfferEmail(data: NegotiationNotificationData): string {
    const priceChange = data.priceChange || ((data.negotiatedPrice || 0) - data.originalPrice);
    const isIncrease = priceChange > 0;
    const changePercent = data.originalPrice > 0 ? ((Math.abs(priceChange) / data.originalPrice) * 100).toFixed(1) : '0';
    
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🔄 Counter Offer Received</h2>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
          <p>Dear ${data.buyerName},</p>
          <p><strong>${data.exporterName}</strong> from <strong>${data.exporterCompany}</strong> has responded to your negotiation with a counter offer.</p>
          
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #f59e0b; margin-top: 0;">Counter Offer Details</h3>
            <p><strong>Crop:</strong> ${data.cropName} (${data.variety})</p>
            <p><strong>Quantity:</strong> ${data.quantity.toLocaleString()} units</p>
            <p><strong>Your Requested Price:</strong> ₦${data.originalPrice.toLocaleString()}/unit</p>
            <p><strong>Exporter's Counter Price:</strong> ₦${(data.negotiatedPrice || 0).toLocaleString()}/unit</p>
            <p><strong>Price Adjustment:</strong> 
              <span style="color: ${isIncrease ? '#28a745' : '#dc3545'};">
                ${isIncrease ? '+' : ''}₦${priceChange.toLocaleString()} (${isIncrease ? '+' : ''}${changePercent}%)
              </span>
            </p>
            ${data.negotiationNotes ? `<p><strong>Exporter's Notes:</strong> "${data.negotiationNotes}"</p>` : ''}
          </div>

          <div style="background-color: #fff3cd; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>⏰ Decision Time:</strong> Review the counter offer and decide whether to accept, make another counter-offer, or end negotiations.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.frontendUrl || this.configService.get<string>('FRONTEND_URL')}/dashboard/offers/${data.offerId}" 
               style="display: inline-block; margin: 0 10px; padding: 12px 24px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">Accept Offer</a>
            <a href="${data.frontendUrl || this.configService.get<string>('FRONTEND_URL')}/dashboard/offers/${data.offerId}" 
               style="display: inline-block; margin: 0 10px; padding: 12px 24px; background-color: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">Counter Again</a>
          </div>

          <p>Good negotiations lead to win-win outcomes for everyone!</p>
          <p>Best regards,<br>The Bevars Team</p>
        </div>
        <div style="text-align: center; padding: 20px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d;">
          <p>This is an automated notification. You can manage your email preferences in your dashboard.</p>
          <p>&copy; ${new Date().getFullYear()} Bevars. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  private generateNegotiationAcceptedEmail(data: NegotiationNotificationData): string {
    const finalTotal = (data.negotiatedPrice || data.originalPrice) * data.quantity;
    
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745, #218838); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🎉 Negotiation Successful!</h2>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
          <p>Dear ${data.exporterName},</p>
          <p>Congratulations! <strong>${data.buyerName}</strong> has accepted your negotiated terms for the ${data.cropName} offer.</p>
          
          <div style="background-color: #e8f5e8; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #28a745; margin-top: 0;">🎯 Final Agreement</h3>
            <p><strong>Crop:</strong> ${data.cropName} (${data.variety})</p>
            <p><strong>Quantity:</strong> ${data.quantity.toLocaleString()} units</p>
            <p><strong>Final Price:</strong> ₦${(data.negotiatedPrice || data.originalPrice).toLocaleString()}/unit</p>
            <p><strong>Total Value:</strong> ₦${finalTotal.toLocaleString()}</p>
            <p><strong>Buyer:</strong> ${data.buyerName} (${data.buyerCompany})</p>
          </div>

          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #155724; margin-top: 0;">📋 Next Steps:</h4>
            <ul style="color: #155724; margin: 0; padding-left: 20px;">
              <li>An order has been automatically created</li>
              <li>Prepare your ${data.cropName} for delivery</li>
              <li>Upload any required documentation</li>
              <li>Coordinate delivery with the buyer</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.frontendUrl || this.configService.get<string>('FRONTEND_URL')}/dashboard/orders" 
               style="display: inline-block; margin: 0 10px; padding: 12px 24px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">View Order</a>
            <a href="${data.frontendUrl || this.configService.get<string>('FRONTEND_URL')}/dashboard/offers" 
               style="display: inline-block; margin: 0 10px; padding: 12px 24px; background-color: #6c757d; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">All Offers</a>
          </div>

          <p>Thank you for your flexibility in the negotiation process. Successful deals benefit everyone!</p>
          <p>Best regards,<br>The Bevars Team</p>
        </div>
        <div style="text-align: center; padding: 20px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d;">
          <p>This is an automated notification. You can manage your email preferences in your dashboard.</p>
          <p>&copy; ${new Date().getFullYear()} Bevars. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  private generateNegotiationDeclinedEmail(data: NegotiationNotificationData): string {
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">❌ Negotiation Declined</h2>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
          <p>Dear ${data.exporterName},</p>
          <p>We wanted to inform you that <strong>${data.buyerName}</strong> has decided not to proceed with the negotiated terms for your ${data.cropName} offer.</p>
          
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #dc3545; margin-top: 0;">Declined Negotiation</h3>
            <p><strong>Crop:</strong> ${data.cropName} (${data.variety})</p>
            <p><strong>Quantity:</strong> ${data.quantity.toLocaleString()} units</p>
            <p><strong>Last Price:</strong> ₦${(data.negotiatedPrice || data.originalPrice).toLocaleString()}/unit</p>
            <p><strong>Buyer:</strong> ${data.buyerName} (${data.buyerCompany})</p>
            ${data.negotiationNotes ? `<p><strong>Reason:</strong> "${data.negotiationNotes}"</p>` : ''}
          </div>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>💡 Don't be discouraged!</strong> This is a normal part of business. Your offer is still available for other interested buyers.</p>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
            <h4 style="color: #007bff; margin-top: 0;">🚀 What's Next?</h4>
            <ul style="color: #007bff; margin: 0; padding-left: 20px;">
              <li>Your original offer remains active</li>
              <li>Other buyers can still discover and purchase your ${data.cropName}</li>
              <li>Consider adjusting your pricing strategy based on market feedback</li>
              <li>Keep engaging with potential buyers</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.frontendUrl || this.configService.get<string>('FRONTEND_URL')}/dashboard/offers" 
               style="display: inline-block; margin: 0 10px; padding: 12px 24px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">View All Offers</a>
            <a href="${data.frontendUrl || this.configService.get<string>('FRONTEND_URL')}/dashboard/sourcing-requests" 
               style="display: inline-block; margin: 0 10px; padding: 12px 24px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">Find New Opportunities</a>
          </div>

          <p>Keep up the great work! Every interaction helps you improve and find the right buyers.</p>
          <p>Best regards,<br>The Bevars Team</p>
        </div>
        <div style="text-align: center; padding: 20px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d;">
          <p>This is an automated notification. You can manage your email preferences in your dashboard.</p>
          <p>&copy; ${new Date().getFullYear()} Bevars. All rights reserved.</p>
        </div>
      </div>
    `;
  }
}
