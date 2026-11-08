import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { DatabaseService } from '../database/database.service';
import { FlowchartProject, FlowchartVersion } from '../types';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService
  ) { }

  async findAll(): Promise<FlowchartProject[]> {
    const pgRepo = this.databaseService.getProjectsRepo();
    if (pgRepo) {
      return pgRepo.findAll();
    }
    return this.storageService.getAllProjects();
  }

  async findOne(id: string): Promise<FlowchartProject> {
    const pgRepo = this.databaseService.getProjectsRepo();
    if (pgRepo) {
      return pgRepo.findOne(id);
    }
    const project = this.storageService.getProjectById(id);
    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }
    return project;
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
    const pgRepo = this.databaseService.getProjectsRepo();
    if (pgRepo) {
      return pgRepo.create(dto);
    }

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
    const initialVersion: FlowchartVersion = {
      id: initialVersionId,
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
      nodes: JSON.parse(JSON.stringify(initialNodes)),
      edges: JSON.parse(JSON.stringify(dto.edges || [])),
      groupMeta: JSON.parse(JSON.stringify(initialMeta)),
    };

    const newProject: FlowchartProject = {
      id,
      title: dto.title || 'Untitled Survey Workflow',
      titleBn: dto.titleBn || '',
      description: dto.description || '',
      status: 'draft',
      currentVersion: '0.1.0',
      versions: [initialVersion],
      createdAt: now,
      updatedAt: now,
      groupMeta: initialMeta,
      nodes: initialNodes,
      edges: dto.edges || [],
    };

    const projects = [newProject, ...this.storageService.getAllProjects()];
    this.storageService.saveProjects(projects);
    return newProject;
  }

  async update(id: string, dto: Partial<FlowchartProject>): Promise<FlowchartProject> {
    const pgRepo = this.databaseService.getProjectsRepo();
    if (pgRepo) {
      return pgRepo.update(id, dto);
    }

    const projects = this.storageService.getAllProjects();
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }

    const current = projects[index];
    const updated: FlowchartProject = {
      ...current,
      ...dto,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };

    projects[index] = updated;
    this.storageService.saveProjects(projects);
    return updated;
  }

  async delete(id: string): Promise<{ success: boolean; id: string }> {
    const pgRepo = this.databaseService.getProjectsRepo();
    if (pgRepo) {
      return pgRepo.delete(id);
    }

    const projects = this.storageService.getAllProjects();
    const filtered = projects.filter((p) => p.id !== id);
    if (filtered.length === projects.length) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }

    this.storageService.saveProjects(filtered);
    return { success: true, id };
  }

  async duplicate(id: string): Promise<FlowchartProject> {
    const pgRepo = this.databaseService.getProjectsRepo();
    if (pgRepo) {
      return pgRepo.duplicate(id);
    }

    const source = await this.findOne(id);
    const now = new Date().toISOString();
    const newId = `proj-copy-${Date.now()}`;

    const cloned: FlowchartProject = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      title: `${source.title} (Copy)`,
      titleBn: source.titleBn ? `${source.titleBn} (কপি)` : '',
      status: 'draft',
      currentVersion: '0.1.0',
      createdAt: now,
      updatedAt: now,
      publishedVersionId: undefined,
      versions: [
        {
          id: `ver-init-${newId}`,
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
          nodes: JSON.parse(JSON.stringify(source.nodes)),
          edges: JSON.parse(JSON.stringify(source.edges)),
          groupMeta: JSON.parse(JSON.stringify(source.groupMeta)),
        },
      ],
    };

    const projects = [cloned, ...this.storageService.getAllProjects()];
    this.storageService.saveProjects(projects);
    return cloned;
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
    const pgRepo = this.databaseService.getProjectsRepo();
    if (pgRepo) {
      return pgRepo.createVersion(id, dto);
    }

    const project = await this.findOne(id);
    const now = new Date().toISOString();
    const newVersionId = `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const currentNodes = dto.nodes || project.nodes;
    const currentEdges = dto.edges || project.edges;
    const currentMeta = dto.groupMeta || project.groupMeta;

    const newVersion: FlowchartVersion = {
      id: newVersionId,
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
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      edges: JSON.parse(JSON.stringify(currentEdges)),
      groupMeta: JSON.parse(JSON.stringify(currentMeta)),
    };

    const updatedVersions = dto.isPublished
      ? project.versions.map((v) => ({
        ...v,
        status: v.status === 'published' ? ('archived' as const) : v.status,
      }))
      : [...project.versions];

    const updatedProject: FlowchartProject = {
      ...project,
      currentVersion: dto.version,
      status: dto.isPublished ? 'published' : project.status,
      publishedVersionId: dto.isPublished ? newVersionId : project.publishedVersionId,
      updatedAt: now,
      versions: [newVersion, ...updatedVersions],
    };

    const projects = this.storageService.getAllProjects().map((p) =>
      p.id === id ? updatedProject : p
    );
    this.storageService.saveProjects(projects);

    return { updatedProject, newVersion };
  }

  async restoreVersion(id: string, versionId: string): Promise<FlowchartProject> {
    const pgRepo = this.databaseService.getProjectsRepo();
    if (pgRepo) {
      return pgRepo.restoreVersion(id, versionId);
    }

    const project = await this.findOne(id);
    const target = project.versions.find((v) => v.id === versionId);
    if (!target) {
      throw new NotFoundException(`Version "${versionId}" not found in project "${id}"`);
    }

    const restored: FlowchartProject = {
      ...project,
      nodes: JSON.parse(JSON.stringify(target.nodes)),
      edges: JSON.parse(JSON.stringify(target.edges)),
      groupMeta: JSON.parse(JSON.stringify(target.groupMeta)),
      currentVersion: target.version,
      updatedAt: new Date().toISOString(),
    };

    const projects = this.storageService.getAllProjects().map((p) =>
      p.id === id ? restored : p
    );
    this.storageService.saveProjects(projects);

    return restored;
  }
}
