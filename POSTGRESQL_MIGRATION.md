# PostgreSQL Migration Guide

This application has been migrated from MySQL to PostgreSQL. Follow these steps to set up your development environment.

## Prerequisites

1. Install PostgreSQL on your system:

   - **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
   - **macOS**: `brew install postgresql`
   - **Ubuntu/Debian**: `sudo apt-get install postgresql postgresql-contrib`

2. Start PostgreSQL service:
   - **Windows**: Usually starts automatically
   - **macOS**: `brew services start postgresql`
   - **Ubuntu/Debian**: `sudo systemctl start postgresql`

## Database Setup

1. Connect to PostgreSQL as superuser:

   ```bash
   sudo -u postgres psql
   ```

2. Create the database and user:
   ```sql
   CREATE DATABASE bevars_db;
   CREATE USER bevars_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE bevars_db TO bevars_user;
   \q
   ```

## Environment Configuration

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your PostgreSQL credentials:
   ```env
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_USER=bevars_user
   DATABASE_PASSWORD=your_secure_password
   DATABASE_NAME=bevars_db
   ```

## Development vs Production

### Development

The application will use the individual database variables and synchronize the schema automatically.

### Production

Use the `DATABASE_URL` environment variable instead:

```env
DATABASE_URL=postgresql://username:password@host:port/database
```

## Key Changes from MySQL

1. **Driver**: Changed from `mysql2` to `pg`
2. **Port**: Default port changed from 3306 to 5432
3. **Array Operations**: Now using PostgreSQL-native array operators (`&&`, `ANY()`)
4. **Case-Insensitive Search**: Using `ILIKE` instead of `LIKE`
5. **Data Types**: All existing types are compatible with PostgreSQL

## Verification

Run the application:

```bash
yarn start:dev
```

The application should start successfully and create all necessary tables automatically.
