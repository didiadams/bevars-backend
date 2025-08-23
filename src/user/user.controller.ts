import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './user.service';
import { Validate, ValidatePromise } from 'class-validator';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { FarmerOnboardingDto } from './dto/create-onboarding.dto';

@Controller('user-empty')
export class UserController {
  // Route to get all buyers
}
