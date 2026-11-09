export type AnswerType =
  | 'string'
  | 'text'
  | 'integer'
  | 'float'
  | 'number_input'
  | 'phone'
  | 'dropdown'
  | 'select_one'
  | 'select_multiple'
  | 'radio'
  | 'single_radio'
  | 'calendar'
  | 'image'
  | 'read_only';

export type ValidationType =
  | 'match'
  | 'not_match'
  | 'greater'
  | 'less'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'else';

export interface ValidationConfig {
  validation_type: ValidationType;
  validation: string | number | boolean | Record<string, boolean>;
  group?: number;
  is_same_group?: boolean;
}

export interface DynamicKycQuestion {
  question_id: number;
  question: string;
  question_bn: string;
  answer_type: AnswerType;
  mandatory: boolean;
  editable?: boolean;
  placeholder?: string | null;
  hint?: string | null;
  options?: string;
  value?: string | null;
  depends_on?: number[] | null;
  validation?: Record<string, ValidationConfig> | null;
  group?: number;
  group_display_order?: number;
  active?: boolean;
  auto_filled?: boolean;
  cross_group_dependency?: any[];
  hidden?: boolean;
  subsequent_questions?: number[];
}

export interface GroupJumpOption {
  group_id: string;
  group_title: string;
  source_question_id?: number;
  trigger_value?: string;
  trigger_type?: string;
  source_handle?: string;
  source_group?: number;
  target_question_id?: number;
}

export interface DynamicKycGroupResponse {
  total_groups: number;
  current_group?: number;
  next: boolean;
  instruction?: string;
  data: DynamicKycQuestion[];
  groups?: GroupJumpOption[];
  groups_to_jump?: GroupJumpOption[];
}

export interface GroupMeta {
  groupNumber: number;
  totalGroups: number;
  hasNextGroup: boolean;
  instruction: string;
  groupJumps: { group_id: string; group_title: string }[];
}

export interface FlowchartVersion {
  id: string;
  version: string;
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  createdBy?: string;
  nodeCount: number;
  edgeCount: number;
  questionCount: number;
  groupCount: number;
  nodes: any[];
  edges: any[];
  groupMeta: GroupMeta;
}

export interface FlowchartProject {
  id: string;
  title: string;
  titleBn?: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  currentVersion: string;
  publishedVersionId?: string;
  versions: FlowchartVersion[];
  createdAt: string;
  updatedAt: string;
  groupMeta: GroupMeta;
  nodes: any[];
  edges: any[];
}

export type GroupCategory =
  | 'kyc'
  | 'land'
  | 'crop'
  | 'financial'
  | 'verification'
  | 'custom';

export interface GroupQuestionTemplate {
  question: string;
  question_bn: string;
  answer_type: AnswerType;
  mandatory: boolean;
  editable?: boolean;
  placeholder?: string;
  hint?: string;
  options?: string;
}

export interface ReusableQuestionGroup {
  id: string;
  groupId?: number;
  name: string;
  nameBn: string;
  description: string;
  category: GroupCategory;
  color: string;
  createdAt: string;
  updatedAt: string;
  questions: GroupQuestionTemplate[];
  flowNodes?: any[];
  flowEdges?: any[];
}

