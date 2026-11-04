import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, StorageService],
  exports: [ProjectsService],
})
export class ProjectsModule {}

