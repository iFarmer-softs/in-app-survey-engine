import type { FlowchartProject, FlowchartVersion } from '../types/project';
import type { ReusableQuestionGroup } from '../types/group';
import type { DynamicKycGroupResponse } from '../types/survey';
import type { GroupMeta } from '../utils/schemaCompiler';

// Base API URL: relative path so it uses Vite proxy in dev or same-origin in prod,
// with direct fallback to localhost:3000 if needed.
const API_BASE = '/api';

class ApiService {
  private isServerHealthy = false;
  private lastHealthCheckTime = 0;
  private healthCheckInterval = 10000; // 10 seconds

  /**
   * Check if the NestJS backend server is responding.
   */
  async checkHealth(): Promise<boolean> {
    const now = Date.now();
    if (this.isServerHealthy && now - this.lastHealthCheckTime < this.healthCheckInterval) {
      return true;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${API_BASE}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        this.isServerHealthy = data.status === 'ok';
      } else {
        this.isServerHealthy = false;
      }
    } catch {
      this.isServerHealthy = false;
    }

    this.lastHealthCheckTime = now;
    return this.isServerHealthy;
  }

  isOnline(): boolean {
    return this.isServerHealthy;
  }

  // ==================== PROJECTS ====================

  async getProjects(): Promise<FlowchartProject[]> {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`);
    return res.json();
  }

  async getProject(id: string): Promise<FlowchartProject> {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Failed to fetch project ${id}: ${res.statusText}`);
    return res.json();
  }

  async createProject(payload: {
    title: string;
    titleBn?: string;
    description?: string;
    totalGroups?: number;
    nodes?: any[];
    edges?: any[];
    groupMeta?: any;
  }): Promise<FlowchartProject> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create project: ${res.statusText}`);
    return res.json();
  }

  async updateProject(id: string, payload: Partial<FlowchartProject>): Promise<FlowchartProject> {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to update project: ${res.statusText}`);
    return res.json();
  }

  async deleteProject(id: string): Promise<{ success: boolean; id: string }> {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete project: ${res.statusText}`);
    return res.json();
  }

  async duplicateProject(id: string): Promise<FlowchartProject> {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to duplicate project: ${res.statusText}`);
    return res.json();
  }

  async createVersion(
    projectId: string,
    payload: {
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
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create version: ${res.statusText}`);
    return res.json();
  }

  async restoreVersion(projectId: string, versionId: string): Promise<FlowchartProject> {
    const res = await fetch(
      `${API_BASE}/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/restore`,
      {
        method: 'POST',
      }
    );
    if (!res.ok) throw new Error(`Failed to restore version: ${res.statusText}`);
    return res.json();
  }

  // ==================== REUSABLE GROUPS ====================

  async getGroups(): Promise<ReusableQuestionGroup[]> {
    const res = await fetch(`${API_BASE}/groups`);
    if (!res.ok) throw new Error(`Failed to fetch groups: ${res.statusText}`);
    return res.json();
  }

  async createGroup(payload: Partial<ReusableQuestionGroup>): Promise<ReusableQuestionGroup> {
    const res = await fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create group: ${res.statusText}`);
    return res.json();
  }

  async updateGroup(id: string, payload: Partial<ReusableQuestionGroup>): Promise<ReusableQuestionGroup> {
    const res = await fetch(`${API_BASE}/groups/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to update group: ${res.statusText}`);
    return res.json();
  }

  async deleteGroup(id: string): Promise<{ success: boolean; id: string }> {
    const res = await fetch(`${API_BASE}/groups/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete group: ${res.statusText}`);
    return res.json();
  }

  async resetGroups(): Promise<ReusableQuestionGroup[]> {
    const res = await fetch(`${API_BASE}/groups/reset`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to reset groups: ${res.statusText}`);
    return res.json();
  }

  // ==================== COMPILER & VALIDATOR ====================

  async compileSchema(payload: {
    nodes: any[];
    edges: any[];
    groupMeta: GroupMeta;
  }): Promise<DynamicKycGroupResponse> {
    const res = await fetch(`${API_BASE}/compiler/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to compile schema: ${res.statusText}`);
    return res.json();
  }

  async validateFlow(payload: {
    nodes: any[];
    edges: any[];
  }): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    summary: {
      totalNodes: number;
      totalEdges: number;
      totalQuestions: number;
      totalDecisions: number;
    };
  }> {
    const res = await fetch(`${API_BASE}/compiler/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to validate flow: ${res.statusText}`);
    return res.json();
  }
}

export const apiClient = new ApiService();

