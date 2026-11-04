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
import { GroupsService } from './groups.service';
import { ReusableQuestionGroup } from '../types';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  async findAll(): Promise<ReusableQuestionGroup[]> {
    return this.groupsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ReusableQuestionGroup> {
    return this.groupsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: any): Promise<ReusableQuestionGroup> {
    return this.groupsService.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<ReusableQuestionGroup>
  ): Promise<ReusableQuestionGroup> {
    return this.groupsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string): Promise<{ success: boolean; id: string }> {
    return this.groupsService.delete(id);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async reset(): Promise<ReusableQuestionGroup[]> {
    return this.groupsService.reset();
  }
}
