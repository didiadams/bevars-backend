import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull, Not, In } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { MailService } from '../../mail/mail-service.service';
import { Exporter } from '../../exporter/entities/exporter.entity';
import { GlobalBuyer } from '../../global-buyer/entities/global-buyer.entity';
import { ConfigService } from '@nestjs/config';

interface OnboardingStatus {
  documentsUploaded: number;
  totalRequired: number;
  verificationStatus: string;
}

@Injectable()
export class OnboardingReminderService {
  private readonly logger = new Logger(OnboardingReminderService.name);
  private readonly REMINDER_DAYS = [1, 3, 7, 14]; // Days after signup to send reminders

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Exporter)
    private readonly exporterRepository: Repository<Exporter>,
    @InjectRepository(GlobalBuyer)
    private readonly globalBuyerRepository: Repository<GlobalBuyer>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Send onboarding reminders to users who haven't completed verification
   * Runs daily at 10:00 AM
   */
  @Cron('0 10 * * *') // Every day at 10:00 AM
  async sendOnboardingReminders() {
    this.logger.log('Starting onboarding reminder job...');

    try {
      // Find users who:
      // 1. Have verified their email (isEmailVerified = true)
      // 2. Are not fully verified (isVerified = false)
      // 3. Are either exporters or global buyers
      const unverifiedUsers = await this.userRepository.find({
        where: {
          isEmailVerified: true,
          isVerified: false,
          role: In([UserRole.EXPORTER, UserRole.GLOBAL_BUYER]),
        },
        relations: ['exporter', 'globalBuyer'],
      });

      this.logger.log(`Found ${unverifiedUsers.length} unverified users to check for reminders`);

      let remindersSent = 0;

      for (const user of unverifiedUsers) {
        try {
          const daysSinceSignup = this.getDaysSinceSignup(user.createdAt);
          
          // Only send reminders on specific days
          if (!this.shouldSendReminder(daysSinceSignup, user.id)) {
            continue;
          }

          // Get onboarding status based on role
          const onboardingStatus = await this.getOnboardingStatus(user);

          // Skip if already fully uploaded all documents
          if (onboardingStatus.documentsUploaded >= onboardingStatus.totalRequired) {
            continue;
          }

          await this.mailService.sendOnboardingReminderEmail({
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            documentsUploaded: onboardingStatus.documentsUploaded,
            totalRequired: onboardingStatus.totalRequired,
            daysSinceSignup,
            verificationStatus: onboardingStatus.verificationStatus,
            frontendUrl: this.configService.get<string>('FRONTEND_URL'),
          });

          this.logger.log(`Sent onboarding reminder to ${user.email} (day ${daysSinceSignup})`);
          remindersSent++;

          // Small delay to avoid rate limits
          await this.delay(500);
        } catch (error) {
          this.logger.error(`Failed to send reminder to ${user.email}:`, error);
        }
      }

      this.logger.log(`Onboarding reminder job complete. Sent ${remindersSent} reminders.`);
    } catch (error) {
      this.logger.error('Onboarding reminder job failed:', error);
    }
  }

  private getDaysSinceSignup(createdAt: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  private shouldSendReminder(daysSinceSignup: number, userId: string): boolean {
    // Send reminder if days since signup matches one of our reminder days
    // Use a simple check - in production you might want to track sent reminders in DB
    return this.REMINDER_DAYS.includes(daysSinceSignup);
  }

  private async getOnboardingStatus(user: User): Promise<OnboardingStatus> {
    const isExporter = user.role === UserRole.EXPORTER;
    const totalRequired = 2; // Both exporters and buyers now only need 2 docs

    if (isExporter && user.exporter) {
      const exporter = await this.exporterRepository.findOne({
        where: { id: user.exporter.id },
        relations: ['verificationDocuments'],
      });

      const uploadedDocs = exporter?.verificationDocuments?.length || 0;
      const status = exporter?.verificationStatus || 'not_started';

      return {
        documentsUploaded: uploadedDocs,
        totalRequired,
        verificationStatus: status,
      };
    } else if (!isExporter && user.globalBuyer) {
      const buyer = await this.globalBuyerRepository.findOne({
        where: { id: user.globalBuyer.id },
        relations: ['verificationDocuments'],
      });

      const uploadedDocs = buyer?.verificationDocuments?.length || 0;
      const status = buyer?.status || 'not_started';

      return {
        documentsUploaded: uploadedDocs,
        totalRequired,
        verificationStatus: status,
      };
    }

    return {
      documentsUploaded: 0,
      totalRequired,
      verificationStatus: 'not_started',
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manual trigger for testing - can be called via admin endpoint
   */
  async triggerManualReminder(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['exporter', 'globalBuyer'],
    });

    if (!user) {
      throw new Error('User not found');
    }

    const daysSinceSignup = this.getDaysSinceSignup(user.createdAt);
    const onboardingStatus = await this.getOnboardingStatus(user);

    await this.mailService.sendOnboardingReminderEmail({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      documentsUploaded: onboardingStatus.documentsUploaded,
      totalRequired: onboardingStatus.totalRequired,
      daysSinceSignup,
      verificationStatus: onboardingStatus.verificationStatus,
      frontendUrl: this.configService.get<string>('FRONTEND_URL'),
    });

    return true;
  }
}
