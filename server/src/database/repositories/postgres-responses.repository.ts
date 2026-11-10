import { DataSource, Repository } from 'typeorm';
import { SurveyResponseEntity } from '../entities';
import { NotFoundException } from '@nestjs/common';

export interface SurveyResponseDto {
  id: string;
  surveyId: string;
  versionId?: string;
  respondentId?: string;
  surveyorId?: string;
  groupNumber: number;
  answers: any;
  mediaUrls: string[];
  latitude?: number;
  longitude?: number;
  isGroupJumped: boolean;
  metadata: any;
  createdAt: string;
}

export class PostgresResponsesRepository {
  private repo: Repository<SurveyResponseEntity>;

  constructor(private dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(SurveyResponseEntity);
  }

  async findBySurveyId(surveyId: string, respondentId?: string, surveyorId?: string): Promise<SurveyResponseDto[]> {
    const where: any = { surveyId };
    if (respondentId) where.respondentId = respondentId;
    if (surveyorId) where.surveyorId = surveyorId;

    const list = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return list.map((e) => this.mapToDto(e));
  }

  async findOne(id: string): Promise<SurveyResponseDto> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) {
      throw new NotFoundException(`Survey response with ID "${id}" not found`);
    }
    return this.mapToDto(found);
  }

  async create(data: Partial<SurveyResponseDto>): Promise<SurveyResponseDto> {
    const entity = this.repo.create({
      id: data.id || `resp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      surveyId: data.surveyId!,
      versionId: data.versionId,
      respondentId: data.respondentId || 'anonymous',
      surveyorId: data.surveyorId || 'field-agent',
      groupNumber: data.groupNumber || 1,
      answers: data.answers || {},
      mediaUrls: data.mediaUrls || [],
      latitude: data.latitude,
      longitude: data.longitude,
      isGroupJumped: Boolean(data.isGroupJumped),
      metadata: data.metadata || {},
    });

    const saved = await this.repo.save(entity);
    return this.mapToDto(saved);
  }

  async findByRespondent(surveyId: string, respondentId: string): Promise<SurveyResponseDto[]> {
    const list = await this.repo.find({
      where: { surveyId, respondentId },
      order: { groupNumber: 'ASC', createdAt: 'ASC' },
    });
    return list.map((e) => this.mapToDto(e));
  }

  private mapToDto(e: SurveyResponseEntity): SurveyResponseDto {
    return {
      id: e.id,
      surveyId: e.surveyId,
      versionId: e.versionId,
      respondentId: e.respondentId,
      surveyorId: e.surveyorId,
      groupNumber: e.groupNumber,
      answers: e.answers,
      mediaUrls: e.mediaUrls || [],
      latitude: e.latitude,
      longitude: e.longitude,
      isGroupJumped: e.isGroupJumped,
      metadata: e.metadata,
      createdAt: e.createdAt,
    };
  }
}

