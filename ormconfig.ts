import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment-specific .env file: in production we prefer .env.production
const envPath = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envPath });

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
    username: process.env.DATABASE_USER || 'bevars_user',
    password: process.env.DATABASE_PASSWORD || '@DIDIyano123',
    database: process.env.DATABASE_NAME || 'source_db',
  };
};

const dbConfig = getDatabaseUrl();

// 🔧 PRODUCTION-SAFE PATH RESOLUTION
const getEntityPath = () =>
  isDevelopment
    ? [path.join(__dirname, 'src/**/*.entity.ts')]
    : [path.join(__dirname, 'src/**/*.entity.js')];

const getMigrations = () => {
  if (isDevelopment) {
    return [path.join(__dirname, 'src/migrations/*.ts')];
  } else {
    // Dynamically load all migration classes from the dist folder
    const fs = require('fs');
    // FIX: Migrations are compiled to dist/src/migrations/, not dist/migrations/
    const migrationDir = path.join(__dirname, 'src/migrations');
    
    try {
      if (!fs.existsSync(migrationDir)) {
        console.error(`Migration directory not found: ${migrationDir}`);
        return [];
      }
      
      const migrationFiles = fs.readdirSync(migrationDir)
        .filter((file: string) => file.endsWith('.js') && !file.endsWith('.map'))
        .sort(); // Sort to ensure correct order
      
      console.log(`Found ${migrationFiles.length} migration files:`, migrationFiles);
      
      const migrations = [];
      for (const file of migrationFiles) {
        try {
          const migrationPath = path.join(migrationDir, file);
          const migrationModule = require(migrationPath);
          
          // Get the migration class from the module
          const migrationClass = Object.values(migrationModule)[0] as any;
          if (migrationClass && typeof migrationClass === 'function') {
            migrations.push(migrationClass);
            console.log(`✅ Loaded migration: ${migrationClass.name || file}`);
          } else {
            console.warn(`⚠️ Could not find migration class in ${file}`);
          }
        } catch (error) {
          console.error(`❌ Error loading migration ${file}:`, error.message);
        }
      }
      
      console.log(`Successfully loaded ${migrations.length} migrations`);
      return migrations;
      
    } catch (error) {
      console.error('Error reading migration directory:', error);
      return [];
    }
  }
};

// Mirror the runtime DB options from src/database/database.config.ts so the CLI uses
// the same pooling/timeout/migration settings. This prevents migration runner from
// failing due to different defaults (like transaction mode for migrations).
const AppDataSource = new DataSource({
  type: 'postgres',
  ...dbConfig,
  entities: getEntityPath(),
  migrations: getMigrations(),
  synchronize: false, // Set to false when using migrations
  logging: isDevelopment,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,

  // Enforce per-migration transaction overrides. Some migrations use CREATE INDEX CONCURRENTLY
  // which must run outside a transaction. Force 'each' here to allow per-migration overrides.
  migrationsTransactionMode: 'each',

  // Connection pooling & driver extra settings copied from runtime config
  poolSize: process.env.NODE_ENV === 'production' ? 10 : 5,
  maxQueryExecutionTime: 5000,
  extra: {
    max: process.env.NODE_ENV === 'production' ? 20 : 10,
    min: 2,
    acquire: 60000,
    idle: 10000,
    evict: 1000,
    statement_timeout: 30000,
    query_timeout: 30000,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    application_name: 'bevars-exporters',
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  },
});

export { AppDataSource };