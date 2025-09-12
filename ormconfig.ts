import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const isDevelopment = process.env.NODE_ENV !== 'production';

// Heroku provides DATABASE_URL, so we need to parse it
const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10),
      username: url.username,
      password: url.password,
      database: url.pathname.substring(1),
    };
  }
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5432,
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'bevars_db',
  };
};

const dbConfig = getDatabaseUrl();

// 🔧 PRODUCTION-SAFE PATH RESOLUTION
const getEntityPath = () => {
  if (isDevelopment) {
    // Development: Use TypeScript files from src/
    return [path.join(__dirname, 'src/**/*.entity.ts')];
  } else {
    // Production: Use compiled JavaScript files from dist/
    return [path.join(__dirname, 'dist/**/*.entity.js')];
  }
};

const getMigrationPath = () => {
  if (isDevelopment) {
    // Development: Use TypeScript files from src/migrations/
    return [path.join(__dirname, 'src/migrations/*.ts')];
  } else {
    // Production: Use compiled JavaScript files from dist/migrations/
    return [path.join(__dirname, 'dist/migrations/*.js')];
  }
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...dbConfig,
  entities: getEntityPath(),
  migrations: getMigrationPath(),
  synchronize: false, // Set to false when using migrations
  logging: isDevelopment,
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false
  } : false,
});
