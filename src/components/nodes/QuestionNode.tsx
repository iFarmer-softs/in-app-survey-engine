import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Type,
  AlignLeft,
  Hash,
  Phone,
  ListFilter,
  CheckSquare,
  Radio,
  Calendar,
  Image,
  Eye,
  AlertCircle,
  HelpCircle,
  GitBranch,
  Edit3,
  Lock,
} from 'lucide-react';
import type { QuestionNodeData, AnswerType } from '../../types/survey';

const WIDGET_CONFIG: Record<
  AnswerType,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  string: {
    label: 'Text Input',
    icon: <Type size={14} />,
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.1)',
  },
  text: {
    label: 'Long Text',
    icon: <AlignLeft size={14} />,
    color: '#0369a1',
    bg: 'rgba(3, 105, 161, 0.1)',
  },
  integer: {
    label: 'Integer',
    icon: <Hash size={14} />,
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.1)',
  },
  float: {
    label: 'Float/Decimal',
    icon: <Hash size={14} />,
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.1)',
  },
  number_input: {
    label: 'Number Input',
    icon: <Hash size={14} />,
    color: '#6d28d9',
    bg: 'rgba(109, 40, 217, 0.1)',
  },
  phone: {
    label: 'Phone (BD)',
    icon: <Phone size={14} />,
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.1)',
  },
  dropdown: {
    label: 'Dropdown',
    icon: <ListFilter size={14} />,
    color: '#ea580c',
    bg: 'rgba(234, 88, 12, 0.1)',
  },
  select_one: {
    label: 'Radio Chips',
    icon: <Radio size={14} />,
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.1)',
  },
  radio: {
    label: 'Radio',
    icon: <Radio size={14} />,
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.1)',
  },
  single_radio: {
    label: 'Single Toggle',
    icon: <Radio size={14} />,
    color: '#b45309',
    bg: 'rgba(180, 83, 9, 0.1)',
  },
  select_multiple: {
    label: 'Multi-Check Chips',
    icon: <CheckSquare size={14} />,
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.1)',
  },
  calendar: {
    label: 'Date Picker',
    icon: <Calendar size={14} />,
    color: '#db2777',
    bg: 'rgba(219, 39, 119, 0.1)',
  },
  image: {
    label: 'Photo + GPS',
    icon: <Image size={14} />,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.1)',
  },
  read_only: {
    label: 'Read Only Note',
    icon: <Eye size={14} />,
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.1)',
  },
};

const OPTION_BASED_TYPES: AnswerType[] = [
  'dropdown',
  'select_one',
  'select_multiple',
  'radio',
  'single_radio',
];

export const QuestionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as QuestionNodeData;
  const widget = WIDGET_CONFIG[nodeData.answer_type] || WIDGET_CONFIG.string;

  const hasOptions =
    OPTION_BASED_TYPES.includes(nodeData.answer_type) &&
    Boolean(nodeData.options && nodeData.options.trim().length > 0);

  const optionsList = hasOptions
    ? nodeData.options!
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0)
    : [];

  return (
    <div className={`survey-node question-node ${selected ? 'is-selected' : ''}`}>
      {/* Top Handle for Incoming Connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="node-handle target-handle"
      />

      {/* Header with ID and Widget Badge */}
      <div className="node-header">
        <div className="node-id-badge">
          <span>Q#{nodeData.question_id}</span>
        </div>
        <div
          className="node-widget-badge"
          style={{ color: widget.color, backgroundColor: widget.bg }}
        >
          {widget.icon}
          <span>{widget.label}</span>
        </div>
      </div>

      {/* Question Titles (Bangla & English) */}
      <div className="node-content">
        <div className="node-title-bn">
          {nodeData.question_bn || 'প্রশ্ন উল্লেখ করুন'}
          {nodeData.mandatory && <span className="mandatory-mark"> *</span>}
        </div>
        {nodeData.question && (
          <div className="node-title-en">{nodeData.question}</div>
        )}
      </div>

      {/* Nested Option Branches: Each option has its own outgoing handle! */}
      {optionsList.length > 0 && (
        <div className="node-options-container">
          <div className="node-options-header">
            <GitBranch size={12} className="text-amber" />
            <span>Option Branch Ports (Nested Flows):</span>
          </div>
          <div className="node-options-list">
            {optionsList.map((opt, optIdx) => {
              const handleId = `opt-${encodeURIComponent(opt)}`;
              return (
                <div key={optIdx} className="node-option-item">
                  <div className="option-name-box">
                    <span className="option-dot"></span>
                    <span className="option-text bn-font" title={opt}>
                      {opt}
                    </span>
                  </div>
                  <div className="option-action-hint">
                    <span className="option-branch-pill">Connect Sub-flow →</span>
                  </div>
                  {/* Dedicated Output Port per Option */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={handleId}
                    className="node-handle option-branch-handle"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Extra metadata preview */}
      <div className="node-footer">
        {nodeData.hint && (
          <div className="node-meta-tag hint-tag" title={nodeData.hint}>
            <HelpCircle size={10} />
            <span>Hint</span>
          </div>
        )}
        {nodeData.mandatory && (
          <div className="node-meta-tag mandatory-tag">
            <AlertCircle size={10} />
            <span>Required *</span>
          </div>
        )}
        {nodeData.editable === false ? (
          <div className="node-meta-tag locked-tag" title="Question is locked (read-only) in mobile app">
            <Lock size={10} />
            <span>Locked (Non-editable)</span>
          </div>
        ) : (
          <div className="node-meta-tag editable-tag" title="Question is editable by facilitator">
            <Edit3 size={10} />
            <span>Editable</span>
          </div>
        )}
      </div>

      {/* Default/Unconditional Output Handle at Bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default-next"
        className="node-handle source-handle"
      />
    </div>
  );
});

QuestionNode.displayName = 'QuestionNode';
