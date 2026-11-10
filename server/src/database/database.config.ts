import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ProjectEntity, VersionEntity, QuestionGroupEntity, SurveyResponseEntity } from './entities';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export function getDatabaseConfig(): TypeOrmModuleOptions {
  const databaseUrl = process.env.DATABASE_URL;

  // Detect whether SSL is required (cloud hosts like Neon, Supabase, Render, or DB_SSL=true)
  const isCloudHost =
    databaseUrl &&
    (!databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1'));
  const requiresSsl =
    process.env.DB_SSL === 'true' ||
    Boolean(databaseUrl?.includes('sslmode=require')) ||
    Boolean(isCloudHost);

  const baseConfig: Partial<TypeOrmModuleOptions> = {
    type: 'postgres',
    entities: [ProjectEntity, VersionEntity, QuestionGroupEntity, SurveyResponseEntity],
    synchronize: process.env.DB_SYNCHRONIZE !== 'false', // Auto create / sync schema
    logging: process.env.DB_LOGGING === 'true',
    ssl: requiresSsl ? { rejectUnauthorized: false } : false,
    extra: requiresSsl
      ? {
        ssl: {
          rejectUnauthorized: false,
        },
      }
      : undefined,
  };

  if (databaseUrl) {
    return {
      ...baseConfig,
      url: databaseUrl,
    } as TypeOrmModuleOptions;
  }

  return {
    ...baseConfig,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgrespassword',
    database: process.env.DB_NAME || 'survey_engine',
  } as TypeOrmModuleOptions;
}
