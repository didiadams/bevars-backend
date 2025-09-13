import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from 'src/user/entities/user.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    let user = request.user;

    // If user is not already populated (JWT guard didn't run), try to extract from token
    if (!user) {
      const token = this.extractTokenFromHeader(request);
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      try {
        const payload = this.jwtService.verify(token);
        user = {
          id: payload.sub,
          sub: payload.sub,
          email: payload.email,
          role: payload.role,
          globalBuyerId: payload.globalBuyerId,
          exporterId: payload.exporterId,
        };
        request.user = user; // Set user on request for downstream use
      } catch (error) {
        throw new UnauthorizedException('Invalid token');
      }
    }

    // Ensure user is authenticated
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check for admin role
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied. Admin privileges required');
    }

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
