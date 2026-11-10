import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { SurveysService, SubmitSurveyResponseDto, SurveyHeaderDto } from './surveys.service';
import { DynamicKycGroupResponse } from '../types';

@Controller()
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) { }

  @Get('surveys')
  async listSurveys(): Promise<SurveyHeaderDto[]> {
    return this.surveysService.listSurveys();
  }

  @Get('surveys/:id')
  async getSurveyHeader(@Param('id') id: string): Promise<SurveyHeaderDto> {
    return this.surveysService.getSurveyHeader(id);
  }

  @Get(['surveys/:id/groups/:groupNumber', 'projects/:id/groups/:groupNumber'])
  async getSurveyGroup(
    @Param('id') id: string,
    @Param('groupNumber', ParseIntPipe) groupNumber: number,
    @Query('respondentId') respondentId?: string,
    @Query('farmerId') farmerId?: string
  ): Promise<DynamicKycGroupResponse> {
    const activeRespondent = respondentId || farmerId;
    return this.surveysService.getSurveyGroup(id, groupNumber, activeRespondent);
  }

  @Post(['surveys/:id/responses', 'projects/:id/responses'])
  @UseInterceptors(AnyFilesInterceptor())
  async submitResponse(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files?: any[]
  ) {
    let parsedAnswers = body.answers || body.data;
    if (typeof parsedAnswers === 'string') {
      try {
        parsedAnswers = JSON.parse(parsedAnswers);
        if (parsedAnswers && parsedAnswers.kyc_data) {
          parsedAnswers = parsedAnswers.kyc_data;
        }
      } catch (ignored) { }
    }

    let lat = body.latitude !== undefined ? parseFloat(body.latitude) : undefined;
    let lng = body.longitude !== undefined ? parseFloat(body.longitude) : undefined;
    if (body.location) {
      try {
        const loc = typeof body.location === 'string' ? JSON.parse(body.location) : body.location;
        if (loc.lat !== undefined) lat = parseFloat(loc.lat);
        if (loc.lng !== undefined) lng = parseFloat(loc.lng);
      } catch (ignored) { }
    }

    const dto: SubmitSurveyResponseDto = {
      answers: parsedAnswers,
      respondentId: body.respondentId || body.farmerId,
      surveyorId: body.surveyorId,
      groupNumber: body.groupNumber ? parseInt(body.groupNumber, 10) : (body.group ? parseInt(body.group, 10) : 1),
      latitude: lat,
      longitude: lng,
      isGroupJumped: body.isGroupJumped === true || body.isGroupJumped === 'true' || body.is_group_jumped === 'true',
      metadata: typeof body.metadata === 'string' ? JSON.parse(body.metadata || '{}') : body.metadata,
    };

    return this.surveysService.submitResponse(id, dto, files);
  }

  @Get(['surveys/:id/responses', 'projects/:id/responses'])
  async getResponses(
    @Param('id') id: string,
    @Query('respondentId') respondentId?: string,
    @Query('surveyorId') surveyorId?: string
  ) {
    return this.surveysService.getResponses(id, respondentId, surveyorId);
  }

  @Get(['surveys/:id/responses/:responseId', 'projects/:id/responses/:responseId'])
  async getResponseById(@Param('responseId') responseId: string) {
    return this.surveysService.getResponseById(responseId);
  }

  @Get(['surveys/:id/respondents/:respondentId/summary', 'projects/:id/respondents/:respondentId/summary'])
  async getRespondentSummary(
    @Param('id') id: string,
    @Param('respondentId') respondentId: string
  ) {
    return this.surveysService.getRespondentSummary(id, respondentId);
  }
}