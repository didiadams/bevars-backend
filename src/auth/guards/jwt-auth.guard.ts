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

import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
		// You can add additional checks here if needed before passport validation
		return super.canActivate(context);
	}

	// This will be called after the strategy validates the token.
	// We add detailed logging to help debug why users may be rejected.
	handleRequest(err: any, user: any, info: any) {
		console.log('JwtAuthGuard.handleRequest - err:', err);
		console.log('JwtAuthGuard.handleRequest - user:', user);
		console.log('JwtAuthGuard.handleRequest - info:', info);

		if (err) {
			console.error('JwtAuthGuard - error from strategy:', err);
			throw err;
		}

		if (!user) {
			// If strategy provides info (e.g. token expired), include it in the message
			const message = info?.message || 'Invalid or missing authentication token';
			console.warn('JwtAuthGuard - no user attached to request:', message);
			throw new UnauthorizedException(message);
		}

		// At this point user is the object returned by JwtStrategy.validate(payload)
		// That validate currently returns a minimal object; controllers/guards expecting
		// full user properties (like isActive) won't find them here. If you need the
		// full user from DB, load it here using a service (not done to keep guard simple).

		return user;
	}
}