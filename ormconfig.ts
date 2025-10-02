import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envPath = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envPath });

const isDevelopment = process.env.NODE_ENV !== 'production';

// Entities
const getEntityPath = () =>
  isDevelopment
    ? [path.resolve(__dirname, '../src/**/*.entity.ts')]
    : [path.resolve(__dirname, './**/*.entity.js')];

// Migrations
const getMigrations = () =>
  isDevelopment
    ? [path.resolve(__dirname, '../src/migrations/*.ts')]
    : [path.resolve(__dirname, './migrations/*.js')];

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT) || 5432,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: getEntityPath(),
  migrations: getMigrations(),
  synchronize: false,
  logging: isDevelopment,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export { AppDataSource };
