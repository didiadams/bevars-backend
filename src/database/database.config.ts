import * as path from 'path';
import * as dotenv from 'dotenv';
import { registerAs } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

// Load environment-specific .env file: prefer .env.production in production
const envPath = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envPath });

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
    username: process.env.DATABASE_USER || 'bevars_user',
    password: process.env.DATABASE_PASSWORD || '@DIDIyano123',
    database: process.env.DATABASE_NAME || 'source_db',
  };
};


const dbConfig = getDatabaseUrl();

const config = {
  type: 'postgres',
  ...dbConfig,
  entities: isDevelopment 
    ? [path.join(__dirname, '../**/*.entity.ts')]
    : [path.join(__dirname, '../**/*.entity.js')],
  migrations: isDevelopment
    ? [path.join(__dirname, '../migrations/*.ts')]
    : [path.join(__dirname, '../migrations/*.js')],
  // Enforce per-migration transaction overrides for migrations that require non-transactional execution
  migrationsTransactionMode: 'each', // allow migration-level `transaction = false`
  synchronize: useMigrations ? false : isDevelopment,
  migrationsRun: useMigrations && !isDevelopment,
  autoLoadEntities: true,
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false
  } : false,
  
  // 🚀 CONNECTION POOLING: Instead of creating new DB connection for each request,
  // we maintain a pool of reusable connections. This dramatically improves performance
  // under high load by avoiding connection overhead.
  poolSize: process.env.NODE_ENV === 'production' ? 10 : 5, // Total connections in pool
  
  // ⏱️ QUERY TIMEOUT: Prevents runaway queries from consuming resources indefinitely.
  // Any query taking longer than 5 seconds gets terminated automatically.
  maxQueryExecutionTime: 5000, // 5 seconds
  
  extra: {
    // 🔧 ADVANCED CONNECTION POOL SETTINGS
  max: process.env.NODE_ENV === 'production' ? 20 : 10, // Maximum concurrent connections
    min: 2, // Always keep 2 connections alive (prevents cold start delays)
    
    // ⏰ CONNECTION LIFECYCLE MANAGEMENT
    acquire: 60000, // Max 60s to get connection from pool (prevents indefinite waiting)
    idle: 10000, // Close idle connections after 10s (frees up resources)
    evict: 1000, // Check for idle connections every 1s (resource cleanup frequency)
    
    // 🚫 TIMEOUT PROTECTION: Prevents database from hanging indefinitely
    statement_timeout: 30000, // PostgreSQL: Kill queries after 30s
    query_timeout: 30000, // Driver level: Kill queries after 30s
    connectionTimeoutMillis: 10000, // Max 10s to establish initial connection
    idleTimeoutMillis: 30000, // Close connection if idle for 30s
    
    // 🏷️ CONNECTION IDENTIFICATION: Helps identify connections in PostgreSQL logs
    application_name: 'bevars-exporters', // Shows up in pg_stat_activity
    
    // 🔄 TCP KEEP-ALIVE: Detects dead connections and prevents connection drops
    keepAlive: true, // Enable TCP keep-alive packets
    keepAliveInitialDelayMillis: 10000, // Start keep-alive after 10s of inactivity
  },
  
  // 📊 PERFORMANCE MONITORING: Track slow queries and errors for optimization
  logging: isDevelopment ? 'all' : ['error', 'warn'], // Log everything in dev, errors in prod
  logger: 'advanced-console', // Colored, formatted console output
  // maxQueryExecutionTime logs queries slower than 5s for performance analysis
};

export default registerAs('typeorm', () => config);
export const connectionSource = new DataSource(config as DataSourceOptions);