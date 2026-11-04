import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { FlowchartProject, ReusableQuestionGroup } from '../types';
import { SEED_PROJECTS, SEED_GROUPS } from './seeds';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly dataDir = path.resolve(__dirname, '../../data');
  private readonly projectsFile = path.join(this.dataDir, 'projects.json');
  private readonly groupsFile = path.join(this.dataDir, 'groups.json');

  private projects: FlowchartProject[] = [];
  private groups: ReusableQuestionGroup[] = [];

  onModuleInit() {
    this.ensureDataDirectory();
    this.loadData();
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      this.logger.log(`Created data storage directory at: ${this.dataDir}`);
    }
  }

  private loadData() {
    // 1. Projects
    if (fs.existsSync(this.projectsFile)) {
      try {
        const raw = fs.readFileSync(this.projectsFile, 'utf-8');
        this.projects = JSON.parse(raw);
        this.logger.log(`Loaded ${this.projects.length} project(s) from ${this.projectsFile}`);
      } catch (err) {
        this.logger.error(`Failed to parse projects.json, restoring seeds: ${err}`);
        this.projects = [...SEED_PROJECTS];
        this.persistProjects();
      }
    } else {
      this.projects = [...SEED_PROJECTS];
      this.persistProjects();
      this.logger.log(`Initialized projects with seed data (${this.projects.length} projects).`);
    }

    // 2. Groups
    if (fs.existsSync(this.groupsFile)) {
      try {
        const raw = fs.readFileSync(this.groupsFile, 'utf-8');
        this.groups = JSON.parse(raw);
        this.logger.log(`Loaded ${this.groups.length} group(s) from ${this.groupsFile}`);
      } catch (err) {
        this.logger.error(`Failed to parse groups.json, restoring seeds: ${err}`);
        this.groups = [...SEED_GROUPS];
        this.persistGroups();
      }
    } else {
      this.groups = [...SEED_GROUPS];
      this.persistGroups();
      this.logger.log(`Initialized reusable groups with seed data (${this.groups.length} groups).`);
    }
  }

  // --- Projects Methods ---
  getAllProjects(): FlowchartProject[] {
    return this.projects;
  }

  getProjectById(id: string): FlowchartProject | undefined {
    return this.projects.find((p) => p.id === id);
  }

  saveProjects(projects: FlowchartProject[]) {
    this.projects = projects;
    this.persistProjects();
  }

  private persistProjects() {
    fs.writeFileSync(this.projectsFile, JSON.stringify(this.projects, null, 2), 'utf-8');
  }

  // --- Groups Methods ---
  getAllGroups(): ReusableQuestionGroup[] {
    return this.groups;
  }

  getGroupById(id: string): ReusableQuestionGroup | undefined {
    return this.groups.find((g) => g.id === id);
  }

  saveGroups(groups: ReusableQuestionGroup[]) {
    this.groups = groups;
    this.persistGroups();
  }

  resetGroups(): ReusableQuestionGroup[] {
    this.groups = [...SEED_GROUPS];
    this.persistGroups();
    return this.groups;
  }

  private persistGroups() {
    fs.writeFileSync(this.groupsFile, JSON.stringify(this.groups, null, 2), 'utf-8');
  }
}

