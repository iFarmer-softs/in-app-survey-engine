import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'in-app-survey-engine-nest-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: this.databaseService.getStatusInfo(),
    };
  }
}
