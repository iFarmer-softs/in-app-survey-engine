import type { Node, Edge } from '@xyflow/react';
import type { FlowchartProject, FlowchartVersion } from '../types/project';
import type { GroupMeta } from './schemaCompiler';

const STORAGE_KEY = 'ifarmer_survey_flowchart_projects_v2';
const ACTIVE_PROJECT_KEY = 'ifarmer_survey_active_project_id_v2';

export function countQuestionsInNodes(nodes: Node[]): number {
  return nodes.filter((n) => n.type === 'question' || n.type === 'decision').length;
}

export function ensureProjectVersions(project: FlowchartProject): FlowchartProject {
  const currentVersion = project.currentVersion || (project.status === 'published' ? '1.0.0' : '0.1.0');
  
  if (Array.isArray(project.versions) && project.versions.length > 0) {
    return {
      ...project,
      currentVersion,
      versions: project.versions,
    };
  }

  const initialVersionId = `ver-init-${project.id}`;
  const initialVersion: FlowchartVersion = {
    id: initialVersionId,
    version: currentVersion,
    title: project.status === 'published' ? 'Initial Published Release' : 'Initial Working Draft',
    description: project.description || 'Base flowchart baseline snapshot.',
    status: project.status,
    createdAt: project.createdAt || new Date().toISOString(),
    createdBy: 'System / Author',
    nodeCount: project.nodes.length,
    edgeCount: project.edges.length,
    questionCount: countQuestionsInNodes(project.nodes),
    groupCount: project.groupMeta?.totalGroups || 1,
    nodes: JSON.parse(JSON.stringify(project.nodes)),
    edges: JSON.parse(JSON.stringify(project.edges)),
    groupMeta: JSON.parse(JSON.stringify(project.groupMeta)),
  };

  return {
    ...project,
    currentVersion,
    publishedVersionId: project.status === 'published' ? initialVersionId : undefined,
    versions: [initialVersion],
  };
}

export function getInitialSeedProjects(): FlowchartProject[] {
  const newId = 'proj-blank-survey';
  const now = new Date().toISOString();

  const blankProject: FlowchartProject = {
    id: newId,
    title: 'New Survey Flowchart',
    titleBn: 'নতুন জরিপ ফ্লোচার্ট',
    description: 'Blank flowchart canvas ready for survey creation.',
    status: 'draft',
    currentVersion: '0.1.0',
    createdAt: now,
    updatedAt: now,
    groupMeta: {
      totalGroups: 1,
      groupNumber: 1,
      hasNextGroup: false,
      instruction: '',
      groupJumps: [],
    },
    nodes: [],
    edges: [],
    versions: [
      {
        id: `ver-init-${newId}`,
        version: '0.1.0',
        title: 'Initial Empty Canvas',
        description: 'Blank starting canvas.',
        status: 'draft',
        createdAt: now,
        createdBy: 'Survey Designer',
        nodeCount: 0,
        edgeCount: 0,
        questionCount: 0,
        groupCount: 1,
        nodes: [],
        edges: [],
        groupMeta: {
          totalGroups: 1,
          groupNumber: 1,
          hasNextGroup: false,
          instruction: '',
          groupJumps: [],
        },
      },
    ],
  };

  return [blankProject];
}

export function loadAllProjects(): FlowchartProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = getInitialSeedProjects();
      saveAllProjects(seed);
      return seed;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(ensureProjectVersions);
    }
    const seed = getInitialSeedProjects();
    saveAllProjects(seed);
    return seed;
  } catch (err) {
    console.error('Failed to load projects from localStorage:', err);
    return getInitialSeedProjects();
  }
}

export function saveAllProjects(projects: FlowchartProject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error('Failed to save projects to localStorage:', err);
  }
}

export function getActiveProjectId(projects: FlowchartProject[]): string {
  try {
    const saved = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (saved && projects.some((p) => p.id === saved)) {
      return saved;
    }
  } catch {
    // fallback
  }
  return projects[0]?.id || 'proj-blank-survey';
}

export function setActiveProjectId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } catch (err) {
    console.error('Failed to set active project id:', err);
  }
}

export function getNextVersion(
  currentVersion: string,
  bump: 'patch' | 'minor' | 'major'
): string {
  const clean = currentVersion.replace(/^[vV]/, '').trim();
  const parts = clean.split('.').map((p) => parseInt(p, 10));

  let major = isNaN(parts[0]) ? 1 : parts[0];
  let minor = isNaN(parts[1]) ? 0 : parts[1];
  let patch = isNaN(parts[2]) ? 0 : parts[2];

  if (bump === 'patch') {
    patch += 1;
  } else if (bump === 'minor') {
    minor += 1;
    patch = 0;
  } else if (bump === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  }

  return `${major}.${minor}.${patch}`;
}

export function createBlankProject(
  title: string,
  titleBn?: string,
  description?: string,
  totalGroups: number = 1
): FlowchartProject {
  const newId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const groupMeta: GroupMeta = {
    totalGroups: Math.max(1, totalGroups),
    groupNumber: 1,
    hasNextGroup: totalGroups > 1,
    instruction: '',
    groupJumps: [],
  };

  const initialVersionId = `ver-init-${newId}`;
  const initialVersion: FlowchartVersion = {
    id: initialVersionId,
    version: '0.1.0',
    title: 'Initial Project Creation',
    description: 'Empty starting canvas.',
    status: 'draft',
    createdAt: now,
    createdBy: 'Survey Designer',
    nodeCount: 0,
    edgeCount: 0,
    questionCount: 0,
    groupCount: Math.max(1, totalGroups),
    nodes: [],
    edges: [],
    groupMeta: JSON.parse(JSON.stringify(groupMeta)),
  };

  const project: FlowchartProject = {
    id: newId,
    title: title.trim() || 'New Survey Flowchart',
    titleBn: titleBn?.trim() || title.trim() || 'নতুন সার্ভে ফ্লোচার্ট',
    description: description?.trim() || 'Empty flowchart ready for design.',
    status: 'draft',
    currentVersion: '0.1.0',
    versions: [initialVersion],
    createdAt: now,
    updatedAt: now,
    groupMeta,
    nodes,
    edges,
  };

  return project;
}

export function duplicateProject(source: FlowchartProject): FlowchartProject {
  const newId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const normalized = ensureProjectVersions(source);

  const newVersionId = `ver-init-${newId}`;
  const initialVersion: FlowchartVersion = {
    id: newVersionId,
    version: '0.1.0',
    title: `Cloned from ${source.title} (${normalized.currentVersion})`,
    description: `Duplicate of ${source.title}`,
    status: 'draft',
    createdAt: now,
    createdBy: 'Survey Designer',
    nodeCount: normalized.nodes.length,
    edgeCount: normalized.edges.length,
    questionCount: countQuestionsInNodes(normalized.nodes),
    groupCount: normalized.groupMeta?.totalGroups || 1,
    nodes: JSON.parse(JSON.stringify(normalized.nodes)),
    edges: JSON.parse(JSON.stringify(normalized.edges)),
    groupMeta: JSON.parse(JSON.stringify(normalized.groupMeta)),
  };

  return {
    ...normalized,
    id: newId,
    title: `${source.title} (Copy)`,
    titleBn: source.titleBn ? `${source.titleBn} (কপি)` : undefined,
    status: 'draft',
    currentVersion: '0.1.0',
    publishedVersionId: undefined,
    versions: [initialVersion],
    createdAt: now,
    updatedAt: now,
    nodes: JSON.parse(JSON.stringify(normalized.nodes)),
    edges: JSON.parse(JSON.stringify(normalized.edges)),
    groupMeta: JSON.parse(JSON.stringify(normalized.groupMeta)),
  };
}

export interface CreateSnapshotOptions {
  version: string;
  title: string;
  description?: string;
  isPublished?: boolean;
  createdBy?: string;
  nodes?: Node[];
  edges?: Edge[];
  groupMeta?: GroupMeta;
}

export function addVersionSnapshot(
  project: FlowchartProject,
  options: CreateSnapshotOptions
): { updatedProject: FlowchartProject; newVersion: FlowchartVersion } {
  const normalized = ensureProjectVersions(project);
  const now = new Date().toISOString();
  const newVerId = `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const nodes = options.nodes || normalized.nodes;
  const edges = options.edges || normalized.edges;
  const groupMeta = options.groupMeta || normalized.groupMeta;

  const newVersion: FlowchartVersion = {
    id: newVerId,
    version: options.version.trim() || normalized.currentVersion,
    title: options.title.trim() || `Version ${options.version}`,
    description: options.description?.trim(),
    status: options.isPublished ? 'published' : 'draft',
    createdAt: now,
    createdBy: options.createdBy || 'Survey Designer',
    nodeCount: nodes.length,
    edgeCount: edges.length,
    questionCount: countQuestionsInNodes(nodes),
    groupCount: groupMeta.totalGroups || 1,
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
    groupMeta: JSON.parse(JSON.stringify(groupMeta)),
  };

  const updatedVersions = [newVersion, ...normalized.versions];

  const updatedProject: FlowchartProject = {
    ...normalized,
    currentVersion: newVersion.version,
    status: options.isPublished ? 'published' : normalized.status,
    publishedVersionId: options.isPublished ? newVersion.id : normalized.publishedVersionId,
    versions: updatedVersions,
    updatedAt: now,
  };

  return { updatedProject, newVersion };
}

export function restoreProjectVersion(
  project: FlowchartProject,
  versionId: string
): FlowchartProject {
  const normalized = ensureProjectVersions(project);
  const target = normalized.versions.find((v) => v.id === versionId);
  if (!target) return normalized;

  return {
    ...normalized,
    nodes: JSON.parse(JSON.stringify(target.nodes)),
    edges: JSON.parse(JSON.stringify(target.edges)),
    groupMeta: JSON.parse(JSON.stringify(target.groupMeta)),
    updatedAt: new Date().toISOString(),
  };
}

export interface VersionDiffResult {
  addedNodes: string[];
  removedNodes: string[];
  modifiedNodes: string[];
  addedEdgesCount: number;
  removedEdgesCount: number;
  totalChanges: number;
}

export function compareFlowSnapshots(
  baseNodes: Node[],
  targetNodes: Node[],
  baseEdges: Edge[],
  targetEdges: Edge[]
): VersionDiffResult {
  const baseNodeMap = new Map(baseNodes.map((n) => [n.id, n]));
  const targetNodeMap = new Map(targetNodes.map((n) => [n.id, n]));

  const addedNodes: string[] = [];
  const removedNodes: string[] = [];
  const modifiedNodes: string[] = [];

  for (const [id, targetNode] of targetNodeMap.entries()) {
    if (!baseNodeMap.has(id)) {
      const label = (targetNode.data as any)?.question || (targetNode.data as any)?.label || id;
      addedNodes.push(String(label));
    } else {
      const baseNode = baseNodeMap.get(id)!;
      const baseStr = JSON.stringify(baseNode.data || {});
      const targetStr = JSON.stringify(targetNode.data || {});
      if (baseStr !== targetStr) {
        const label = (targetNode.data as any)?.question || (targetNode.data as any)?.label || id;
        modifiedNodes.push(String(label));
      }
    }
  }

  for (const [id, baseNode] of baseNodeMap.entries()) {
    if (!targetNodeMap.has(id)) {
      const label = (baseNode.data as any)?.question || (baseNode.data as any)?.label || id;
      removedNodes.push(String(label));
    }
  }

  const baseEdgeIds = new Set(baseEdges.map((e) => e.id));
  const targetEdgeIds = new Set(targetEdges.map((e) => e.id));

  let addedEdgesCount = 0;
  let removedEdgesCount = 0;

  for (const id of targetEdgeIds) {
    if (!baseEdgeIds.has(id)) addedEdgesCount++;
  }
  for (const id of baseEdgeIds) {
    if (!targetEdgeIds.has(id)) removedEdgesCount++;
  }

  const totalChanges =
    addedNodes.length +
    removedNodes.length +
    modifiedNodes.length +
    addedEdgesCount +
    removedEdgesCount;

  return {
    addedNodes,
    removedNodes,
    modifiedNodes,
    addedEdgesCount,
    removedEdgesCount,
    totalChanges,
  };
}
