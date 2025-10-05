import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './user.service';
import { Validate, ValidatePromise } from 'class-validator';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { FarmerOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('notification-preferences')
  @UseGuards(JwtAuthGuard)
  async getNotificationPreferences(@Request() req) {
    return this.userService.getNotificationPreferences(req.user.id);
  }

  @Put('notification-preferences')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateNotificationPreferences(
    @Request() req,
    @Body() updateDto: UpdateNotificationPreferencesDto,
  ) {
    const success = await this.userService.updateNotificationPreferences(req.user.id, updateDto);
    return { success };
  }

  @Post('notifications/test')
  @UseGuards(JwtAuthGuard)
  async sendTestNotification(@Request() req, @Body() body: { type: string }) {
    const success = await this.userService.sendTestNotification(req.user.id, body.type);
    return { success };
  }
}
