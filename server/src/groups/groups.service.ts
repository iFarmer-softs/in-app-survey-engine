import { Injectable, NotFoundException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { DatabaseService } from '../database/database.service';
import { ReusableQuestionGroup, GroupQuestionTemplate, GroupCategory } from '../types';

@Injectable()
export class GroupsService {
  constructor(
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService
  ) {}

  async findAll(): Promise<ReusableQuestionGroup[]> {
    const pgRepo = this.databaseService.getGroupsRepo();
    if (pgRepo) {
      return pgRepo.findAll();
    }
    return this.storageService.getAllGroups();
  }

  async findOne(id: string): Promise<ReusableQuestionGroup> {
    const pgRepo = this.databaseService.getGroupsRepo();
    if (pgRepo) {
      return pgRepo.findOne(id);
    }
    const group = this.storageService.getGroupById(id);
    if (!group) {
      throw new NotFoundException(`Question group with ID "${id}" not found`);
    }
    return group;
  }

  async create(dto: {
    name: string;
    nameBn?: string;
    description?: string;
    category?: GroupCategory;
    color?: string;
    groupId?: number;
    questions?: GroupQuestionTemplate[];
    flowNodes?: any[];
    flowEdges?: any[];
  }): Promise<ReusableQuestionGroup> {
    const pgRepo = this.databaseService.getGroupsRepo();
    if (pgRepo) {
      return pgRepo.create(dto);
    }

    const now = new Date().toISOString();
    const id = `grp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newGroup: ReusableQuestionGroup = {
      id,
      groupId: dto.groupId,
      name: dto.name,
      nameBn: dto.nameBn || dto.name,
      description: dto.description || '',
      category: dto.category || 'custom',
      color: dto.color || '#0284c7',
      createdAt: now,
      updatedAt: now,
      questions: dto.questions || [],
      flowNodes: dto.flowNodes,
      flowEdges: dto.flowEdges,
    };

    const current = this.storageService.getAllGroups();
    const updated = [newGroup, ...current];
    this.storageService.saveGroups(updated);
    return newGroup;
  }

  async update(id: string, dto: Partial<ReusableQuestionGroup>): Promise<ReusableQuestionGroup> {
    const pgRepo = this.databaseService.getGroupsRepo();
    if (pgRepo) {
      return pgRepo.update(id, dto);
    }

    const groups = this.storageService.getAllGroups();
    const index = groups.findIndex((g) => g.id === id);
    if (index === -1) {
      throw new NotFoundException(`Question group with ID "${id}" not found`);
    }

    const current = groups[index];
    const updated: ReusableQuestionGroup = {
      ...current,
      ...dto,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };

    groups[index] = updated;
    this.storageService.saveGroups(groups);
    return updated;
  }

  async delete(id: string): Promise<{ success: boolean; id: string }> {
    const pgRepo = this.databaseService.getGroupsRepo();
    if (pgRepo) {
      return pgRepo.delete(id);
    }

    const groups = this.storageService.getAllGroups();
    const filtered = groups.filter((g) => g.id !== id);
    if (filtered.length === groups.length) {
      throw new NotFoundException(`Question group with ID "${id}" not found`);
    }

    this.storageService.saveGroups(filtered);
    return { success: true, id };
  }

  async reset(): Promise<ReusableQuestionGroup[]> {
    const pgRepo = this.databaseService.getGroupsRepo();
    if (pgRepo) {
      return pgRepo.reset();
    }
    return this.storageService.resetGroups();
  }
}
