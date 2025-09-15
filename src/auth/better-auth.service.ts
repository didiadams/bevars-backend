import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../user/entities/user.entity';
import { GlobalBuyer } from '../global-buyer/entities/global-buyer.entity';
import { Exporter } from '../exporter/entities/exporter.entity';
import { CreateUserDto } from '../user/dto/create-user.dto';

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


  async signUp(email: string, password: string, userData: CreateUserDto) {
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findOne({ where: { email } });
      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      console.log('Signup userData received:', userData);

      // Create user with proper field mapping
        const user = this.userRepository.create({
          email,
          password: hashedPassword,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          phoneNumber: userData.phoneNumber,
          countryCode: userData.countryCode,
          countryName: userData.countryName,
          role: userData.role || UserRole.GLOBAL_BUYER,
          companyName: userData.companyName,
          isVerified: false, // User must be verified by admin
          isActive: false,   // User must be activated by admin
        });

      console.log('User entity before save:', user);
      const savedUser = await this.userRepository.save(user);
      console.log('User saved successfully:', savedUser.id);

      // Create role-specific entity
      if (savedUser.role === UserRole.GLOBAL_BUYER) {
        const globalBuyer = this.globalBuyerRepository.create({
          userId: savedUser.id,
          businessRegistrationNumber: undefined, // Not available in CreateUserDto
          businessDescription: userData.companyName,
        });
        const savedGlobalBuyer = await this.globalBuyerRepository.save(globalBuyer);
        console.log('GlobalBuyer created:', savedGlobalBuyer.id);
      } else if (savedUser.role === UserRole.EXPORTER) {
        const exporter = this.exporterRepository.create({
          userId: savedUser.id,
          companyRegistrationNumber: undefined, // Not available in CreateUserDto
          businessDescription: userData.companyName,
        });
        const savedExporter = await this.exporterRepository.save(exporter);
        console.log('Exporter created:', savedExporter.id);
      }

      // Remove password from response
      const { password: _, ...userResponse } = savedUser;
      return userResponse;
    } catch (error) {
      console.error('Signup error:', error);
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
          throw new UnauthorizedException('Your account is not active yet. Please wait for admin approval.');
        }

      // Generate JWT token
      const payload = { 
        sub: user.id, 
        email: user.email, 
        role: user.role,
        globalBuyerId: user.globalBuyer?.id,
        exporterId: user.exporter?.id,
      };
      
      console.log('=== SIGNIN DEBUG ===');
      console.log('Login attempt for email:', email);
      console.log('User found in DB:', user.email, 'ID:', user.id, 'Role:', user.role);
      console.log('JWT payload being created:', payload);
      
      const token = this.jwtService.sign(payload);
      console.log('JWT token created, length:', token.length);
      console.log('=== END SIGNIN DEBUG ===');

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

  async getUser(userId: string) {
    try {
      // Find user by ID
      const user = await this.userRepository.findOne({
        where: { id: userId },
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
