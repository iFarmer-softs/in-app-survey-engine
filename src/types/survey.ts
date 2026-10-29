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

export type ValidationType = 'match' | 'greater' | 'less';

export interface ValidationConfig {
  validation_type: ValidationType;
  validation: string | number | boolean | Record<string, boolean>;
}

export interface DynamicKycQuestion {
  question_id: number;
  question: string;
  question_bn: string;
  answer_type: AnswerType;
  mandatory: boolean;
  editable?: boolean;
  placeholder?: string;
  hint?: string;
  options?: string; // Comma-separated list of options
  value?: string;
  depends_on?: number[];
  validation?: Record<string, ValidationConfig>; // Keyed by parent question_id as string
}

export interface GroupJumpOption {
  group_id: string;
  group_title: string;
}

export interface DynamicKycGroupResponse {
  total_groups: number;
  current_group?: number;
  next: boolean;
  instruction?: string;
  data: DynamicKycQuestion[];
  groups?: GroupJumpOption[];
}

export type FlowNodeType =
  | 'start'
  | 'end'
  | 'question'
  | 'decision'
  | 'groupJump'
  | 'process'
  | 'document';

export interface QuestionNodeData {
  question_id: number;
  question: string;
  question_bn: string;
  answer_type: AnswerType;
  mandatory: boolean;
  editable?: boolean;
  placeholder?: string;
  hint?: string;
  options?: string;
  value?: string;
  customColor?: string;
}

export interface DecisionNodeData {
  label: string;
  parentQuestionId?: number;
  conditionType: ValidationType;
  comparisonValue: string | number;
}

export interface GroupJumpNodeData {
  targetGroupId: number;
  targetGroupTitle: string;
}

export interface EdgeConditionData {
  validationType: ValidationType;
  triggerValue: string | number;
  label?: string;
}
