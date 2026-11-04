import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [GroupsController],
  providers: [GroupsService, StorageService],
  exports: [GroupsService],
})
export class GroupsModule {}

