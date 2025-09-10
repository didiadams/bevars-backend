import * as path from 'path';
import * as dotenv from 'dotenv';
import { registerAs } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config();

const isDevelopment = process.env.NODE_ENV !== 'production';
const useMigrations = process.env.USE_MIGRATIONS === 'true';

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
    database: process.env.DATABASE_NAME || 'source_db',
  };
};


const dbConfig = getDatabaseUrl();

const config = {
  type: 'postgres',
  ...dbConfig,
  entities: [path.join(__dirname, '../**/*.entity.{ts,js}')],
  migrations: [path.join(__dirname, '../migrations', '*.{ts,js}')],
  synchronize: useMigrations ? false : isDevelopment,
  migrationsRun: useMigrations && !isDevelopment,
  autoLoadEntities: true,
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false
  } : false,
};

export default registerAs('typeorm', () => config);
export const connectionSource = new DataSource(config as DataSourceOptions);