import { DataSource, Repository } from 'typeorm';
import { QuestionGroupEntity } from '../entities';
import { ReusableQuestionGroup, GroupQuestionTemplate, GroupCategory } from '../../types';
import { NotFoundException } from '@nestjs/common';
import { SEED_GROUPS } from '../../storage/seeds';

export class PostgresGroupsRepository {
  private groupRepo: Repository<QuestionGroupEntity>;

  constructor(private dataSource: DataSource) {
    this.groupRepo = this.dataSource.getRepository(QuestionGroupEntity);
  }

  async findAll(): Promise<ReusableQuestionGroup[]> {
    const groups = await this.groupRepo.find({
      order: { createdAt: 'DESC' },
    });
    return groups.map((g) => this.mapToDto(g));
  }

  async findOne(id: string): Promise<ReusableQuestionGroup> {
    let group = await this.groupRepo.findOne({ where: { id } });
    if (!group) {
      const altId = id.startsWith('grp-') ? id.slice(4) : `grp-${id}`;
      group = await this.groupRepo.findOne({ where: { id: altId } });
    }
    if (!group) {
      const num = parseInt(id.replace(/\D+/g, ''), 10);
      if (!isNaN(num)) {
        group = await this.groupRepo.findOne({ where: { groupId: num } });
      }
    }
    if (!group) {
      throw new NotFoundException(`Question group with ID "${id}" not found in PostgreSQL`);
    }
    return this.mapToDto(group);
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
    const now = new Date().toISOString();
    const existing = await this.groupRepo.find();
    let maxGroupId = 0;
    for (const g of existing) {
      if (g.groupId && g.groupId > maxGroupId) maxGroupId = g.groupId;
      const match = g.id.match(/^grp-(\d+)$/) || g.id.match(/^(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num < 1000000 && num > maxGroupId) maxGroupId = num;
      }
    }
    const assignedGroupId = dto.groupId && dto.groupId > 0 ? dto.groupId : maxGroupId + 1;
    const id = `grp-${assignedGroupId}`;

    const entity = this.groupRepo.create({
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
    });

    const saved = await this.groupRepo.save(entity);
    return this.mapToDto(saved);
  }

  async update(id: string, dto: Partial<ReusableQuestionGroup>): Promise<ReusableQuestionGroup> {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Question group with ID "${id}" not found in PostgreSQL`);
    }

    if (dto.name !== undefined) group.name = dto.name;
    if (dto.nameBn !== undefined) group.nameBn = dto.nameBn;
    if (dto.description !== undefined) group.description = dto.description;
    if (dto.category !== undefined) group.category = dto.category;
    if (dto.color !== undefined) group.color = dto.color;
    if (dto.groupId !== undefined) group.groupId = dto.groupId;
    if (dto.questions !== undefined) group.questions = dto.questions;
    if (dto.flowNodes !== undefined) group.flowNodes = dto.flowNodes;
    if (dto.flowEdges !== undefined) group.flowEdges = dto.flowEdges;

    group.updatedAt = new Date().toISOString();

    const saved = await this.groupRepo.save(group);
    return this.mapToDto(saved);
  }

  async delete(id: string): Promise<{ success: boolean; id: string }> {
    const result = await this.groupRepo.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`Question group with ID "${id}" not found in PostgreSQL`);
    }
    return { success: true, id };
  }

  async reset(): Promise<ReusableQuestionGroup[]> {
    await this.groupRepo.clear();
    const seeded: ReusableQuestionGroup[] = [];

    for (const seed of SEED_GROUPS) {
      const entity = this.groupRepo.create({
        id: seed.id,
        groupId: seed.groupId,
        name: seed.name,
        nameBn: seed.nameBn,
        description: seed.description,
        category: seed.category,
        color: seed.color,
        createdAt: seed.createdAt,
        updatedAt: seed.updatedAt,
        questions: seed.questions,
      });
      const saved = await this.groupRepo.save(entity);
      seeded.push(this.mapToDto(saved));
    }

    return seeded;
  }

  private mapToDto(entity: QuestionGroupEntity): ReusableQuestionGroup {
    const toIso = (val: any) => (val instanceof Date ? val.toISOString() : String(val));
    return {
      id: entity.id,
      groupId: entity.groupId,
      name: entity.name,
      nameBn: entity.nameBn,
      description: entity.description,
      category: entity.category,
      color: entity.color,
      createdAt: toIso(entity.createdAt),
      updatedAt: toIso(entity.updatedAt),
      questions: entity.questions || [],
      flowNodes: entity.flowNodes,
      flowEdges: entity.flowEdges,
    };
  }
}
