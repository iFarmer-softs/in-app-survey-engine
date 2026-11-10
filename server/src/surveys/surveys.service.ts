import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { CompilerService } from '../compiler/compiler.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { DynamicKycGroupResponse } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface SurveyHeaderDto {
  id: string;
  title: string;
  titleBn?: string;
  description: string;
  status: string;
  currentVersion: string;
  publishedVersionId?: string;
  totalGroups: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitSurveyResponseDto {
  answers?: any;
  data?: any;
  respondentId?: string;
  farmerId?: string;
  surveyorId?: string;
  groupNumber?: number;
  latitude?: number;
  longitude?: number;
  isGroupJumped?: boolean;
  metadata?: any;
}

@Injectable()
export class SurveysService {
  private readonly uploadDir = path.resolve(process.cwd(), 'uploads');

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly compilerService: CompilerService,
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async listSurveys(): Promise<SurveyHeaderDto[]> {
    const projects = await this.projectsService.findAll();
    return projects.map((p) => this.mapToHeader(p));
  }

  async getSurveyHeader(surveyId: string): Promise<SurveyHeaderDto> {
    const project = await this.projectsService.findOne(surveyId);
    return this.mapToHeader(project);
  }

  async getSurveyGroup(
    surveyId: string,
    groupNumber: number,
    respondentId?: string
  ): Promise<DynamicKycGroupResponse> {
    const project = await this.projectsService.findOne(surveyId);

    // Determine nodes and edges (use published version if set, else current canvas)
    let nodes = project.nodes || [];
    let edges = project.edges || [];
    let groupMeta = project.groupMeta || ({} as any);

    if (project.publishedVersionId && project.versions) {
      const pub = project.versions.find((v) => v.id === project.publishedVersionId);
      if (pub) {
        nodes = pub.nodes || [];
        edges = pub.edges || [];
        groupMeta = pub.groupMeta || groupMeta;
      }
    }

    const metaOverride = {
      ...groupMeta,
      groupNumber: groupNumber > 0 ? groupNumber : 1,
    };

    // Compile flowchart DAG
    const compiled = this.compilerService.compile({
      nodes,
      edges,
      groupMeta: metaOverride,
    });

    // Fetch existing answers if respondentId is given
    const previousAnswers: Record<string, string> = {};
    if (respondentId && respondentId.trim() !== '') {
      const prevResponses = await this.getResponses(surveyId, respondentId);
      for (const resp of prevResponses) {
        this.extractAnswers(resp.answers, previousAnswers);
      }
    }

    // Filter questions to requested group
    const targetGroup = groupNumber > 0 ? groupNumber : 1;
    const filteredQuestions: any[] = [];

    if (Array.isArray(compiled.data)) {
      for (const q of compiled.data) {
        const qGroup = typeof q.group === 'number' ? q.group : 1;
        if (compiled.total_groups <= 1 || qGroup === targetGroup) {
          const qCopy = { ...q };
          const qIdStr = String(qCopy.question_id);
          if (previousAnswers[qIdStr] !== undefined) {
            qCopy.value = previousAnswers[qIdStr];
          }
          filteredQuestions.push(qCopy);
        }
      }
    }

    const totalGroups = compiled.total_groups || 1;
    const hasSubsequentJump =
      compiled.groups_to_jump &&
      compiled.groups_to_jump.some((j: any) => {
        const gId = parseInt(String(j.group_id), 10);
        return !isNaN(gId) && gId > targetGroup;
      });
    const hasNext = targetGroup < totalGroups || Boolean(hasSubsequentJump);

    const normalizedJumps = compiled.groups_to_jump
      ? compiled.groups_to_jump.map((j: any) => ({
          ...j,
          group_id: String(j.group_id ?? j.target_group_id ?? ''),
          target_group_id: String(j.target_group_id ?? j.group_id ?? ''),
        }))
      : undefined;

    return {
      ...compiled,
      total_groups: totalGroups,
      current_group: targetGroup,
      next: Boolean(hasNext),
      data: filteredQuestions,
      groups_to_jump: normalizedJumps,
    };
  }

  async submitResponse(
    surveyId: string,
    dto: SubmitSurveyResponseDto,
    files?: any[]
  ) {
    const project = await this.projectsService.findOne(surveyId);

    const mediaUrls: string[] = [];
    if (files && files.length > 0) {
      const surveyUploadPath = path.join(this.uploadDir, 'surveys', surveyId);
      if (!fs.existsSync(surveyUploadPath)) {
        fs.mkdirSync(surveyUploadPath, { recursive: true });
      }

      for (const file of files) {
        if (!file) continue;
        const ext = path.extname(file.originalname || '') || '.jpg';
        const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        const filePath = path.join(surveyUploadPath, filename);
        fs.writeFileSync(filePath, file.buffer);
        mediaUrls.push(`/uploads/surveys/${surveyId}/${filename}`);
      }
    }

    const respondentId = dto.respondentId || dto.farmerId || 'anonymous';
    const answers = dto.answers || dto.data || {};
    const groupNumber = dto.groupNumber || 1;
    const now = new Date().toISOString();
    const responseId = `resp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const responseRecord = {
      id: responseId,
      surveyId,
      versionId: project.publishedVersionId || project.currentVersion,
      respondentId,
      surveyorId: dto.surveyorId || 'field-agent',
      groupNumber,
      answers,
      mediaUrls,
      latitude: dto.latitude,
      longitude: dto.longitude,
      isGroupJumped: Boolean(dto.isGroupJumped),
      metadata: dto.metadata || {},
      createdAt: now,
    };

    if (this.databaseService.isPostgresConnected()) {
      const repo = this.databaseService.getResponsesRepo();
      if (repo) {
        return repo.create(responseRecord);
      }
    }

    // Storage fallback
    return this.storageService.saveResponse(responseRecord);
  }

  async getResponses(surveyId: string, respondentId?: string, surveyorId?: string) {
    if (this.databaseService.isPostgresConnected()) {
      const repo = this.databaseService.getResponsesRepo();
      if (repo) {
        return repo.findBySurveyId(surveyId, respondentId, surveyorId);
      }
    }

    // Storage fallback
    let list = this.storageService.getAllResponses().filter((r) => r.surveyId === surveyId);
    if (respondentId) list = list.filter((r) => r.respondentId === respondentId);
    if (surveyorId) list = list.filter((r) => r.surveyorId === surveyorId);
    return list;
  }

  async getResponseById(responseId: string) {
    if (this.databaseService.isPostgresConnected()) {
      const repo = this.databaseService.getResponsesRepo();
      if (repo) {
        return repo.findOne(responseId);
      }
    }

    const found = this.storageService.getAllResponses().find((r) => r.id === responseId);
    if (!found) {
      throw new NotFoundException(`Survey response with ID "${responseId}" not found`);
    }
    return found;
  }

  async getRespondentSummary(surveyId: string, respondentId: string) {
    const project = await this.projectsService.findOne(surveyId);
    const responses = await this.getResponses(surveyId, respondentId);

    // Sort chronologically by group number and creation time
    const sortedResponses = [...responses].sort((a, b) => {
      const gDiff = (a.groupNumber || 1) - (b.groupNumber || 1);
      if (gDiff !== 0) return gDiff;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

    const aggregatedAnswers: Record<string, string> = {};
    const allMediaUrls: string[] = [];
    const lastLocation: { lat?: number; lng?: number } = {};

    for (const resp of sortedResponses) {
      this.extractAnswers(resp.answers, aggregatedAnswers);
      if (Array.isArray(resp.mediaUrls)) {
        allMediaUrls.push(...resp.mediaUrls);
      }
      if (resp.latitude !== undefined && resp.longitude !== undefined) {
        lastLocation.lat = resp.latitude;
        lastLocation.lng = resp.longitude;
      }
    }

    return {
      surveyId,
      surveyTitle: project.title,
      surveyTitleBn: project.titleBn,
      respondentId,
      completedGroupsCount: responses.length,
      totalSurveyGroups: project.groupMeta?.totalGroups || 1,
      answers: aggregatedAnswers,
      mediaUrls: allMediaUrls,
      lastLocation,
      submissionHistory: responses,
    };
  }

  private extractAnswers(answersPayload: any, target: Record<string, string>) {
    if (!answersPayload) return;
    if (typeof answersPayload === 'object' && !Array.isArray(answersPayload)) {
      for (const [k, v] of Object.entries(answersPayload)) {
        target[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
    } else if (Array.isArray(answersPayload)) {
      for (const item of answersPayload) {
        if (item && item.questionId !== undefined && item.answer !== undefined) {
          target[String(item.questionId)] = String(item.answer);
        } else if (item && item.question_id !== undefined && item.answer !== undefined) {
          target[String(item.question_id)] = String(item.answer);
        }
      }
    }
  }

  private mapToHeader(p: any): SurveyHeaderDto {
    return {
      id: p.id,
      title: p.title,
      titleBn: p.titleBn,
      description: p.description || '',
      status: p.status || 'draft',
      currentVersion: p.currentVersion || '0.1.0',
      publishedVersionId: p.publishedVersionId,
      totalGroups: p.groupMeta?.totalGroups || 1,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
