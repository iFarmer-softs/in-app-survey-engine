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

export const OPTION_BASED_TYPES: AnswerType[] = [
  'dropdown',
  'select_one',
  'select_multiple',
  'radio',
  'single_radio',
];

export function isOptionBasedAnswerType(type?: AnswerType): boolean {
  if (!type) return false;
  return OPTION_BASED_TYPES.includes(type);
}

/**
 * Sanitizes and adapts question node properties when transitioning between Answer Widget Types.
 * - Cleanses obsolete `options` when moving to non-option widgets; sets sensible defaults when moving to choice widgets.
 * - Cleanses widget-incompatible `placeholder` (e.g. numeric "যেমন: ৫০" or "নির্বাচন করুন") and provides correct defaults.
 * - Resets pre-filled `value` to prevent type mismatches.
 * - Preserves question text (Bengali & English), ID, and core validation flags.
 */
export function adaptQuestionDataForAnswerType(
  currentData: Partial<QuestionNodeData>,
  newAnswerType: AnswerType
): Partial<QuestionNodeData> {
  const oldAnswerType = currentData.answer_type;
  if (oldAnswerType === newAnswerType) {
    return currentData;
  }

  const updated: Partial<QuestionNodeData> = {
    ...currentData,
    answer_type: newAnswerType,
  };

  const wasOptionBased = isOptionBasedAnswerType(oldAnswerType);
  const isNowOptionBased = isOptionBasedAnswerType(newAnswerType);

  // 1. Sanitize Options
  if (isNowOptionBased) {
    if (!wasOptionBased || !currentData.options || currentData.options.trim().length === 0) {
      if (newAnswerType === 'dropdown') {
        updated.options = 'অপশন ১, অপশন ২, অপশন ৩';
      } else if (newAnswerType === 'select_multiple') {
        updated.options = 'ধান, গম, আলু, ভুট্টা, সবজি';
      } else {
        // select_one, radio, single_radio
        updated.options = 'হ্যাঁ (Yes), না (No)';
      }
    } else {
      updated.options = currentData.options;
    }
  } else {
    // Non-option widget
    updated.options = '';
  }

  // 2. Sanitize Placeholder
  if (['image', 'calendar', 'read_only'].includes(newAnswerType)) {
    updated.placeholder = '';
  } else if (isNowOptionBased) {
    if (newAnswerType === 'dropdown') {
      updated.placeholder = 'নির্বাচন করুন';
    } else {
      updated.placeholder = '';
    }
  } else if (newAnswerType === 'phone') {
    updated.placeholder = '01XXXXXXXXX';
  } else if (['integer', 'float', 'number_input'].includes(newAnswerType)) {
    const oldPlaceholder = (currentData.placeholder || '').trim();
    if (
      !oldPlaceholder ||
      oldPlaceholder === 'নির্বাচন করুন' ||
      oldPlaceholder === '01XXXXXXXXX' ||
      oldPlaceholder === 'e.g. নির্বাচন করুন or ৫০' ||
      wasOptionBased ||
      oldAnswerType === 'phone' ||
      oldAnswerType === 'image' ||
      oldAnswerType === 'calendar'
    ) {
      updated.placeholder = 'যেমন: ৫০';
    } else {
      updated.placeholder = currentData.placeholder;
    }
  } else {
    // string, text
    const oldPlaceholder = (currentData.placeholder || '').trim();
    if (
      oldPlaceholder === 'নির্বাচন করুন' ||
      oldPlaceholder === '01XXXXXXXXX' ||
      oldPlaceholder === 'যেমন: ৫০'
    ) {
      updated.placeholder = '';
    } else {
      updated.placeholder = currentData.placeholder || '';
    }
  }

  // 3. Reset pre-filled value
  updated.value = '';

  return updated;
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
