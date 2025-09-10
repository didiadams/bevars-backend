@echo off
REM Migration Helper Script for Windows
REM Usage: migrate.bat [command] [migration-name]

if "%1"=="generate" (
    if "%2"=="" (
        echo Usage: migrate.bat generate MigrationName
        exit /b 1
    )
    echo Generating migration: %2
    yarn migration:generate "src/migrations/%2"
) else if "%1"=="create" (
    if "%2"=="" (
        echo Usage: migrate.bat create MigrationName
        exit /b 1
    )
    echo Creating empty migration: %2
    yarn migration:create "src/migrations/%2"
) else if "%1"=="run" (
    echo Running pending migrations...
    yarn migration:run
) else if "%1"=="revert" (
    echo Reverting last migration...
    yarn migration:revert
) else if "%1"=="status" (
    echo Showing migration status...
    yarn migration:show
) else (
    echo Migration Helper Script
    echo.
    echo Usage:
    echo   migrate.bat generate MigrationName  - Generate migration from entity changes
    echo   migrate.bat create MigrationName    - Create empty migration
    echo   migrate.bat run                     - Run pending migrations
    echo   migrate.bat revert                  - Revert last migration
    echo   migrate.bat status                  - Show migration status
    echo.
    echo Examples:
    echo   migrate.bat generate AddEmailToUser
    echo   migrate.bat create AddIndexes
    echo   migrate.bat run
)
