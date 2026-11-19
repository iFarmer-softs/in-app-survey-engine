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
  | 'contains'
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
  options?: string; // Comma-separated list of options
  value?: string | null;
  depends_on?: number[] | null;
  validation?: Record<string, ValidationConfig> | null; // Keyed by parent question_id as string
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

export type FlowNodeType =
  | 'start'
  | 'end'
  | 'question'
  | 'decision'
  | 'groupJump'
  | 'process'
  | 'document'
  | 'groupContainer'
  | 'groupFrame';

export interface QuestionNodeData {
  question_id: number;
  question: string;
  question_bn: string;
  answer_type: AnswerType;
  mandatory: boolean;
  editable?: boolean;
  active?: boolean;
  auto_filled?: boolean;
  hidden?: boolean;
  group_display_order?: number;
  placeholder?: string;
  hint?: string;
  options?: string;
  value?: string;
  customColor?: string;
  group?: number;
  group_name?: string;
  containerId?: string;
  depends_on?: number[] | null;
  validation?: any;
}

export interface DecisionRule {
  id?: string;
  parentQuestionId?: number;
  field?: string;
  conditionType: ValidationType;
  comparisonValue: string | number;
}

export interface DecisionNodeData {
  label: string;
  parentQuestionId?: number;
  conditionType: ValidationType;
  comparisonValue: string | number;
  logicalOperator?: 'ALL' | 'ANY';
  rules?: DecisionRule[];
}

/**
 * Normalizes decision node data to always return an array of DecisionRule objects.
 * Falls back to legacy single-condition fields if rules array is missing.
 */
export function normalizeDecisionRules(data?: Partial<DecisionNodeData>): DecisionRule[] {
  if (!data) {
    return [{ id: 'rule-1', conditionType: 'match', comparisonValue: '' }];
  }
  if (data.rules && Array.isArray(data.rules) && data.rules.length > 0) {
    return data.rules;
  }
  return [
    {
      id: 'rule-1',
      parentQuestionId: data.parentQuestionId,
      conditionType: data.conditionType || 'match',
      comparisonValue: data.comparisonValue !== undefined ? data.comparisonValue : '',
    },
  ];
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
