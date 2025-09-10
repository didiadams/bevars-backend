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

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...dbConfig,
  entities: [path.join(__dirname, 'src/**/*.entity.{ts,js}')],
  migrations: [path.join(__dirname, 'src/migrations/*.{ts,js}')],
  synchronize: false, // Set to false when using migrations
  logging: isDevelopment,
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false
  } : false,
});
