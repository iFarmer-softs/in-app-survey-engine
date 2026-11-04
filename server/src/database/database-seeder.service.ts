import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity, VersionEntity, QuestionGroupEntity } from './entities';
import { SEED_PROJECTS, SEED_GROUPS } from '../storage/seeds';

@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeederService.name);

  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(VersionEntity)
    private readonly versionRepo: Repository<VersionEntity>,
    @InjectRepository(QuestionGroupEntity)
    private readonly groupRepo: Repository<QuestionGroupEntity>,
  ) {}

  async onModuleInit() {
    try {
      await this.seedQuestionGroups();
      await this.seedProjects();
    } catch (err) {
      this.logger.warn(`Could not complete initial PostgreSQL database seeding: ${err}`);
    }
  }

  private async seedProjects() {
    const count = await this.projectRepo.count();
    if (count > 0) {
      this.logger.log(`PostgreSQL already contains ${count} survey project(s).`);
      return;
    }

    this.logger.log('Seeding initial survey projects into PostgreSQL...');
    for (const seed of SEED_PROJECTS) {
      const project = this.projectRepo.create({
        id: seed.id,
        title: seed.title,
        titleBn: seed.titleBn,
        description: seed.description,
        status: seed.status,
        currentVersion: seed.currentVersion,
        publishedVersionId: seed.publishedVersionId,
        createdAt: seed.createdAt,
        updatedAt: seed.updatedAt,
        groupMeta: seed.groupMeta,
        nodes: seed.nodes,
        edges: seed.edges,
      });

      await this.projectRepo.save(project);

      if (seed.versions && seed.versions.length > 0) {
        for (const ver of seed.versions) {
          const version = this.versionRepo.create({
            id: ver.id,
            projectId: seed.id,
            version: ver.version,
            title: ver.title,
            description: ver.description,
            status: ver.status,
            createdAt: ver.createdAt,
            createdBy: ver.createdBy,
            nodeCount: ver.nodeCount,
            edgeCount: ver.edgeCount,
            questionCount: ver.questionCount,
            groupCount: ver.groupCount,
            groupMeta: ver.groupMeta,
            nodes: ver.nodes,
            edges: ver.edges,
          });
          await this.versionRepo.save(version);
        }
      }
    }
    this.logger.log('✅ Initial survey projects successfully seeded into PostgreSQL.');
  }

  private async seedQuestionGroups() {
    const count = await this.groupRepo.count();
    if (count > 0) {
      this.logger.log(`PostgreSQL already contains ${count} reusable question group(s).`);
      return;
    }

    this.logger.log('Seeding default reusable question groups into PostgreSQL...');
    for (const seed of SEED_GROUPS) {
      const group = this.groupRepo.create({
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
      await this.groupRepo.save(group);
    }
    this.logger.log('✅ Initial question groups successfully seeded into PostgreSQL.');
  }
}

