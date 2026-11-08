import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from './database.config';
import { PostgresProjectsRepository } from './repositories/postgres-projects.repository';
import { PostgresGroupsRepository } from './repositories/postgres-groups.repository';
import { ProjectEntity, VersionEntity, QuestionGroupEntity } from './entities';
import { SEED_PROJECTS, SEED_GROUPS } from '../storage/seeds';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private dataSource: DataSource | null = null;
  private isConnected = false;
  private projectsRepository: PostgresProjectsRepository | null = null;
  private groupsRepository: PostgresGroupsRepository | null = null;

  async onModuleInit() {
    await this.initDatabase();
  }

  async onModuleDestroy() {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }

  async initDatabase() {
    const config = getDatabaseConfig() as any;

    try {
      this.logger.log(`Attempting PostgreSQL connection to: ${config.host || 'remote'}:${config.port || '5432'}/${config.database || ''}...`);
      
      const ds = new DataSource({
        ...config,
        connectTimeoutMS: 10000,
      });

      await ds.initialize();
      this.dataSource = ds;
      this.isConnected = true;

      this.projectsRepository = new PostgresProjectsRepository(this.dataSource);
      this.groupsRepository = new PostgresGroupsRepository(this.dataSource);

      this.logger.log('🚀 Successfully connected to PostgreSQL database!');

      // Seed if tables are empty
      await this.seedIfEmpty();
    } catch (err: any) {
      this.isConnected = false;
      this.dataSource = null;
      this.projectsRepository = null;
      this.groupsRepository = null;

      this.logger.warn(`⚠️ PostgreSQL connection attempt failed (${err?.message || err}).`);
      this.logger.warn(`💡 Operating in local storage mode. To use PostgreSQL:`);
      this.logger.warn(`   1. Run 'docker compose up -d' in the project root, or`);
      this.logger.warn(`   2. Set your DATABASE_URL in server/.env`);
    }
  }

  private async seedIfEmpty() {
    if (!this.dataSource || !this.isConnected) return;

    try {
      const projectRepo = this.dataSource.getRepository(ProjectEntity);
      const versionRepo = this.dataSource.getRepository(VersionEntity);
      const groupRepo = this.dataSource.getRepository(QuestionGroupEntity);

      // Seed groups if empty
      const groupCount = await groupRepo.count();
      if (groupCount === 0) {
        this.logger.log('Seeding default question groups into PostgreSQL...');
        for (const seed of SEED_GROUPS) {
          const entity = groupRepo.create({
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
          await groupRepo.save(entity);
        }
        this.logger.log('✅ Default question groups seeded into PostgreSQL.');
      }

      // Seed projects if empty
      const projectCount = await projectRepo.count();
      if (projectCount === 0) {
        this.logger.log('Seeding initial survey projects into PostgreSQL...');
        for (const seed of SEED_PROJECTS) {
          const project = projectRepo.create({
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
          await projectRepo.save(project);

          if (seed.versions) {
            for (const v of seed.versions) {
              const version = versionRepo.create({
                id: v.id,
                projectId: seed.id,
                version: v.version,
                title: v.title,
                description: v.description,
                status: v.status,
                createdAt: v.createdAt,
                createdBy: v.createdBy,
                nodeCount: v.nodeCount,
                edgeCount: v.edgeCount,
                questionCount: v.questionCount,
                groupCount: v.groupCount,
                groupMeta: v.groupMeta,
                nodes: v.nodes,
                edges: v.edges,
              });
              await versionRepo.save(version);
            }
          }
        }
        this.logger.log('✅ Initial survey projects seeded into PostgreSQL.');
      }
    } catch (err: any) {
      this.logger.warn(`PostgreSQL seeder notice: ${err?.message || err}`);
    }
  }

  isPostgresConnected(): boolean {
    return this.isConnected && !!this.dataSource?.isInitialized;
  }

  getProjectsRepo(): PostgresProjectsRepository | null {
    return this.projectsRepository;
  }

  getGroupsRepo(): PostgresGroupsRepository | null {
    return this.groupsRepository;
  }

  getStatusInfo() {
    const config = getDatabaseConfig() as any;
    return {
      connected: this.isPostgresConnected(),
      type: this.isPostgresConnected() ? 'postgresql' : 'file-fallback',
      database: config.database || 'survey_engine',
      host: config.host || 'localhost',
      port: config.port || 5432,
    };
  }
}

