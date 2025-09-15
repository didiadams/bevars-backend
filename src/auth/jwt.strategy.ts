import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CustomConfigService } from 'src/config/config.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly customConfig: CustomConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || customConfig.jwtSecret,
    });
  }

  async validate(payload: any) {
    console.log('JWT Strategy validate - payload received:', payload);

    // Load the full user from DB so we have flags like isActive/isVerified
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: ['globalBuyer', 'exporter'],
    });

    console.log('JWT Strategy validate - user from DB:', user);

    if (!user) {
      console.warn('JWT Strategy validate - user not found in DB');
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      console.warn('JWT Strategy validate - user not active');
      throw new UnauthorizedException('User account is not active');
    }

    // Do not block JWT validation on verification flag alone.
    // Allow users who are active to authenticate; verification can be a separate admin process.
    if (!user.isVerified) {
      console.warn('JWT Strategy validate - user not verified (allowing login because user is active)');
      // don't throw here — allow login as long as isActive is true
    }

    // Remove sensitive fields
    const { password: _, ...userSafe } = user as any;

    console.log('JWT Strategy validate - returning user object:', userSafe);
    return userSafe;
  }
}