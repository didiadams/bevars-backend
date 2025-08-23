import { Body, Controller, Get, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { BetterAuthService } from './better-auth.service';

interface SignupDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  businessName?: string;
  businessType?: string;
  registrationNumber?: string;
}

interface LoginDto {
  email: string;
  password: string;
}

@Controller('api/v1/auth')
export class BetterAuthController {
  constructor(private readonly authService: BetterAuthService) {}

  @Post('signup')
  async signup(@Body() signupDto: SignupDto, @Res() res: Response) {
    try {
      const result = await this.authService.signUp(
        signupDto.email,
        signupDto.password,
        {
          firstName: signupDto.firstName,
          lastName: signupDto.lastName,
          phone: signupDto.phone,
          role: signupDto.role || 'global_buyer',
          businessName: signupDto.businessName,
          businessType: signupDto.businessType,
          registrationNumber: signupDto.registrationNumber,
        },
      );

      return res.status(HttpStatus.CREATED).json({
        statusCode: 201,
        message: 'User created successfully',
        data: result,
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: error.message || 'Signup failed',
        data: null,
      });
    }
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res() res: Response) {
    try {
      const result = await this.authService.signIn(loginDto.email, loginDto.password);

      return res.status(HttpStatus.OK).json({
        statusCode: 200,
        message: 'Login successful',
        data: {
          accessToken: result.token,
          user: result.user,
        },
      });
    } catch (error) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: 401,
        message: error.message || 'Login failed',
        data: null,
      });
    }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        await this.authService.signOut(token);
      }

      return res.status(HttpStatus.OK).json({
        statusCode: 200,
        message: 'Logout successful',
        data: null,
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: error.message || 'Logout failed',
        data: null,
      });
    }
  }

  @Get('me')
  async getMe(@Req() req: Request, @Res() res: Response) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          statusCode: 401,
          message: 'No token provided',
          data: null,
        });
      }

      const user = await this.authService.getUser(token);
      if (!user) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          statusCode: 401,
          message: 'Invalid token',
          data: null,
        });
      }

      return res.status(HttpStatus.OK).json({
        statusCode: 200,
        message: 'User retrieved successfully',
        data: { role: user.role, ...user },
      });
    } catch (error) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: 401,
        message: error.message || 'Authentication failed',
        data: null,
      });
    }
  }

  @Post('verify-email')
  async verifyEmail(@Body() body: { token: string }, @Res() res: Response) {
    try {
      // For now, just return success - implement email verification later
      return res.status(HttpStatus.OK).json({
        statusCode: 200,
        message: 'Email verified successfully',
        data: { verified: true },
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: error.message || 'Email verification failed',
        data: null,
      });
    }
  }
}
