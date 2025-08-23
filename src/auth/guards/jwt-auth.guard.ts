// import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
// import { Observable } from 'rxjs';

// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {
//   canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
//     return super.canActivate(context);
//   }

//     handleRequest(err: any, user: any, info: any) {
//        console.log('JWT Auth Guard - Error:', err, user); // Debug log
//       if (err || !user) {
       
//       throw err || new UnauthorizedException('Invalid token');
//     }
//     return user;
//   }
// }

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}