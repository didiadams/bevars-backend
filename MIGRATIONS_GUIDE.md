# TypeORM Migrations Guide

This guide explains how to use TypeORM migrations with PostgreSQL in your Bevars application.

## Overview

Migrations are a way to version control your database schema changes. Instead of using `synchronize: true` (which automatically syncs entity changes), migrations give you precise control over database changes.

## Migration Commands

Add these commands to your workflow:

### 1. Generate Migration (from entity changes)

```bash
yarn migration:generate src/migrations/YourMigrationName
```

This compares your entities with the current database and generates a migration file.

### 2. Create Empty Migration

```bash
yarn migration:create src/migrations/YourMigrationName
```

Creates an empty migration file for custom SQL.

### 3. Run Migrations

```bash
yarn migration:run
```

Executes all pending migrations.

### 4. Revert Last Migration

```bash
yarn migration:revert
```

Reverts the last executed migration.

### 5. Show Migration Status

```bash
yarn migration:show
```

Shows which migrations have been run.

## Environment Configuration

### Development with Synchronize (Default)

```env
# .env
NODE_ENV=development
USE_MIGRATIONS=false
```

Uses `synchronize: true` for automatic schema updates.

### Development with Migrations

```env
# .env
NODE_ENV=development
USE_MIGRATIONS=true
```

Uses migrations instead of synchronize.

### Production (Always uses migrations)

```env
# .env
NODE_ENV=production
USE_MIGRATIONS=true
```

## Workflow Examples

### Scenario 1: Adding a new field to an entity

1. **Modify your entity:**

```typescript
// user.entity.ts
@Column({ nullable: true })
middleName: string;
```

2. **Generate migration:**

```bash
yarn migration:generate src/migrations/AddMiddleNameToUser
```

3. **Review the generated migration:**

```typescript
// src/migrations/xxxxx-AddMiddleNameToUser.ts
export class AddMiddleNameToUser1694268000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "middleName" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "middleName"`);
  }
}
```

4. **Run migration:**

```bash
yarn migration:run
```

### Scenario 2: Creating a custom migration

1. **Create empty migration:**

```bash
yarn migration:create src/migrations/AddIndexes
```

2. **Add custom SQL:**

```typescript
export class AddIndexes1694268000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_user_companyName" ON "user" ("companyName")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_exporter_averageRating" ON "exporter" ("averageRating")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_exporter_averageRating"`);
    await queryRunner.query(`DROP INDEX "IDX_user_companyName"`);
  }
}
```

3. **Run migration:**

```bash
yarn migration:run
```

## Best Practices

### 1. Always Review Generated Migrations

- Check the SQL before running
- Ensure data loss won't occur
- Test on a copy of production data

### 2. Naming Conventions

```bash
# Good names
yarn migration:generate src/migrations/AddEmailIndexToUser
yarn migration:generate src/migrations/CreateProductTable
yarn migration:generate src/migrations/UpdateUserStatusEnum

# Avoid generic names
yarn migration:generate src/migrations/Migration1
yarn migration:generate src/migrations/Update
```

### 3. Migration Safety

```typescript
// Good: Safe column addition
await queryRunner.query(`ALTER TABLE "user" ADD "newField" character varying`);

// Careful: Data migration
await queryRunner.query(
  `UPDATE "user" SET "status" = 'active' WHERE "status" IS NULL`,
);

// Dangerous: Column removal (backup first!)
await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "oldField"`);
```

### 4. Rollback Strategy

Always ensure your `down()` method properly reverses the `up()` method:

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "newField" character varying NOT NULL DEFAULT 'defaultValue'`);
}

public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "newField"`);
}
```

## Troubleshooting

### Migration Command Fails

If migration commands fail, ensure:

1. PostgreSQL is running
2. Database credentials are correct in `.env`
3. Database exists
4. No syntax errors in migration files

### Schema Sync Issues

If you get schema sync errors:

```bash
# Reset to clean state (WARNING: destructive)
yarn migration:revert  # Revert all migrations
yarn migration:run     # Re-run migrations
```

### Production Deployment

1. **Backup database first**
2. **Run migrations before deploying code:**

```bash
yarn migration:run
```

3. **Deploy application code**
4. **Verify application works**

## Migration Files

Your migration files are stored in:

```
src/migrations/
├── 1694268000000-InitialMigration.ts
├── 1694268000001-AddMiddleNameToUser.ts
└── 1694268000002-AddIndexes.ts
```

Each migration has a timestamp prefix to ensure proper ordering.

## Initial Setup

For new databases, run the initial migration:

```bash
yarn migration:run
```

This will create all your tables with the current schema.
