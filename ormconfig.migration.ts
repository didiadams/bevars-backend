/**
 * Migration-only DataSource for CLI commands (migration:run, migration:revert, migration:show).
 * Uses empty entities array to avoid circular dependency issues during entity metadata resolution.
 * For migration:generate, use ormconfig.ts instead (requires entity metadata for schema diffing).
 */
import { MigrationDataSource as AppDataSource } from './ormconfig';

export { AppDataSource };
