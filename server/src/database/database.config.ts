import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ProjectEntity, VersionEntity, QuestionGroupEntity } from './entities';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export function getDatabaseConfig(): TypeOrmModuleOptions {
  const databaseUrl = process.env.DATABASE_URL;

  const baseConfig: Partial<TypeOrmModuleOptions> = {
    type: 'postgres',
    entities: [ProjectEntity, VersionEntity, QuestionGroupEntity],
    synchronize: process.env.DB_SYNCHRONIZE !== 'false', // Auto create / sync schema in dev
    logging: process.env.DB_LOGGING === 'true',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
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

