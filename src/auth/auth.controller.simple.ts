import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  Get,
} from '@nestjs/common';
import { BetterAuthService } from './better-auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CreateUserDto } from 'src/user/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly betterAuthService: BetterAuthService) {}

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
    const user = await this.betterAuthService.getUser(req.user.id);
    return { user };
  }
}
