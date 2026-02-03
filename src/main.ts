import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bodyParser from 'body-parser';
//import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Increase body size limit for file uploads (especially mobile photos)
  app.use(bodyParser.json({ limit: '15mb' }));
  app.use(bodyParser.urlencoded({ limit: '15mb', extended: true }));
  
  // Block access to sensitive files
  app.use((req, res, next) => {
    const blockedPaths = ['.env', '.env.production', '.env.local', 'package.json', 'yarn.lock', 'node_modules'];
    const requestPath = req.path.toLowerCase();
    
    if (blockedPaths.some(blocked => requestPath.includes(blocked))) {
      return res.status(403).json({ 
        message: 'Access denied',
        statusCode: 403 
      });
    }
    next();
  });

app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://farm-frontend-rosy.vercel.app',
      'http://localhost:8080',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://www.bevars.com',
      'https://bevars.com',
      // Railway internal
      'https://api.bevars.com',
    ];
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
});


  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      enableDebugMessages: true,
      forbidNonWhitelisted: false, // Allow extra properties but ignore them
      // Allow implicit type conversion (e.g. "123" -> number, "true" -> boolean)
      // so frontend string-form payloads are transformed to the DTO types during validation.
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: true,
      },
      exceptionFactory: (errors) => {
        // Format validation errors to a consistent shape
        const formatted = errors.map((err) => ({
          field: err.property,
          errors: Object.values(err.constraints ?? {}),
          value: err.value,
        }));
        return new (require('@nestjs/common').BadRequestException)({
          statusCode: 400,
            message: 'Validation failed',
            errors: formatted,
        });
      },
    }),
  );

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AllExceptionsFilter());
  // Enable global serialization so that class-transformer decorators like @Exclude()
  // on entities are respected when sending responses. This prevents sensitive fields
  // like `password` from being serialized.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  console.log(process.env.BACKEND_PORT, 'port');
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
