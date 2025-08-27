import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CustomConfigService } from 'src/config/config.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly customConfig: CustomConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || customConfig.jwtSecret,
    });
  }

  async validate(payload: any) {
    console.log('JWT Strategy validate - payload received:', payload);
    
    const user = {
      id: payload.sub,
      sub: payload.sub, // Add this for backward compatibility
      email: payload.email,
      role: payload.role,
      globalBuyerId: payload.globalBuyerId,
      exporterId: payload.exporterId,
    };
    
    console.log('JWT Strategy validate - returning user object:', user);
    return user;
  }
}