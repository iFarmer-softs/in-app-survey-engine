import type { FlowchartProject } from '../types/project';
import { SAMPLE_INITIAL_SCHEMA, parseSchemaToFlow } from './schemaCompiler';

const STORAGE_KEY = 'ifarmer_survey_flowchart_projects_v1';
const ACTIVE_PROJECT_KEY = 'ifarmer_survey_active_project_id_v1';

export function getInitialSeedProjects(): FlowchartProject[] {
  const parsed = parseSchemaToFlow(SAMPLE_INITIAL_SCHEMA);
  const now = new Date().toISOString();

  return [
    {
      id: 'proj-sofol-loan-kyc-v2',
      title: 'Sofol Dynamic KYC - Farmer Loan V2',
      titleBn: 'সফল ডায়নামিক কেওয়াইসি - কৃষক ঋণ যাচাই',
      description: 'Comprehensive farmer KYC workflow with land ownership branching, farm income, crop categorization, and group transitions.',
      status: 'published',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: now,
      groupMeta: parsed.meta,
      nodes: parsed.nodes,
      edges: parsed.edges,
    },
    {
      id: 'proj-credit-score-assessment',
      title: 'Modify Credit Score Assessment',
      titleBn: 'ক্রেডিট স্কোর মূল্যায়ন সমীক্ষা',
      description: 'Assessment survey for credit history checks, financial guarantor validation, and land mortgage verification.',
      status: 'draft',
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      groupMeta: {
        totalGroups: 2,
        groupNumber: 1,
        hasNextGroup: true,
        instruction: 'কৃষকের ক্রেডিট স্কোর এবং জামানত তথ্য যাচাই করুন',
        groupJumps: [{ group_id: '2', group_title: 'ক্রেডিট স্কোর শাখা' }],
      },
      nodes: [
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
      ],
      edges: [
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
      ],
    },
  ];
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
      return parsed;
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

export function createBlankProject(
  title: string,
  titleBn?: string,
  description?: string,
  totalGroups: number = 1
): FlowchartProject {
  const newId = `proj-${Date.now()}`;
  const now = new Date().toISOString();

  const project: FlowchartProject = {
    id: newId,
    title: title.trim() || 'New Survey Flowchart',
    titleBn: titleBn?.trim() || title.trim() || 'নতুন সার্ভে ফ্লোচার্ট',
    description: description?.trim() || 'Custom survey flow created from blank canvas.',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    groupMeta: {
      totalGroups: Math.max(1, totalGroups),
      groupNumber: 1,
      hasNextGroup: totalGroups > 1,
      instruction: 'সার্ভে প্রশ্নাবলী পূরণ করুন',
      groupJumps: [],
    },
    nodes: [
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
    ],
    edges: [],
  };

  return project;
}

export function duplicateProject(source: FlowchartProject): FlowchartProject {
  const newId = `proj-${Date.now()}`;
  const now = new Date().toISOString();

  return {
    ...source,
    id: newId,
    title: `${source.title} (Copy)`,
    titleBn: source.titleBn ? `${source.titleBn} (কপি)` : undefined,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    nodes: JSON.parse(JSON.stringify(source.nodes)),
    edges: JSON.parse(JSON.stringify(source.edges)),
    groupMeta: JSON.parse(JSON.stringify(source.groupMeta)),
  };
}
