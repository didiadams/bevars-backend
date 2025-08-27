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
}
