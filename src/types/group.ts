import type { AnswerType } from './survey';

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
  name: string;
  nameBn: string;
  description: string;
  category: GroupCategory;
  color: string;
  createdAt: string;
  updatedAt: string;
  questions: GroupQuestionTemplate[];
}
