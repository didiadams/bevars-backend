import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../user/entities/user.entity';
import { GlobalBuyer } from '../global-buyer/entities/global-buyer.entity';
import { Exporter } from '../exporter/entities/exporter.entity';

@Injectable()
export class BetterAuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(GlobalBuyer)
    private globalBuyerRepository: Repository<GlobalBuyer>,
    @InjectRepository(Exporter)
    private exporterRepository: Repository<Exporter>,
    private jwtService: JwtService,
  ) {}

  async signUp(email: string, password: string, additionalData: any) {
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findOne({ where: { email } });
      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = this.userRepository.create({
        email,
        password: hashedPassword,
        firstName: additionalData.firstName || '',
        lastName: additionalData.lastName || '',
        phoneNumber: additionalData.phone,
        role: additionalData.role || UserRole.GLOBAL_BUYER,
        companyName: additionalData.businessName,
        isVerified: true, // Auto-verify for now
      });

      const savedUser = await this.userRepository.save(user);

      // Create role-specific entity
      if (savedUser.role === UserRole.GLOBAL_BUYER) {
        const globalBuyer = this.globalBuyerRepository.create({
          user: savedUser,
          userId: savedUser.id,
          businessRegistrationNumber: additionalData.registrationNumber,
          businessDescription: additionalData.businessName,
        });
        await this.globalBuyerRepository.save(globalBuyer);
      } else if (savedUser.role === UserRole.EXPORTER) {
        const exporter = this.exporterRepository.create({
          user: savedUser,
          userId: savedUser.id,
          companyRegistrationNumber: additionalData.registrationNumber,
          businessDescription: additionalData.businessName,
        });
        await this.exporterRepository.save(exporter);
      }

      // Remove password from response
      const { password: _, ...userResponse } = savedUser;
      return userResponse;
    } catch (error) {
      throw new BadRequestException(`Signup failed: ${error.message}`);
    }
  }

  async signIn(email: string, password: string) {
    try {
      // Find user
      const user = await this.userRepository.findOne({ 
        where: { email },
        relations: ['globalBuyer', 'exporter']
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      // Generate JWT token
      const payload = { 
        sub: user.id, 
        email: user.email, 
        role: user.role,
        globalBuyerId: user.globalBuyer?.id,
        exporterId: user.exporter?.id,
      };
      const token = this.jwtService.sign(payload);

      // Remove password from response
      const { password: _, ...userResponse } = user;

      return {
        token,
        user: userResponse,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(`Login failed: ${error.message}`);
    }
  }

  async signOut(sessionToken: string) {
    // For JWT, we can't invalidate tokens server-side without a blacklist
    // For now, just return success - the frontend will remove the token
    return { success: true };
  }

  async getUser(sessionToken: string) {
    try {
      // Verify and decode JWT token
      const payload = this.jwtService.verify(sessionToken);
      
      // Find user
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['globalBuyer', 'exporter'],
      });

      if (!user || !user.isActive) {
        return null;
      }

      // Remove password from response
      const { password: _, ...userResponse } = user;
      return userResponse;
    } catch (error) {
      return null;
    }
  }

  async getSession(sessionToken: string) {
    const user = await this.getUser(sessionToken);
    if (user) {
      return { user, token: sessionToken };
    }
    return null;
  }
}
