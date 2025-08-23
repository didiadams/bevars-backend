import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from 'src/user/entities/user.entity';
import { GlobalBuyer } from 'src/global-buyer/entities/global-buyer.entity';
import { Exporter } from 'src/exporter/entities/exporter.entity';
import { ResponseService } from 'src/common/services/response.service';
import { LoginDto } from 'src/user/dto/signin.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(GlobalBuyer)
    private readonly globalBuyerRepository: Repository<GlobalBuyer>,
    @InjectRepository(Exporter)
    private readonly exporterRepository: Repository<Exporter>,
    private readonly jwtService: JwtService,
    private readonly responseService: ResponseService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['globalBuyer', 'exporter'],
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['globalBuyer', 'exporter'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role,
      globalBuyerId: user.globalBuyer?.id,
      exporterId: user.exporter?.id,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        globalBuyerId: user.globalBuyer?.id,
        exporterId: user.exporter?.id,
      }
    };
  }

  async findUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['globalBuyer', 'exporter'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findUserByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['globalBuyer', 'exporter'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
