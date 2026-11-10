import { Module } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';
import { ProjectsModule } from '../projects/projects.module';
import { CompilerModule } from '../compiler/compiler.module';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [ProjectsModule, CompilerModule],
  providers: [SurveysService, StorageService],
  controllers: [SurveysController],
  exports: [SurveysService],
})
export class SurveysModule { }