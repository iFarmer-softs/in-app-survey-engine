import React from 'react';
import type { Node, Edge } from '@xyflow/react';
import {
  Sliders,
  Trash2,
  Copy,
  CheckCircle,
  HelpCircle,
  Settings,
  ArrowRight,
  Edit3,
  Lock,
} from 'lucide-react';
import type {
  AnswerType,
  QuestionNodeData,
  DecisionNodeData,
  GroupJumpNodeData,
  ValidationType,
} from '../../types/survey';
import type { GroupMeta } from '../../utils/schemaCompiler';

interface RightSidebarProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  groupMeta: GroupMeta;
  onUpdateNodeData: (nodeId: string, newData: any) => void;
  onUpdateEdgeData: (edgeId: string, newData: any) => void;
  onUpdateGroupMeta: (newMeta: Partial<GroupMeta>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
}

const ANSWER_TYPE_OPTIONS: { value: AnswerType; label: string }[] = [
  { value: 'string', label: 'Text Input (string)' },
  { value: 'text', label: 'Long Text / Textarea (text)' },
  { value: 'integer', label: 'Integer Number (integer)' },
  { value: 'float', label: 'Decimal Number (float)' },
  { value: 'number_input', label: 'Number Input (number_input)' },
  { value: 'phone', label: 'Bangladeshi Phone (phone)' },
  { value: 'dropdown', label: 'Dropdown Spinner (dropdown)' },
  { value: 'select_one', label: 'Radio Chips (select_one)' },
  { value: 'select_multiple', label: 'Multi-Check Chips (select_multiple)' },
  { value: 'single_radio', label: 'Single Radio Toggle (single_radio)' },
  { value: 'calendar', label: 'Date Picker (calendar)' },
  { value: 'image', label: 'Photo + GPS Location (image)' },
  { value: 'read_only', label: 'Read Only Note (read_only)' },
];

export const RightSidebar: React.FC<RightSidebarProps> = ({
  selectedNode,
  selectedEdge,
  groupMeta,
  onUpdateNodeData,
  onUpdateEdgeData,
  onUpdateGroupMeta,
  onDeleteNode,
  onDuplicateNode,
}) => {
  // If an Edge is selected
  if (selectedEdge) {
    const edgeData = (selectedEdge.data as any) || {};
    const valType: ValidationType = edgeData.validationType || 'match';
    const triggerVal = edgeData.triggerValue ?? '';

    const handleRuleChange = (newType: ValidationType, newVal: any) => {
      let label = 'Depends On';
      if (newType === 'match') {
        label = `IF == "${newVal}"`;
      } else if (newType === 'greater') {
        label = `IF > ${newVal}`;
      } else if (newType === 'less') {
        label = `IF < ${newVal}`;
      }

      onUpdateEdgeData(selectedEdge.id, {
        validationType: newType,
        triggerValue: newVal,
        label,
      });
    };

    return (
      <aside className="sidebar right-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title-wrapper">
            <Sliders size={18} className="sidebar-title-icon text-amber" />
            <h2 className="sidebar-title">Edge Rule Inspector</h2>
          </div>
          <p className="sidebar-subtitle">Configure conditional dependency between questions</p>
        </div>

        <div className="inspector-content">
          <div className="edge-connection-badge">
            <span className="edge-node-badge">{selectedEdge.source}</span>
            <ArrowRight size={14} className="text-muted" />
            <span className="edge-node-badge">{selectedEdge.target}</span>
          </div>

          <div className="form-group">
            <label className="form-label">Validation Rule Type</label>
            <select
              className="form-select"
              value={valType}
              onChange={(e) => handleRuleChange(e.target.value as ValidationType, triggerVal)}
            >
              <option value="match">Match Value (equals string/key)</option>
              <option value="greater">Greater Than (&gt; numeric threshold)</option>
              <option value="less">Less Than (&lt; numeric threshold)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              {valType === 'match' ? 'Matching Answer Value' : 'Numeric Threshold'}
            </label>
            <input
              type={valType === 'match' ? 'text' : 'number'}
              className="form-input"
              value={triggerVal}
              onChange={(e) => handleRuleChange(valType, e.target.value)}
              placeholder={valType === 'match' ? 'e.g. হ্যাঁ (Yes)' : 'e.g. 50000'}
            />
            <span className="form-help">
              Child question will only show when parent answer satisfies this rule.
            </span>
          </div>

          <div className="rule-preview-card">
            <div className="preview-title">Generated Logic:</div>
            <div className="preview-rule-code">
              {valType === 'match'
                ? `validation: { "${triggerVal}": true }`
                : `validation: ${triggerVal} (${valType})`}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // If a Node is selected
  if (selectedNode) {
    if (selectedNode.type === 'question') {
      const qData = selectedNode.data as unknown as QuestionNodeData;

      const handleChange = (key: keyof QuestionNodeData, value: any) => {
        onUpdateNodeData(selectedNode.id, {
          ...qData,
          [key]: value,
        });
      };

      const hasOptions = [
        'dropdown',
        'select_one',
        'select_multiple',
        'radio',
      ].includes(qData.answer_type);

      return (
        <aside className="sidebar right-sidebar">
          {/* Header */}
          <div className="sidebar-header flex-between">
            <div>
              <div className="sidebar-title-wrapper">
                <Sliders size={18} className="sidebar-title-icon text-emerald" />
                <h2 className="sidebar-title">Question Inspector</h2>
              </div>
              <p className="sidebar-subtitle">Question #{qData.question_id}</p>
            </div>
            <div className="inspector-actions">
              <button
                className="icon-action-btn"
                onClick={() => onDuplicateNode(selectedNode.id)}
                title="Duplicate Question"
              >
                <Copy size={15} />
              </button>
              <button
                className="icon-action-btn text-danger"
                onClick={() => onDeleteNode(selectedNode.id)}
                title="Delete Question"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div className="inspector-content">
            {/* Question ID & Answer Type */}
            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label">Question ID</label>
                <input
                  type="number"
                  className="form-input"
                  value={qData.question_id}
                  onChange={(e) =>
                    handleChange('question_id', parseInt(e.target.value) || 0)
                  }
                />
              </div>

              <div className="form-group flex-1">
                <label className="form-label">Mandatory?</label>
                <div
                  className={`toggle-pill ${qData.mandatory ? 'is-checked' : ''}`}
                  onClick={() => handleChange('mandatory', !qData.mandatory)}
                >
                  <CheckCircle size={14} />
                  <span>{qData.mandatory ? 'Required *' : 'Optional'}</span>
                </div>
              </div>

              <div className="form-group flex-1">
                <label className="form-label">Editable?</label>
                <div
                  className={`toggle-pill ${
                    (qData.editable ?? true) ? 'is-checked' : 'is-locked'
                  }`}
                  onClick={() => handleChange('editable', !(qData.editable ?? true))}
                  title="Allow facilitator to edit or lock field as read-only"
                >
                  {(qData.editable ?? true) ? (
                    <>
                      <Edit3 size={14} />
                      <span>Editable</span>
                    </>
                  ) : (
                    <>
                      <Lock size={14} />
                      <span>Locked</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Answer Type */}
            <div className="form-group">
              <label className="form-label">Answer Widget Type</label>
              <select
                className="form-select"
                value={qData.answer_type}
                onChange={(e) =>
                  handleChange('answer_type', e.target.value as AnswerType)
                }
              >
                {ANSWER_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Question Labels */}
            <div className="form-group">
              <label className="form-label">Bengali Label (question_bn)</label>
              <input
                type="text"
                className="form-input bn-font"
                value={qData.question_bn || ''}
                onChange={(e) => handleChange('question_bn', e.target.value)}
                placeholder="যেমন: কৃষকের মোট জমি কত?"
              />
            </div>

            <div className="form-group">
              <label className="form-label">English Label (question)</label>
              <input
                type="text"
                className="form-input"
                value={qData.question || ''}
                onChange={(e) => handleChange('question', e.target.value)}
                placeholder="e.g. Farmer Total Land Size"
              />
            </div>

            {/* Options list for choice widgets */}
            {hasOptions && (
              <div className="form-group">
                <label className="form-label">Options (Comma separated)</label>
                <textarea
                  className="form-textarea bn-font"
                  rows={2}
                  value={qData.options || ''}
                  onChange={(e) => handleChange('options', e.target.value)}
                  placeholder="হ্যাঁ (Yes), না (No)"
                />
                <div className="quick-presets">
                  <span className="preset-label">Presets:</span>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => handleChange('options', 'হ্যাঁ (Yes), না (No)')}
                  >
                    Yes/No
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() =>
                      handleChange('options', 'ধান, ভুট্টা, আলু, সবজি, মাছ চাষ')
                    }
                  >
                    Crops
                  </button>
                </div>
              </div>
            )}

            {/* Placeholder & Hint */}
            <div className="form-group">
              <label className="form-label">Placeholder</label>
              <input
                type="text"
                className="form-input"
                value={qData.placeholder || ''}
                onChange={(e) => handleChange('placeholder', e.target.value)}
                placeholder="e.g. নির্বাচন করুন or ৫০"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hint / Helper Text</label>
              <input
                type="text"
                className="form-input bn-font"
                value={qData.hint || ''}
                onChange={(e) => handleChange('hint', e.target.value)}
                placeholder="সহায়ক নির্দেশনা"
              />
            </div>

            {/* Default Value */}
            <div className="form-group">
              <label className="form-label">Pre-filled Value</label>
              <input
                type="text"
                className="form-input"
                value={qData.value || ''}
                onChange={(e) => handleChange('value', e.target.value)}
                placeholder="Leave blank if empty"
              />
            </div>
          </div>
        </aside>
      );
    }

    if (selectedNode.type === 'decision') {
      const decData = selectedNode.data as unknown as DecisionNodeData;
      return (
        <aside className="sidebar right-sidebar">
          <div className="sidebar-header flex-between">
            <div>
              <div className="sidebar-title-wrapper">
                <Sliders size={18} className="sidebar-title-icon text-amber" />
                <h2 className="sidebar-title">Decision Branch</h2>
              </div>
              <p className="sidebar-subtitle">Condition Node</p>
            </div>
            <button
              className="icon-action-btn text-danger"
              onClick={() => onDeleteNode(selectedNode.id)}
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="inspector-content">
            <div className="form-group">
              <label className="form-label">Decision Label</label>
              <input
                type="text"
                className="form-input"
                value={decData.label || ''}
                onChange={(e) =>
                  onUpdateNodeData(selectedNode.id, {
                    ...decData,
                    label: e.target.value,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Condition Rule</label>
              <select
                className="form-select"
                value={decData.conditionType}
                onChange={(e) =>
                  onUpdateNodeData(selectedNode.id, {
                    ...decData,
                    conditionType: e.target.value as ValidationType,
                  })
                }
              >
                <option value="match">Match (Equals Value)</option>
                <option value="greater">Greater Than (&gt;)</option>
                <option value="less">Less Than (&lt;)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Comparison Value</label>
              <input
                type="text"
                className="form-input"
                value={decData.comparisonValue || ''}
                onChange={(e) =>
                  onUpdateNodeData(selectedNode.id, {
                    ...decData,
                    comparisonValue: e.target.value,
                  })
                }
                placeholder="e.g. হ্যাঁ (Yes) or 20000"
              />
            </div>
          </div>
        </aside>
      );
    }

    if (selectedNode.type === 'groupJump') {
      const jumpData = selectedNode.data as unknown as GroupJumpNodeData;
      return (
        <aside className="sidebar right-sidebar">
          <div className="sidebar-header flex-between">
            <div>
              <div className="sidebar-title-wrapper">
                <Sliders size={18} className="sidebar-title-icon text-indigo" />
                <h2 className="sidebar-title">Group Jump</h2>
              </div>
              <p className="sidebar-subtitle">Jump target configuration</p>
            </div>
            <button
              className="icon-action-btn text-danger"
              onClick={() => onDeleteNode(selectedNode.id)}
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="inspector-content">
            <div className="form-group">
              <label className="form-label">Target Group ID</label>
              <input
                type="number"
                className="form-input"
                value={jumpData.targetGroupId}
                onChange={(e) =>
                  onUpdateNodeData(selectedNode.id, {
                    ...jumpData,
                    targetGroupId: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Target Group Title</label>
              <input
                type="text"
                className="form-input"
                value={jumpData.targetGroupTitle || ''}
                onChange={(e) =>
                  onUpdateNodeData(selectedNode.id, {
                    ...jumpData,
                    targetGroupTitle: e.target.value,
                  })
                }
                placeholder="2: কৃষি প্রকল্প ও সম্পদ তথ্য"
              />
            </div>
          </div>
        </aside>
      );
    }
  }

  // Default: Group Metadata Settings
  return (
    <aside className="sidebar right-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-wrapper">
          <Settings size={18} className="sidebar-title-icon text-emerald" />
          <h2 className="sidebar-title">Group Settings</h2>
        </div>
        <p className="sidebar-subtitle">Survey group parameters & metadata</p>
      </div>

      <div className="inspector-content">
        <div className="form-row">
          <div className="form-group flex-1">
            <label className="form-label">Current Group #</label>
            <input
              type="number"
              className="form-input"
              value={groupMeta.groupNumber}
              onChange={(e) =>
                onUpdateGroupMeta({ groupNumber: parseInt(e.target.value) || 1 })
              }
            />
          </div>

          <div className="form-group flex-1">
            <label className="form-label">Total Groups</label>
            <input
              type="number"
              className="form-input"
              value={groupMeta.totalGroups}
              onChange={(e) =>
                onUpdateGroupMeta({ totalGroups: parseInt(e.target.value) || 1 })
              }
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Next Group Available?</label>
          <div
            className={`toggle-pill ${groupMeta.hasNextGroup ? 'is-checked' : ''}`}
            onClick={() =>
              onUpdateGroupMeta({ hasNextGroup: !groupMeta.hasNextGroup })
            }
          >
            <CheckCircle size={14} />
            <span>{groupMeta.hasNextGroup ? 'Next Group Exists (true)' : 'Last Step / Submit (false)'}</span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Group Instruction (Bengali)</label>
          <textarea
            className="form-textarea bn-font"
            rows={3}
            value={groupMeta.instruction}
            onChange={(e) => onUpdateGroupMeta({ instruction: e.target.value })}
            placeholder="গ্রুপের সারসংক্ষেপ বা সাধারণ নির্দেশাবলী..."
          />
        </div>

        <div className="info-tip-box">
          <HelpCircle size={16} className="tip-icon" />
          <div className="tip-text">
            Click on any question node or connecting line in the canvas to inspect its validation rules.
          </div>
        </div>
      </div>
    </aside>
  );
};
