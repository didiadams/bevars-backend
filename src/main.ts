import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
//import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // const whitelistedOrigins = [
  //   'https://farm-frontend-rosy.vercel.app',
  //   'http://localhost:8080',
  //   'https://www.bevars.com',
  //   'https://bevars.com',
  // ];
  // app.use(helmet());

  // app.use(
  //   helmet({
  //     contentSecurityPolicy: {
  //       directives: {
  //         defaultSrc: ["'self'"],
  //         scriptSrc:  ["'self'", ...whitelistedEndpoints],
  //         styleSrc: ["'self'", "'unsafe-inline'", ...whitelistedEndpoints],
  //         imgSrc: ["'self'", 'data:', ...whitelistedEndpoints],
  //         objectSrc: ["'none'"],
  //         upgradeInsecureRequests: [],

  //       },
  //     },
  //     frameguard: { action: 'deny' }, // Prevent clickjacking
  //     xssFilter: true, // XSS protection
  //     noSniff: true, // Prevent MIME type sniffing
  //     ieNoOpen: true, // X-Download-Options for IE8+
  //     referrerPolicy: { policy: 'no-referrer' }, // Referrer policy
  //   }),
  // );

app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://farm-frontend-rosy.vercel.app',
      'http://localhost:8080',
      'http://localhost:3000',
      'https://www.bevars.com',
      'https://bevars.com',
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // ✅ MUST be present if using Authorization headers or cookies
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
