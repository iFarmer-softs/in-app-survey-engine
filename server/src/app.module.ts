import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { StorageService } from './storage/storage.service';
import { DatabaseModule } from './database/database.module';
import { ProjectsModule } from './projects/projects.module';
import { GroupsModule } from './groups/groups.module';
import { CompilerModule } from './compiler/compiler.module';

@Module({
  imports: [DatabaseModule, ProjectsModule, GroupsModule, CompilerModule],
  controllers: [AppController],
  providers: [StorageService],
})
export class AppModule {}
