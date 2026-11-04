import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { FlowchartProject, FlowchartVersion } from '../types';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll(): Promise<FlowchartProject[]> {
    return this.projectsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<FlowchartProject> {
    return this.projectsService.findOne(id);
  }

  @Post()
  async create(
    @Body()
    dto: {
      title: string;
      titleBn?: string;
      description?: string;
      totalGroups?: number;
      nodes?: any[];
      edges?: any[];
      groupMeta?: any;
    }
  ): Promise<FlowchartProject> {
    return this.projectsService.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<FlowchartProject>
  ): Promise<FlowchartProject> {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string): Promise<{ success: boolean; id: string }> {
    return this.projectsService.delete(id);
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string): Promise<FlowchartProject> {
    return this.projectsService.duplicate(id);
  }

  @Post(':id/versions')
  async createVersion(
    @Param('id') id: string,
    @Body()
    dto: {
      version: string;
      title: string;
      description?: string;
      isPublished?: boolean;
      createdBy?: string;
      nodes?: any[];
      edges?: any[];
      groupMeta?: any;
    }
  ): Promise<{ updatedProject: FlowchartProject; newVersion: FlowchartVersion }> {
    return this.projectsService.createVersion(id, dto);
  }

  @Post(':id/versions/:versionId/restore')
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string
  ): Promise<FlowchartProject> {
    return this.projectsService.restoreVersion(id, versionId);
  }
}
