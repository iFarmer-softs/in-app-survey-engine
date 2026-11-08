import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from both server/ directory and root directory if present
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NestApplication');
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend Vite client (port 5173 / any local origin)
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Prefix all routes with /api
  app.setGlobalPrefix('api');

  // Auto-validate payloads
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
    })
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 NestJS Backend Server running on http://localhost:${port}/api`);
  logger.log(`👉 Health check: http://localhost:${port}/api/health`);
  logger.log(`👉 Projects API: http://localhost:${port}/api/projects`);
  logger.log(`👉 Reusable Groups API: http://localhost:${port}/api/groups`);
  logger.log(`👉 Flow Compiler API: http://localhost:${port}/api/compiler/compile`);
}

bootstrap();

