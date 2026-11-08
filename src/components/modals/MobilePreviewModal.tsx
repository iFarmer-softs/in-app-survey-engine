import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Camera,
  MapPin,
  Calendar,
  CheckCircle,
  RotateCcw,
  AlertCircle,
  Check,
  RotateCw,
} from 'lucide-react';
import type { DynamicKycGroupResponse, DynamicKycQuestion, GroupJumpOption } from '../../types/survey';
import { Modal } from '../ui/Modal';

interface MobilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: DynamicKycGroupResponse | any;
}

/**
 * Safely parse options into string array regardless of format:
 * comma-separated string, JSON array string, actual Array, or key-value object.
 */
function parseQuestionOptions(options: any): string[] {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options
      .map((o) =>
        typeof o === 'object' && o !== null
          ? o.name || o.value || o.label || o.title || String(o)
          : String(o).trim()
      )
      .filter(Boolean);
  }
  if (typeof options === 'object') {
    return Object.values(options)
      .map((v) =>
        typeof v === 'object' && v !== null
          ? (v as any).name || (v as any).label || String(v)
          : String(v).trim()
      )
      .filter(Boolean);
  }
  if (typeof options === 'string') {
    const trimmed = options.trim();
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseQuestionOptions(parsed);
      } catch {
        // Fall back to split
      }
    }
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [String(options).trim()];
}

/**
 * Flatten questions and recursively extract any nested sub-questions.
 */
function flattenNestedQuestions(
  rawList: any[],
  parentGroupId: number = 1,
  parentId?: number,
  inheritedValidation?: any
): DynamicKycQuestion[] {
  const result: DynamicKycQuestion[] = [];

  rawList.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;

    const qId =
      item.question_id !== undefined
        ? Number(item.question_id)
        : parentId !== undefined
        ? parentId * 100 + index + 1
        : index + 101;

    const itemGroup =
      typeof item.group === 'number' && item.group > 0
        ? item.group
        : parentGroupId;

    const dependsOn: number[] = [];
    if (Array.isArray(item.depends_on)) {
      item.depends_on.forEach((p: any) => dependsOn.push(Number(p)));
    } else if (item.depends_on !== undefined && item.depends_on !== null) {
      dependsOn.push(Number(item.depends_on));
    }
    if (parentId !== undefined && !dependsOn.includes(parentId)) {
      dependsOn.push(parentId);
    }

    const validation = item.validation ? { ...item.validation } : {};
    if (inheritedValidation && parentId !== undefined && !validation[String(parentId)]) {
      validation[String(parentId)] = inheritedValidation;
    }

    const q: DynamicKycQuestion = {
      question_id: qId,
      question: item.question || item.title || `Question ${qId}`,
      question_bn: item.question_bn || item.title_bn || item.question || 'প্রশ্ন',
      answer_type: item.answer_type || 'string',
      mandatory: Boolean(item.mandatory),
      editable: item.editable ?? true,
      placeholder: item.placeholder || '',
      hint: item.hint || '',
      options:
        typeof item.options === 'string'
          ? item.options
          : item.options
          ? JSON.stringify(item.options)
          : '',
      value: item.value || '',
      group: itemGroup,
      group_display_order: item.group_display_order,
      active: item.active ?? true,
      auto_filled: item.auto_filled ?? false,
      depends_on: dependsOn.length > 0 ? dependsOn : null,
      validation: Object.keys(validation).length > 0 ? validation : null,
      cross_group_dependency: item.cross_group_dependency,
      hidden: item.hidden,
    };

    result.push(q);

    // Look for nested sub-questions
    const nestedRaw =
      item.sub_questions ||
      item.nested_questions ||
      item.children ||
      (Array.isArray(item.questions) ? item.questions : null);

    if (Array.isArray(nestedRaw) && nestedRaw.length > 0) {
      const nestedChildren = flattenNestedQuestions(nestedRaw, itemGroup, qId);
      result.push(...nestedChildren);
    }
  });

  return result;
}

interface NormalizedSurvey {
  totalGroups: number;
  currentGroup: number;
  hasNext: boolean;
  instruction: string;
  groupInstructions: Record<number, string>;
  groupTitles: Record<number, string>;
  groupJumps: GroupJumpOption[];
  questions: DynamicKycQuestion[];
}

/**
 * Normalizes any survey JSON schema (single group, multi-group array, nested groups object, etc.)
 */
function normalizeSchema(schema: any): NormalizedSurvey {
  let rawQuestions: any[] = [];
  const groupInstructions: Record<number, string> = {};
  const groupTitles: Record<number, string> = {};
  let groupJumps: GroupJumpOption[] = [];
  let explicitCurrentGroup = 1;
  let explicitTotalGroups = 1;
  let explicitHasNext = false;
  let topInstruction = '';

  if (Array.isArray(schema)) {
    // Array of group responses [ { current_group: 1, ... }, { current_group: 2, ... } ]
    explicitTotalGroups = schema.length;
    schema.forEach((grp, idx) => {
      const gNum = Number(grp.current_group || grp.group_id || grp.group || idx + 1);
      if (grp.instruction) groupInstructions[gNum] = grp.instruction;
      if (grp.title || grp.group_title || grp.name) {
        groupTitles[gNum] = grp.title || grp.group_title || grp.name;
      }
      const gQuestions = grp.data || grp.questions || [];
      if (Array.isArray(gQuestions)) {
        rawQuestions.push(...flattenNestedQuestions(gQuestions, gNum));
      }
      if (Array.isArray(grp.groups_to_jump)) groupJumps.push(...grp.groups_to_jump);
      if (Array.isArray(grp.groups)) groupJumps.push(...grp.groups);
    });
  } else if (schema && typeof schema === 'object') {
    topInstruction = schema.instruction || '';
    explicitCurrentGroup = Number(schema.current_group) || 1;
    explicitTotalGroups = Number(schema.total_groups) || 1;
    explicitHasNext = Boolean(schema.next ?? schema.hasNextGroup ?? false);

    if (Array.isArray(schema.groups_to_jump)) groupJumps.push(...schema.groups_to_jump);
    if (
      Array.isArray(schema.groups) &&
      schema.groups.length > 0 &&
      typeof schema.groups[0] === 'object' &&
      'group_id' in schema.groups[0] &&
      !('data' in schema.groups[0]) &&
      !('questions' in schema.groups[0])
    ) {
      groupJumps.push(...schema.groups);
    }

    // Check if schema.groups contains group objects with question data
    if (
      Array.isArray(schema.groups) &&
      schema.groups.length > 0 &&
      typeof schema.groups[0] === 'object' &&
      ('data' in schema.groups[0] || 'questions' in schema.groups[0])
    ) {
      explicitTotalGroups = Math.max(explicitTotalGroups, schema.groups.length);
      schema.groups.forEach((grp: any, idx: number) => {
        const gNum = Number(grp.group_id || grp.current_group || grp.group || idx + 1);
        if (grp.instruction) groupInstructions[gNum] = grp.instruction;
        if (grp.title || grp.group_title || grp.name) {
          groupTitles[gNum] = grp.title || grp.group_title || grp.name;
        }
        const gQuestions = grp.data || grp.questions || [];
        if (Array.isArray(gQuestions)) {
          rawQuestions.push(...flattenNestedQuestions(gQuestions, gNum));
        }
      });
    } else if (Array.isArray(schema.data)) {
      rawQuestions = flattenNestedQuestions(schema.data, explicitCurrentGroup);
    } else if (Array.isArray(schema.questions)) {
      rawQuestions = flattenNestedQuestions(schema.questions, explicitCurrentGroup);
    } else if (schema.result && Array.isArray(schema.result.data)) {
      rawQuestions = flattenNestedQuestions(schema.result.data, explicitCurrentGroup);
    }
  }

  // Deduplicate questions by question_id preserving first occurrence
  const questionMap = new Map<number, DynamicKycQuestion>();
  rawQuestions.forEach((q) => {
    if (!questionMap.has(q.question_id)) {
      questionMap.set(q.question_id, q);
    }
  });
  const questions = Array.from(questionMap.values());

  return {
    totalGroups: explicitTotalGroups,
    currentGroup: explicitCurrentGroup,
    hasNext: explicitHasNext,
    instruction: topInstruction,
    groupInstructions,
    groupTitles,
    groupJumps,
    questions,
  };
}

/**
 * Robust rule evaluator handling match maps, wildcard, numeric, and string comparisons.
 */
function evaluateRule(ruleConfig: any, parentAnswer: string): boolean {
  if (!parentAnswer || parentAnswer.trim() === '') return false;
  if (!ruleConfig) return true;

  const trimmedParent = parentAnswer.trim();

  // If ruleConfig is raw string or number
  if (typeof ruleConfig === 'string' || typeof ruleConfig === 'number') {
    const s = String(ruleConfig).trim();
    if (s === '') return true;
    if (s.startsWith('>')) {
      const numVal = parseFloat(trimmedParent);
      const threshold = parseFloat(s.slice(1).trim());
      return !isNaN(numVal) && numVal > threshold;
    }
    if (s.startsWith('<')) {
      const numVal = parseFloat(trimmedParent);
      const threshold = parseFloat(s.slice(1).trim());
      return !isNaN(numVal) && numVal < threshold;
    }
    return trimmedParent.toLowerCase().includes(s.toLowerCase());
  }

  const vType = ruleConfig.validation_type || 'match';

  if (vType === 'greater') {
    const num = parseFloat(trimmedParent);
    const threshold = Number(ruleConfig.validation);
    return !isNaN(num) && num > threshold;
  }

  if (vType === 'less') {
    const num = parseFloat(trimmedParent);
    const threshold = Number(ruleConfig.validation);
    return !isNaN(num) && num < threshold;
  }

  // match type
  const targetVal = ruleConfig.validation;
  if (targetVal === undefined || targetVal === null) return true;

  if (typeof targetVal === 'object' && !Array.isArray(targetVal)) {
    // e.g. { "Yes": true, "No": false } or { "": true }
    const truthyKeys = Object.entries(targetVal)
      .filter(([_, val]) => Boolean(val))
      .map(([k]) => k.trim());

    if (truthyKeys.length === 0) return false;
    if (truthyKeys.includes('')) return true; // Wildcard non-empty match

    // Match if trimmedParent matches any truthy key (case-insensitive substring or equality)
    return truthyKeys.some((k) => {
      const lowerKey = k.toLowerCase();
      const lowerParent = trimmedParent.toLowerCase();
      return (
        lowerParent === lowerKey ||
        lowerParent.includes(lowerKey) ||
        lowerKey.includes(lowerParent)
      );
    });
  }

  if (Array.isArray(targetVal)) {
    return targetVal.some((item) => {
      const s = String(item).trim().toLowerCase();
      return (
        trimmedParent.toLowerCase() === s ||
        trimmedParent.toLowerCase().includes(s)
      );
    });
  }

  const strTarget = String(targetVal).trim();
  if (strTarget === '') return true;
  if (strTarget.startsWith('>')) {
    const numVal = parseFloat(trimmedParent);
    const threshold = parseFloat(strTarget.slice(1).trim());
    return !isNaN(numVal) && numVal > threshold;
  }
  if (strTarget.startsWith('<')) {
    const numVal = parseFloat(trimmedParent);
    const threshold = parseFloat(strTarget.slice(1).trim());
    return !isNaN(numVal) && numVal < threshold;
  }

  return (
    trimmedParent.toLowerCase() === strTarget.toLowerCase() ||
    trimmedParent.toLowerCase().includes(strTarget.toLowerCase())
  );
}

export const MobilePreviewModal: React.FC<MobilePreviewModalProps> = ({
  isOpen,
  onClose,
  schema,
}) => {
  // Normalize schema input
  const normalized = useMemo(() => normalizeSchema(schema), [schema]);

  // Determine all available groups
  const availableGroups = useMemo(() => {
    const gSet = new Set<number>();
    if (normalized.currentGroup) gSet.add(normalized.currentGroup);
    if (normalized.totalGroups) {
      for (let i = 1; i <= normalized.totalGroups; i++) gSet.add(i);
    }
    normalized.questions.forEach((q) => {
      if (q.group) gSet.add(q.group);
    });
    if (gSet.size === 0) gSet.add(1);
    return Array.from(gSet).sort((a, b) => a - b);
  }, [normalized]);

  // Navigation & state management
  const [currentGroup, setCurrentGroup] = useState<number>(availableGroups[0] || 1);
  const [history, setHistory] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  const formScrollRef = useRef<HTMLDivElement>(null);

  // Sync state whenever schema changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const initialGroup = normalized.currentGroup || availableGroups[0] || 1;
      setCurrentGroup(initialGroup);
      setHistory([]);
      setValidationErrors({});
      setIsCompleted(false);
      setSubmittedMessage(null);
    }
  }, [isOpen, normalized.currentGroup, availableGroups]);

  // Dynamic dependency resolution engine
  const visibleQuestions = useMemo(() => {
    const visible = new Set<number>();
    const allMap = new Map<number, DynamicKycQuestion>();
    normalized.questions.forEach((q) => allMap.set(q.question_id, q));

    function checkVisibility(q: DynamicKycQuestion, visiting: Set<number>): boolean {
      if (visiting.has(q.question_id)) return false; // Break cycles
      visiting.add(q.question_id);

      if (!q.depends_on || q.depends_on.length === 0) {
        return true;
      }

      for (const parentId of q.depends_on) {
        const parentQ = allMap.get(parentId);
        if (parentQ && !checkVisibility(parentQ, new Set(visiting))) {
          return false;
        }

        const parentAns = answers[String(parentId)] || '';
        if (!parentAns || parentAns.trim() === '') {
          return false;
        }

        const rule = q.validation
          ? q.validation[String(parentId)] || (q.validation as any)[parentId]
          : null;
        if (rule && !evaluateRule(rule, parentAns)) {
          return false;
        }
      }

      return true;
    }

    normalized.questions.forEach((q) => {
      if (checkVisibility(q, new Set())) {
        visible.add(q.question_id);
      }
    });

    return visible;
  }, [normalized.questions, answers]);

  // Questions belonging to the currently active page / group
  const currentPageQuestions = useMemo(() => {
    return normalized.questions
      .filter((q) => (q.group || normalized.currentGroup || 1) === currentGroup)
      .filter((q) => visibleQuestions.has(q.question_id));
  }, [normalized.questions, normalized.currentGroup, currentGroup, visibleQuestions]);

  const currentGroupIndex = availableGroups.indexOf(currentGroup);
  const totalSteps = availableGroups.length;
  const progressPercent =
    totalSteps > 0
      ? isCompleted
        ? 100
        : Math.round(((currentGroupIndex + 1) / totalSteps) * 100)
      : 100;

  const hasNextGroup = availableGroups.some((g) => g > currentGroup);
  const canGoBack = history.length > 0 || currentGroupIndex > 0;

  const currentInstruction =
    normalized.groupInstructions[currentGroup] ||
    (currentGroup === normalized.currentGroup ? normalized.instruction : '') ||
    'এই গ্রুপের সব তথ্য পূরণ করে পরবর্তী ধাপে এগিয়ে যান।';

  const currentGroupTitle =
    normalized.groupTitles[currentGroup] || `গ্রুপ ${currentGroup}`;

  if (!isOpen) return null;

  const handleAnswerChange = (qId: number, val: string) => {
    setAnswers((prev) => ({
      ...prev,
      [String(qId)]: val,
    }));
    // Clear validation error when user inputs an answer
    if (validationErrors[String(qId)]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[String(qId)];
        return next;
      });
    }
  };

  const handleNextSubmit = () => {
    // 1. Validate mandatory visible fields ONLY for the current page
    const missing: string[] = [];
    const errors: Record<string, string> = {};

    currentPageQuestions.forEach((q) => {
      if (q.mandatory) {
        const ans = answers[String(q.question_id)];
        if (!ans || ans.trim() === '') {
          missing.push(q.question_bn || q.question);
          errors[String(q.question_id)] = 'এই প্রশ্নটির উত্তর প্রদান আবশ্যক (Mandatory)';
        }
      }
    });

    if (missing.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    // 2. Determine target next group (checking group jumps or next sequential group)
    let targetJumpGroup: number | null = null;
    if (normalized.groupJumps.length > 0) {
      for (const q of currentPageQuestions) {
        const ans = answers[String(q.question_id)];
        if (!ans) continue;
        const matched = normalized.groupJumps.find((j) => {
          const jId = parseInt(j.group_id, 10);
          return (
            jId > currentGroup &&
            (j.group_title?.toLowerCase().includes(ans.toLowerCase()) ||
              j.group_id === ans)
          );
        });
        if (matched) {
          targetJumpGroup = parseInt(matched.group_id, 10);
          break;
        }
      }
    }

    const subsequentGroups = availableGroups.filter((g) => g > currentGroup);
    const nextGroup =
      targetJumpGroup || (subsequentGroups.length > 0 ? subsequentGroups[0] : null);

    if (nextGroup) {
      // Advance to next page / group!
      setHistory((prev) => [...prev, currentGroup]);
      setCurrentGroup(nextGroup);
      setSubmittedMessage(null);
      formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Final group submitted successfully!
      setIsCompleted(true);
      setSubmittedMessage('অভিনন্দন! জরিপ / ঋণ আবেদন সফলভাবে সম্পন্ন হয়েছে!');
    }
  };

  const handleBack = () => {
    if (isCompleted) {
      setIsCompleted(false);
      return;
    }
    if (history.length > 0) {
      const prevGroup = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      setCurrentGroup(prevGroup);
      setValidationErrors({});
      formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentGroupIndex > 0) {
      const prevGroup = availableGroups[currentGroupIndex - 1];
      setCurrentGroup(prevGroup);
      setValidationErrors({});
      formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleReset = () => {
    setAnswers({});
    setValidationErrors({});
    setCurrentGroup(availableGroups[0] || 1);
    setHistory([]);
    setIsCompleted(false);
    setSubmittedMessage(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="mobile-modal"
      icon={<Smartphone size={20} className="text-emerald" />}
      title="Live Android Simulator"
      subtitle="Interactive preview testing multi-page flow, real-time dependency logic and layout"
      headerActions={
        <button className="btn btn-secondary btn-sm" onClick={handleReset}>
          <RotateCcw size={12} />
          <span>Reset State</span>
        </button>
      }
    >
      <div className="modal-body flex-center mobile-simulator-body">
        {/* Smartphone Frame */}
        <div className="phone-device-frame">
          {/* Status bar */}
          <div className="phone-status-bar">
            <span className="phone-time">14:45</span>
            <div className="phone-notch"></div>
            <div className="phone-icons">
              <span className="phone-signal">5G</span>
              <span className="phone-battery">98%</span>
            </div>
          </div>

          {/* Progress Bar indicating group completion */}
          <div className="mobile-progress-bar-container">
            <div
              className="mobile-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Mobile App Bar */}
          <div className="mobile-app-bar">
            <button
              type="button"
              className="mobile-back-icon-btn"
              onClick={handleBack}
              disabled={!canGoBack}
              aria-label="Go Back"
            >
              <ChevronLeft
                size={22}
                className={canGoBack ? 'mobile-back-icon' : 'mobile-back-icon-disabled'}
              />
            </button>
            <div className="mobile-header-title">
              ঋণ আবেদন ({currentGroupTitle})
            </div>
            <div className="mobile-step-pill">
              ধাপ {Math.min(currentGroupIndex + 1, totalSteps)}/{totalSteps}
            </div>
          </div>

          {/* Farmer Profile Card (Sofol Style) */}
          <div className="mobile-profile-card">
            <div className="profile-avatar">কে</div>
            <div className="profile-info">
              <div className="profile-name">করিম মিয়া (Karim Mia)</div>
              <div className="profile-sub">NID: 19852691234567890</div>
              <div className="profile-sub">মোবাইল: 01712345678</div>
            </div>
          </div>

          {/* Completion Celebration View */}
          {isCompleted ? (
            <div className="mobile-completion-view">
              <div className="completion-icon-wrapper">
                <CheckCircle size={38} />
              </div>
              <div className="completion-title">জরিপ সম্পন্ন হয়েছে!</div>
              <div className="completion-subtitle">
                আপনার আবেদন ও জরিপের সকল তথ্য সফলভাবে গ্রহণ করা হয়েছে।
              </div>

              <div className="completion-summary-card">
                <div className="completion-summary-row">
                  <span className="completion-summary-label">মোট গ্রুপ / ধাপ:</span>
                  <span className="completion-summary-value">{totalSteps} টি</span>
                </div>
                <div className="completion-summary-row">
                  <span className="completion-summary-label">উত্তর প্রদানকৃত প্রশ্ন:</span>
                  <span className="completion-summary-value">
                    {Object.keys(answers).length} টি
                  </span>
                </div>
                <div className="completion-summary-row">
                  <span className="completion-summary-label">আবেদনের স্থিতি:</span>
                  <span className="completion-summary-value text-emerald">সম্পূর্ণ (Verified)</span>
                </div>
              </div>

              <div className="completion-btn-group">
                <button
                  type="button"
                  className="btn-review-answers"
                  onClick={() => setIsCompleted(false)}
                >
                  <RotateCw size={14} />
                  <span>উত্তর পর্যালোচনা ও পরিবর্তন করুন</span>
                </button>
                <button
                  type="button"
                  className="btn-restart-survey"
                  onClick={handleReset}
                >
                  <RotateCcw size={14} />
                  <span>নতুন করে শুরু করুন (Reset)</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Instruction Banner */}
              {currentInstruction && (
                <div className="mobile-instruction-card">
                  <div className="instruction-icon">ℹ</div>
                  <div className="instruction-text">{currentInstruction}</div>
                </div>
              )}

              {/* Mobile Form Questions */}
              <div className="mobile-form-scroll" ref={formScrollRef}>
                {currentPageQuestions.length === 0 ? (
                  <div className="mobile-empty-group-notice">
                    <p>এই গ্রুপের প্রশ্নসমূহ পূর্ববর্তী উত্তরের ওপর নির্ভরশীল অথবা বর্তমানে প্রদর্শনের মতো প্রশ্ন নেই।</p>
                  </div>
                ) : (
                  currentPageQuestions.map((q) => {
                    const currentVal = answers[String(q.question_id)] || '';
                    const isLocked = q.editable === false;
                    const errorMsg = validationErrors[String(q.question_id)];
                    const optionsList = parseQuestionOptions(q.options);

                    return (
                      <div
                        key={q.question_id}
                        className={`mobile-question-item ${
                          isLocked ? 'is-locked-question' : ''
                        }`}
                      >
                        {/* Question Title */}
                        <div className="mobile-q-label">
                          {q.question_bn || q.question}
                          {q.mandatory && <span className="text-danger"> *</span>}
                          {isLocked && (
                            <span className="mobile-locked-badge">
                              🔒 লক করা / Read-only
                            </span>
                          )}
                        </div>

                        {/* Hint */}
                        {q.hint && <div className="mobile-q-hint">{q.hint}</div>}

                        {/* Dynamic Widget Rendering */}
                        <div className="mobile-widget-slot">
                          {/* String / Text */}
                          {['string', 'text'].includes(q.answer_type) && (
                            <input
                              type="text"
                              disabled={isLocked}
                              className={`mobile-input-field ${
                                isLocked ? 'field-disabled' : ''
                              } ${errorMsg ? 'field-has-error' : ''}`}
                              placeholder={
                                q.placeholder ||
                                (isLocked ? 'লক করা তথ্য...' : 'এখানে লিখুন...')
                              }
                              value={currentVal}
                              onChange={(e) =>
                                handleAnswerChange(q.question_id, e.target.value)
                              }
                            />
                          )}

                          {/* Integer / Float / Number */}
                          {['integer', 'float', 'number_input'].includes(
                            q.answer_type
                          ) && (
                            <input
                              type="number"
                              disabled={isLocked}
                              className={`mobile-input-field ${
                                isLocked ? 'field-disabled' : ''
                              } ${errorMsg ? 'field-has-error' : ''}`}
                              placeholder={
                                q.placeholder ||
                                (isLocked ? 'লক করা সংখ্যা...' : 'সংখ্যা লিখুন...')
                              }
                              value={currentVal}
                              onChange={(e) =>
                                handleAnswerChange(q.question_id, e.target.value)
                              }
                            />
                          )}

                          {/* Phone */}
                          {q.answer_type === 'phone' && (
                            <div className="mobile-phone-group">
                              <span className="phone-prefix">+88</span>
                              <input
                                type="tel"
                                disabled={isLocked}
                                className={`mobile-input-field phone-input ${
                                  isLocked ? 'field-disabled' : ''
                                } ${errorMsg ? 'field-has-error' : ''}`}
                                placeholder="01XXXXXXXXX"
                                maxLength={11}
                                value={currentVal}
                                onChange={(e) =>
                                  handleAnswerChange(q.question_id, e.target.value)
                                }
                              />
                            </div>
                          )}

                          {/* Dropdown Spinner */}
                          {q.answer_type === 'dropdown' && (
                            <select
                              disabled={isLocked}
                              className={`mobile-select-field ${
                                isLocked ? 'field-disabled' : ''
                              } ${errorMsg ? 'field-has-error' : ''}`}
                              value={currentVal}
                              onChange={(e) =>
                                handleAnswerChange(q.question_id, e.target.value)
                              }
                            >
                              <option value="">
                                {q.placeholder || 'নির্বাচন করুন...'}
                              </option>
                              {optionsList.map((opt, i) => (
                                <option key={i} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          )}

                          {/* Radio / Select One Chips */}
                          {['select_one', 'radio', 'single_radio'].includes(
                            q.answer_type
                          ) && (
                            <div className="mobile-chips-group">
                              {optionsList.map((opt, i) => {
                                const isSelected = currentVal === opt;
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    disabled={isLocked}
                                    className={`mobile-chip ${
                                      isSelected ? 'chip-active' : ''
                                    } ${isLocked ? 'chip-disabled' : ''}`}
                                    onClick={() =>
                                      !isLocked && handleAnswerChange(q.question_id, opt)
                                    }
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Select Multiple Check Chips */}
                          {q.answer_type === 'select_multiple' && (
                            <div className="mobile-chips-group">
                              {optionsList.map((opt, i) => {
                                const currentList = currentVal
                                  ? currentVal.split(',').map((s) => s.trim())
                                  : [];
                                const isSelected = currentList.includes(opt);

                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    disabled={isLocked}
                                    className={`mobile-chip ${
                                      isSelected ? 'chip-active' : ''
                                    } ${isLocked ? 'chip-disabled' : ''}`}
                                    onClick={() => {
                                      if (isLocked) return;
                                      let updated: string[];
                                      if (isSelected) {
                                        updated = currentList.filter((x) => x !== opt);
                                      } else {
                                        updated = [...currentList, opt];
                                      }
                                      handleAnswerChange(
                                        q.question_id,
                                        updated.join(', ')
                                      );
                                    }}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Calendar Date */}
                          {q.answer_type === 'calendar' && (
                            <div className="mobile-date-field">
                              <input
                                type="date"
                                disabled={isLocked}
                                className={`mobile-input-field ${
                                  isLocked ? 'field-disabled' : ''
                                } ${errorMsg ? 'field-has-error' : ''}`}
                                value={currentVal}
                                onChange={(e) =>
                                  handleAnswerChange(q.question_id, e.target.value)
                                }
                              />
                              <Calendar size={18} className="date-icon" />
                            </div>
                          )}

                          {/* Image Upload + GPS */}
                          {q.answer_type === 'image' && (
                            <div className="mobile-image-uploader">
                              <div
                                className={`uploader-tap-area ${
                                  isLocked ? 'uploader-disabled' : ''
                                } ${errorMsg ? 'field-has-error' : ''}`}
                                onClick={() =>
                                  !isLocked &&
                                  handleAnswerChange(
                                    q.question_id,
                                    'farm_photo_mock_upload.webp'
                                  )
                                }
                              >
                                <Camera size={24} className="camera-icon" />
                                <span>
                                  {isLocked
                                    ? 'ছবি পরিবর্তন করা যাবে না (লক করা)'
                                    : 'ক্যামেরা দিয়ে ছবি তুলুন'}
                                </span>
                              </div>

                              {currentVal && (
                                <div className="image-preview-badge">
                                  <CheckCircle size={14} className="text-emerald" />
                                  <span>ছবি সংযুক্ত: {currentVal}</span>
                                </div>
                              )}

                              <div className="gps-indicator">
                                <MapPin size={12} className="text-emerald" />
                                <span>GPS স্থানাঙ্ক: 23.8103° N, 90.4125° E</span>
                              </div>
                            </div>
                          )}

                          {/* Read Only */}
                          {q.answer_type === 'read_only' && (
                            <div className="mobile-readonly-card">
                              ℹ {q.placeholder || 'তথ্য শুধুমাত্র প্রদর্শনের জন্য'}
                            </div>
                          )}

                          {/* In-line Validation Error Banner */}
                          {errorMsg && (
                            <div className="mobile-field-error-msg">
                              <AlertCircle size={12} />
                              <span>{errorMsg}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Submit / Next Button */}
                <div className="mobile-submit-holder">
                  <button
                    type="button"
                    className="mobile-submit-btn"
                    onClick={handleNextSubmit}
                  >
                    {hasNextGroup ? (
                      <span className="flex-center gap-1">
                        <span>পরবর্তী গ্রুপ (Next Group)</span>
                        <ChevronRight size={16} />
                      </span>
                    ) : (
                      <span className="flex-center gap-1">
                        <Check size={16} />
                        <span>আবেদন জমা দিন (Submit Survey)</span>
                      </span>
                    )}
                  </button>
                </div>

                {submittedMessage && (
                  <div className="mobile-success-toast">
                    <CheckCircle size={16} />
                    <span>{submittedMessage}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
