import { Controller, Post, Body } from '@nestjs/common';
import { CompilerService } from './compiler.service';
import { DynamicKycGroupResponse, GroupMeta } from '../types';

@Controller('compiler')
export class CompilerController {
  constructor(private readonly compilerService: CompilerService) {}

  @Post('compile')
  compile(
    @Body() payload: { nodes: any[]; edges: any[]; groupMeta: GroupMeta }
  ): DynamicKycGroupResponse {
    return this.compilerService.compile(payload);
  }

  @Post('validate')
  validate(@Body() payload: { nodes: any[]; edges: any[] }) {
    return this.compilerService.validate(payload);
  }
}

