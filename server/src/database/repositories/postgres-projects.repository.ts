import { DataSource, Repository } from 'typeorm';
import { ProjectEntity, VersionEntity } from '../entities';
import { FlowchartProject, FlowchartVersion } from '../../types';
import { NotFoundException, BadRequestException } from '@nestjs/common';

export class PostgresProjectsRepository {
  private projectRepo: Repository<ProjectEntity>;
  private versionRepo: Repository<VersionEntity>;

  constructor(private dataSource: DataSource) {
    this.projectRepo = this.dataSource.getRepository(ProjectEntity);
    this.versionRepo = this.dataSource.getRepository(VersionEntity);
  }

  async findAll(): Promise<FlowchartProject[]> {
    const projects = await this.projectRepo.find({
      order: { updatedAt: 'DESC' },
      relations: ['versions'],
    });

    return projects.map((p) => this.mapToDto(p));
  }

  async findOne(id: string): Promise<FlowchartProject> {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['versions'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found in PostgreSQL`);
    }

    return this.mapToDto(project);
  }

  async create(dto: {
    title: string;
    titleBn?: string;
    description?: string;
    totalGroups?: number;
    nodes?: any[];
    edges?: any[];
    groupMeta?: any;
  }): Promise<FlowchartProject> {
    const now = new Date().toISOString();
    const id = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const totalGroups = dto.totalGroups || 1;

    const initialNodes = dto.nodes || [
      {
        id: 'start-node',
        type: 'start',
        position: { x: 300, y: 100 },
        data: { label: 'Start Survey', labelBn: 'জরিপ শুরু' },
      },
      {
        id: 'end-node',
        type: 'end',
        position: { x: 300, y: 350 },
        data: { label: 'Submit Survey', labelBn: 'জরিপ জমা' },
      },
    ];

    const initialMeta = dto.groupMeta || {
      groupNumber: 1,
      totalGroups,
      hasNextGroup: totalGroups > 1,
      instruction: 'Complete the questions in this survey section.',
      groupJumps: [],
    };

    const initialVersionId = `ver-init-${id}`;
    const initialVersion = this.versionRepo.create({
      id: initialVersionId,
      projectId: id,
      version: '0.1.0',
      title: 'Initial Draft Baseline',
      description: dto.description || 'Base project setup.',
      status: 'draft',
      createdAt: now,
      createdBy: 'System / Author',
      nodeCount: initialNodes.length,
      edgeCount: dto.edges?.length || 0,
      questionCount: initialNodes.filter((n: any) => n.type === 'question').length,
      groupCount: totalGroups,
      nodes: initialNodes,
      edges: dto.edges || [],
      groupMeta: initialMeta,
    });

    const project = this.projectRepo.create({
      id,
      title: dto.title || 'Untitled Survey Workflow',
      titleBn: dto.titleBn || '',
      description: dto.description || '',
      status: 'draft',
      currentVersion: '0.1.0',
      createdAt: now,
      updatedAt: now,
      groupMeta: initialMeta,
      nodes: initialNodes,
      edges: dto.edges || [],
      versions: [initialVersion],
    });

    await this.projectRepo.save(project);
    await this.versionRepo.save(initialVersion);

    return this.mapToDto(project);
  }

  async update(id: string, dto: Partial<FlowchartProject>): Promise<FlowchartProject> {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['versions'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found in PostgreSQL`);
    }

    if (dto.title !== undefined) project.title = dto.title;
    if (dto.titleBn !== undefined) project.titleBn = dto.titleBn;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.status !== undefined) project.status = dto.status;
    if (dto.currentVersion !== undefined) project.currentVersion = dto.currentVersion;
    if (dto.publishedVersionId !== undefined) project.publishedVersionId = dto.publishedVersionId;
    if (dto.nodes !== undefined) project.nodes = dto.nodes;
    if (dto.edges !== undefined) project.edges = dto.edges;
    if (dto.groupMeta !== undefined) project.groupMeta = dto.groupMeta;

    project.updatedAt = new Date().toISOString();

    const saved = await this.projectRepo.save(project);
    return this.mapToDto(saved);
  }

  async delete(id: string): Promise<{ success: boolean; id: string }> {
    const count = await this.projectRepo.count();
    if (count <= 1) {
      throw new BadRequestException('Cannot delete the last remaining project in PostgreSQL.');
    }

    const deleteResult = await this.projectRepo.delete({ id });
    if (!deleteResult.affected) {
      throw new NotFoundException(`Project with ID "${id}" not found in PostgreSQL`);
    }

    return { success: true, id };
  }

  async duplicate(id: string): Promise<FlowchartProject> {
    const source = await this.findOne(id);
    const now = new Date().toISOString();
    const newId = `proj-copy-${Date.now()}`;

    const newVersion = this.versionRepo.create({
      id: `ver-init-${newId}`,
      projectId: newId,
      version: '0.1.0',
      title: `Cloned from ${source.title} (v${source.currentVersion})`,
      description: `Duplicated on ${new Date().toLocaleDateString()}`,
      status: 'draft',
      createdAt: now,
      createdBy: 'Cloned by User',
      nodeCount: source.nodes.length,
      edgeCount: source.edges.length,
      questionCount: source.nodes.filter((n: any) => n.type === 'question').length,
      groupCount: source.groupMeta?.totalGroups || 1,
      nodes: source.nodes,
      edges: source.edges,
      groupMeta: source.groupMeta,
    });

    const cloned = this.projectRepo.create({
      id: newId,
      title: `${source.title} (Copy)`,
      titleBn: source.titleBn ? `${source.titleBn} (কপি)` : '',
      description: source.description,
      status: 'draft',
      currentVersion: '0.1.0',
      createdAt: now,
      updatedAt: now,
      groupMeta: source.groupMeta,
      nodes: source.nodes,
      edges: source.edges,
      versions: [newVersion],
    });

    await this.projectRepo.save(cloned);
    await this.versionRepo.save(newVersion);

    return this.mapToDto(cloned);
  }

  async createVersion(
    id: string,
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
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['versions'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found in PostgreSQL`);
    }

    const now = new Date().toISOString();
    const newVersionId = `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const currentNodes = dto.nodes || project.nodes;
    const currentEdges = dto.edges || project.edges;
    const currentMeta = dto.groupMeta || project.groupMeta;

    const version = this.versionRepo.create({
      id: newVersionId,
      projectId: id,
      version: dto.version,
      title: dto.title,
      description: dto.description || '',
      status: dto.isPublished ? 'published' : 'draft',
      createdAt: now,
      createdBy: dto.createdBy || 'Flowchart Author',
      nodeCount: currentNodes.length,
      edgeCount: currentEdges.length,
      questionCount: currentNodes.filter((n: any) => n.type === 'question').length,
      groupCount: currentMeta?.totalGroups || 1,
      nodes: currentNodes,
      edges: currentEdges,
      groupMeta: currentMeta,
    });

    await this.versionRepo.save(version);

    if (dto.isPublished) {
      // Archive other versions in Postgres
      await this.versionRepo.update(
        { projectId: id, status: 'published' },
        { status: 'archived' }
      );
      version.status = 'published';
      await this.versionRepo.save(version);

      project.publishedVersionId = newVersionId;
      project.status = 'published';
    }

    project.currentVersion = dto.version;
    project.updatedAt = now;
    await this.projectRepo.save(project);

    const refreshed = await this.findOne(id);
    return {
      updatedProject: refreshed,
      newVersion: this.mapVersionToDto(version),
    };
  }

  async restoreVersion(id: string, versionId: string): Promise<FlowchartProject> {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['versions'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found in PostgreSQL`);
    }

    const targetVersion = await this.versionRepo.findOne({
      where: { id: versionId, projectId: id },
    });

    if (!targetVersion) {
      throw new NotFoundException(`Version "${versionId}" not found in PostgreSQL`);
    }

    project.nodes = targetVersion.nodes;
    project.edges = targetVersion.edges;
    project.groupMeta = targetVersion.groupMeta;
    project.currentVersion = targetVersion.version;
    project.updatedAt = new Date().toISOString();

    await this.projectRepo.save(project);
    return this.findOne(id);
  }

  private mapToDto(entity: ProjectEntity): FlowchartProject {
    const toIso = (val: any) => (val instanceof Date ? val.toISOString() : String(val));
    const versions = (entity.versions || []).map((v) => this.mapVersionToDto(v));
    // Sort versions descending by creation
    versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      id: entity.id,
      title: entity.title,
      titleBn: entity.titleBn,
      description: entity.description,
      status: entity.status,
      currentVersion: entity.currentVersion,
      publishedVersionId: entity.publishedVersionId,
      createdAt: toIso(entity.createdAt),
      updatedAt: toIso(entity.updatedAt),
      groupMeta: entity.groupMeta,
      nodes: entity.nodes,
      edges: entity.edges,
      versions,
    };
  }

  private mapVersionToDto(entity: VersionEntity): FlowchartVersion {
    const toIso = (val: any) => (val instanceof Date ? val.toISOString() : String(val));
    return {
      id: entity.id,
      version: entity.version,
      title: entity.title,
      description: entity.description,
      status: entity.status,
      createdAt: toIso(entity.createdAt),
      createdBy: entity.createdBy,
      nodeCount: entity.nodeCount,
      edgeCount: entity.edgeCount,
      questionCount: entity.questionCount,
      groupCount: entity.groupCount,
      groupMeta: entity.groupMeta,
      nodes: entity.nodes,
      edges: entity.edges,
    };
  }
}
