// import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import { ROLES_KEY } from '../decorators/roles.decorator';
// import { UserRole } from '../enums/user-role.enum';

// @Injectable()
// export class RolesGuard implements CanActivate {
//   constructor(private reflector: Reflector) {}

//   canActivate(context: ExecutionContext): boolean {
//     const requiredRoles = this.reflector.getAllAndOverride<(UserRole | string)[]>(ROLES_KEY, [
//       context.getHandler(),
//       context.getClass(),
//     ]);

//     console.log('Roles Guard - Required Roles:', requiredRoles); // Debug log

//     if (!requiredRoles) {
//       console.log('Roles Guard - No roles required, allowing access'); // Debug log
//       return true;
//     }

//     const { user } = context.switchToHttp().getRequest();
//     console.log('Roles Guard - User from request:', user); // Debug log

//     if (!user) {
//       console.log('Roles Guard - No user found in request'); // Debug log
//       throw new ForbiddenException('User not found');
//     }

//     if (!user.role) {
//       console.log('Roles Guard - User has no role'); // Debug log
//       throw new ForbiddenException('User role not found');
//     }

//     console.log('Roles Guard - User role:', user.role); // Debug log
//     console.log('Roles Guard - User role type:', typeof user.role); // Debug log

//     const hasRole = requiredRoles.some((role) => {
//       // Convert both to strings for comparison
//       const userRoleStr = String(user.role).toUpperCase();
//       const requiredRoleStr = String(role).toUpperCase();
      
//       console.log(`Roles Guard - Comparing roles: ${userRoleStr} === ${requiredRoleStr}`); // Debug log
      
//       const roleMatch = userRoleStr === requiredRoleStr;
//       console.log(`Roles Guard - Role match: ${roleMatch}`); // Debug log
      
//       return roleMatch;
//     });

//     if (!hasRole) {
//       console.log('Roles Guard - Access denied, insufficient permissions'); // Debug log
//       throw new ForbiddenException(`User role ${user.role} does not have required permissions. Required roles: ${requiredRoles.join(', ')}`);
//     }

//     console.log('Roles Guard - Access granted'); // Debug log
//     return true;
//   }
// }


import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'src/user/entities/user.entity';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    console.log('Handler:', context.getHandler().name);
    console.log('Class:', context.getClass().name);
    console.log('Required roles metadata:', requiredRoles);

    if (!requiredRoles) {
      console.error('No roles metadata found for this route.');
      throw new ForbiddenException('Access denied: no roles metadata found.');
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !requiredRoles.includes(user.role)) {
      console.log('User role:', user.role);
      console.log('Required roles:', requiredRoles);
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    return true;
  }
}