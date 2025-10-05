import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { MailService } from '../mail/mail-service.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async getNotificationPreferences(userId: string) {
    const user = await this.findById(userId);
    
    // Return default preferences if not set
    return {
      emailNotifications: user.emailNotificationPreferences || {
        negotiationStarted: true,
        counterOfferReceived: true,
        negotiationAccepted: true,
        negotiationDeclined: true,
        orderCreated: true,
        orderStatusUpdated: true,
        marketTrends: false,
        platformUpdates: true,
      },
      pushNotifications: user.pushNotificationPreferences || {
        negotiationStarted: true,
        counterOfferReceived: true,
        negotiationAccepted: true,
        negotiationDeclined: true,
        orderCreated: true,
        orderStatusUpdated: true,
      },
      frequency: user.notificationFrequency || 'immediate',
    };
  }

  async updateNotificationPreferences(userId: string, preferences: UpdateNotificationPreferencesDto): Promise<boolean> {
    const user = await this.findById(userId);

    if (preferences.emailNotifications) {
      user.emailNotificationPreferences = {
        ...user.emailNotificationPreferences,
        ...preferences.emailNotifications,
      };
    }

    if (preferences.pushNotifications) {
      user.pushNotificationPreferences = {
        ...user.pushNotificationPreferences,
        ...preferences.pushNotifications,
      };
    }

    if (preferences.frequency) {
      user.notificationFrequency = preferences.frequency;
    }

    await this.userRepository.save(user);
    return true;
  }

  async sendTestNotification(userId: string, type: string): Promise<boolean> {
    const user = await this.findById(userId);
    
    // Create sample notification data for testing
    const testData = {
      offerId: 'test-offer-123',
      buyerName: 'Test Buyer',
      buyerCompany: 'Test Company',
      exporterName: user.firstName + ' ' + user.lastName,
      exporterCompany: user.companyName || 'Your Company',
      cropName: 'Premium Rice',
      originalPrice: 1500,
      negotiatedPrice: 1350,
      quantity: 1000,
      variety: 'Basmati',
      negotiationNotes: 'This is a test notification to verify your email settings.',
      negotiationType: type as any,
      savings: 150,
      frontendUrl: process.env.FRONTEND_URL,
    };

    try {
      switch (type) {
        case 'negotiationStarted':
          await this.mailService.sendNegotiationInitiatedEmail(testData);
          break;
        case 'counterOfferReceived':
          await this.mailService.sendCounterOfferEmail(testData);
          break;
        case 'negotiationAccepted':
          await this.mailService.sendNegotiationAcceptedEmail(testData);
          break;
        case 'negotiationDeclined':
          await this.mailService.sendNegotiationDeclinedEmail(testData);
          break;
        default:
          return false;
      }
      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }

  async getUserEmail(userId: string): Promise<string> {
    const user = await this.findById(userId);
    return user.email;
  }

  async shouldSendEmailNotification(userId: string, notificationType: string): Promise<boolean> {
    const user = await this.findById(userId);
    const preferences = user.emailNotificationPreferences;
    
    if (!preferences) {
      return true; // Default to sending notifications if no preferences set
    }

    return preferences[notificationType] !== false;
  }

  async shouldSendPushNotification(userId: string, notificationType: string): Promise<boolean> {
    const user = await this.findById(userId);
    const preferences = user.pushNotificationPreferences;
    
    if (!preferences) {
      return true; // Default to sending notifications if no preferences set
    }

    return preferences[notificationType] !== false;
  }
}
