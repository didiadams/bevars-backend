import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from 'src/user/entities/user.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

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
}
