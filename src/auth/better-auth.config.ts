import { betterAuth } from 'better-auth';

export const createAuthConfig = () => {
  return betterAuth({
    database: {
      provider: 'mysql',
      url: process.env.DATABASE_URL || `mysql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Disable for now to simplify setup
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: true,
          defaultValue: 'global_buyer',
        },
        firstName: {
          type: 'string',
          required: false,
        },
        lastName: {
          type: 'string',
          required: false,
        },
        phone: {
          type: 'string',
          required: false,
        },
        businessName: {
          type: 'string',
          required: false,
        },
        businessType: {
          type: 'string',
          required: false,
        },
        registrationNumber: {
          type: 'string',
          required: false,
        },
        isVerified: {
          type: 'boolean',
          defaultValue: false,
        },
      },
    },
    trustedOrigins: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'https://your-production-domain.com',
    ],
  });
};

export type Auth = ReturnType<typeof createAuthConfig>;
