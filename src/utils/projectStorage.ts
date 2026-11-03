import type { Node, Edge } from '@xyflow/react';
import type { FlowchartProject, FlowchartVersion } from '../types/project';
import type { GroupMeta } from './schemaCompiler';
import { SAMPLE_INITIAL_SCHEMA, parseSchemaToFlow } from './schemaCompiler';

const STORAGE_KEY = 'ifarmer_survey_flowchart_projects_v1';
const ACTIVE_PROJECT_KEY = 'ifarmer_survey_active_project_id_v1';

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
  const parsed = parseSchemaToFlow(SAMPLE_INITIAL_SCHEMA);
  const now = new Date().toISOString();
  const threeDaysAgo = new Date(Date.now() - 86400000 * 3).toISOString();

  const sofolV1Id = 'ver-sofol-1-0-0';
  const sofolV2Id = 'ver-sofol-2-0-0';

  const sofolProject: FlowchartProject = {
    id: 'proj-sofol-loan-kyc-v2',
    title: 'Sofol Dynamic KYC - Farmer Loan V2',
    titleBn: 'সফল ডায়নামিক কেওয়াইসি - কৃষক ঋণ যাচাই',
    description: 'Comprehensive farmer KYC workflow with land ownership branching, farm income, crop categorization, and group transitions.',
    status: 'published',
    currentVersion: '2.0.0',
    publishedVersionId: sofolV2Id,
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    updatedAt: now,
    groupMeta: parsed.meta,
    nodes: parsed.nodes,
    edges: parsed.edges,
    versions: [
      {
        id: sofolV2Id,
        version: '2.0.0',
        title: 'V2 Production Release with Group Transitions',
        description: 'Added support for multi-group loan evaluation, cattle inventory validation, and crop categorization jumps.',
        status: 'published',
        createdAt: threeDaysAgo,
        createdBy: 'iFarmer Credit Team',
        nodeCount: parsed.nodes.length,
        edgeCount: parsed.edges.length,
        questionCount: countQuestionsInNodes(parsed.nodes),
        groupCount: parsed.meta.totalGroups || 2,
        nodes: JSON.parse(JSON.stringify(parsed.nodes)),
        edges: JSON.parse(JSON.stringify(parsed.edges)),
        groupMeta: JSON.parse(JSON.stringify(parsed.meta)),
      },
      {
        id: sofolV1Id,
        version: '1.0.0',
        title: 'Initial Sofol KYC Baseline',
        description: 'First version with basic single-group farmer profile and land ownership questions.',
        status: 'archived',
        createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
        createdBy: 'System Architect',
        nodeCount: Math.max(4, parsed.nodes.length - 4),
        edgeCount: Math.max(3, parsed.edges.length - 4),
        questionCount: Math.max(3, countQuestionsInNodes(parsed.nodes) - 3),
        groupCount: 1,
        nodes: JSON.parse(JSON.stringify(parsed.nodes.slice(0, 8))),
        edges: JSON.parse(JSON.stringify(parsed.edges.slice(0, 7))),
        groupMeta: { ...parsed.meta, totalGroups: 1, hasNextGroup: false },
      },
    ],
  };

  const creditNodes: Node[] = [
    {
      id: 'start-node',
      type: 'start',
      position: { x: 340, y: 50 },
      data: { label: 'Group 1 Start' },
    },
    {
      id: 'q-201',
      type: 'question',
      position: { x: 260, y: 170 },
      data: {
        question_id: 201,
        question: 'Has prior microfinance loans?',
        question_bn: 'পূর্বে কি কোনো ক্ষুদ্রঋণ নিয়েছেন?',
        answer_type: 'select_one',
        mandatory: true,
        editable: true,
        options: 'হ্যাঁ (Yes), না (No)',
        placeholder: 'নির্বাচন করুন',
        hint: 'পূর্বের ঋণের ইতিহাস যাচাই',
      },
    },
    {
      id: 'end-node',
      type: 'end',
      position: { x: 340, y: 380 },
      data: { label: 'Next Group' },
    },
  ];

  const creditEdges: Edge[] = [
    {
      id: 'e-start-201',
      source: 'start-node',
      target: 'q-201',
      animated: true,
      style: { stroke: '#10b981', strokeWidth: 2 },
    },
    {
      id: 'e-201-end',
      source: 'q-201',
      sourceHandle: 'default-next',
      target: 'end-node',
      animated: true,
      style: { stroke: '#64748b', strokeWidth: 2 },
    },
  ];

  const creditMeta: GroupMeta = {
    totalGroups: 2,
    groupNumber: 1,
    hasNextGroup: true,
    instruction: 'কৃষকের ক্রেডিট স্কোর এবং জামানত তথ্য যাচাই করুন',
    groupJumps: [{ group_id: '2', group_title: 'ক্রেডিট স্কোর শাখা' }],
  };

  const creditProject: FlowchartProject = {
    id: 'proj-credit-score-assessment',
    title: 'Modify Credit Score Assessment',
    titleBn: 'ক্রেডিট স্কোর মূল্যায়ন সমীক্ষা',
    description: 'Assessment survey for credit history checks, financial guarantor validation, and land mortgage verification.',
    status: 'draft',
    currentVersion: '0.9.0',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    groupMeta: creditMeta,
    nodes: creditNodes,
    edges: creditEdges,
    versions: [
      {
        id: 'ver-credit-0-9-0',
        version: '0.9.0',
        title: 'Draft Credit History Checkpoint',
        description: 'Initial draft flow with microfinance history node.',
        status: 'draft',
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        createdBy: 'Risk Assessment Team',
        nodeCount: creditNodes.length,
        edgeCount: creditEdges.length,
        questionCount: countQuestionsInNodes(creditNodes),
        groupCount: 2,
        nodes: JSON.parse(JSON.stringify(creditNodes)),
        edges: JSON.parse(JSON.stringify(creditEdges)),
        groupMeta: JSON.parse(JSON.stringify(creditMeta)),
      },
    ],
  };

  return [sofolProject, creditProject];
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
  return projects[0]?.id || 'proj-sofol-loan-kyc-v2';
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

  const nodes: Node[] = [
    {
      id: 'start-node',
      type: 'start',
      position: { x: 350, y: 70 },
      data: { label: 'Group 1 Start' },
    },
    {
      id: 'end-node',
      type: 'end',
      position: { x: 350, y: 400 },
      data: { label: 'Next Group / Submit' },
    },
  ];

  const groupMeta: GroupMeta = {
    totalGroups: Math.max(1, totalGroups),
    groupNumber: 1,
    hasNextGroup: totalGroups > 1,
    instruction: 'সার্ভে প্রশ্নাবলী পূরণ করুন',
    groupJumps: [],
  };

  const initialVersionId = `ver-init-${newId}`;
  const initialVersion: FlowchartVersion = {
    id: initialVersionId,
    version: '0.1.0',
    title: 'Initial Project Creation',
    description: 'Empty starting canvas with start/end terminals.',
    status: 'draft',
    createdAt: now,
    createdBy: 'Survey Designer',
    nodeCount: nodes.length,
    edgeCount: 0,
    questionCount: 0,
    groupCount: Math.max(1, totalGroups),
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: [],
    groupMeta: JSON.parse(JSON.stringify(groupMeta)),
  };

  const project: FlowchartProject = {
    id: newId,
    title: title.trim() || 'New Survey Flowchart',
    titleBn: titleBn?.trim() || title.trim() || 'নতুন সার্ভে ফ্লোচার্ট',
    description: description?.trim() || 'Custom survey flow created from blank canvas.',
    status: 'draft',
    currentVersion: '0.1.0',
    versions: [initialVersion],
    createdAt: now,
    updatedAt: now,
    groupMeta,
    nodes,
    edges: [],
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
