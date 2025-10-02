import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment file
const envPath = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envPath });

const isDevelopment = process.env.NODE_ENV !== 'production';

// Database config
const getDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10),
      username: url.username,
      password: url.password,
      database: url.pathname.substring(1),
      ssl: { rejectUnauthorized: false },
    };
  }
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5432,
    username: process.env.DATABASE_USER || 'bevars_user',
    password: process.env.DATABASE_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || 'source_db',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
};

const dbConfig = getDatabaseConfig();

// --- Entity & Migration paths ---
const getEntityPath = () =>
  isDevelopment
    ? [path.resolve(__dirname, '../src/**/*.entity.ts')]
    : [path.resolve(__dirname, './**/*.entity.js')];

const getMigrations = () =>
  isDevelopment
    ? [path.resolve(__dirname, '../src/migrations/*.ts')]
    : [path.resolve(__dirname, './migrations/*.js')];

// --- Data Source ---
export const AppDataSource = new DataSource({
  type: 'postgres',
  ...dbConfig,
  entities: getEntityPath(),
  migrations: getMigrations(),
  synchronize: false, // never true in prod
  logging: isDevelopment,
  migrationsTransactionMode: 'each',

  extra: {
    max: process.env.NODE_ENV === 'production' ? 20 : 10,
    min: 2,
    statement_timeout: 30000,
    query_timeout: 30000,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    application_name: 'bevars-exporters',
  },
});
