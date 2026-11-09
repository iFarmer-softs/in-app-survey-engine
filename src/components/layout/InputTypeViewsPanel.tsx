import React, { useState } from 'react';
import { MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import {
  Type,
  AlignLeft,
  Hash,
  Phone,
  ListFilter,
  Radio,
  CheckSquare,
  Calendar,
  Image,
  Eye,
  Sliders,
  Trash2,
  Copy,
  CheckCircle,
  ArrowRight,
  GripVertical,
  HelpCircle,
  LayoutGrid,
  GitBranch,
  Plus,
  Edit3,
  Lock,
  FastForward,
  CheckCircle2,
  Ban,
  Sparkles,
  EyeOff,
  PanelRightClose,
  Tag,
  ChevronDown,
  ChevronUp,
  Network,
  Database,
  Link2,
  GitFork,
  Layers,
} from 'lucide-react';
import type {
  AnswerType,
  QuestionNodeData,
  ValidationType,
  GroupJumpNodeData,
} from '../../types/survey';
import type { ReusableQuestionGroup } from '../../types/group';
import type { GroupMeta } from '../../utils/schemaCompiler';
import { resolveNodeGroupId, isNodeInContainer } from '../../utils/flowValidator';
import {
  calculateDependencyTrace,
  getNodeTraceLabel,
} from '../../utils/dependencyTracing';

interface InputTypeItem {
  type: AnswerType;
  title: string;
  titleBn: string;
  badge: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  defaultOptions?: string;
}

const INPUT_TYPE_VIEWS: InputTypeItem[] = [
  {
    type: 'string',
    title: 'Text / String Input',
    titleBn: 'সাধারণ টেক্সট ইনপুট',
    badge: 'string',
    icon: <Type size={16} />,
    color: '#0284c7',
    description: 'Single-line text for names, IDs, or short text',
  },
  {
    type: 'text',
    title: 'Long Text Area',
    titleBn: 'বড় টেক্সট / বিবরণ',
    badge: 'text',
    icon: <AlignLeft size={16} />,
    color: '#0369a1',
    description: 'Multi-line comments, farm address, remarks',
  },
  {
    type: 'integer',
    title: 'Integer Number',
    titleBn: 'পূর্ণসংখ্যা ইনপুট',
    badge: 'integer',
    icon: <Hash size={16} />,
    color: '#7c3aed',
    description: 'Whole numbers (land size, loan amount in BDT)',
  },
  {
    type: 'float',
    title: 'Decimal / Float',
    titleBn: 'দশমিক সংখ্যা',
    badge: 'float',
    icon: <Hash size={16} />,
    color: '#8b5cf6',
    description: 'Decimals (interest percentage, acres)',
  },
  {
    type: 'phone',
    title: 'Bangladeshi Phone',
    titleBn: 'বাংলাদেশী মোবাইল নম্বর',
    badge: 'phone',
    icon: <Phone size={16} />,
    color: '#059669',
    description: '11-digit mobile validated with Bangladeshi regex',
  },
  {
    type: 'dropdown',
    title: 'Dropdown Spinner',
    titleBn: 'ড্রপডাউন অপশন মেনু',
    badge: 'dropdown',
    icon: <ListFilter size={16} />,
    color: '#ea580c',
    description: 'Single selection dropdown modal/spinner',
    defaultOptions: 'অপশন ১, অপশন ২, অপশন ৩',
  },
  {
    type: 'select_one',
    title: 'Radio Chips (Select One)',
    titleBn: 'রেডিও বাটন চিপস',
    badge: 'select_one',
    icon: <Radio size={16} />,
    color: '#d97706',
    description: 'Single-choice pill buttons with instant tap',
    defaultOptions: 'হ্যাঁ (Yes), না (No)',
  },
  {
    type: 'select_multiple',
    title: 'Multi-Select Checkboxes',
    titleBn: 'একাধিক নির্বাচন চিপস',
    badge: 'select_multiple',
    icon: <CheckSquare size={16} />,
    color: '#2563eb',
    description: 'Multiple selection chips (e.g. crop types)',
    defaultOptions: 'ধান, গম, আলু, ভুট্টা, সবজি',
  },
  {
    type: 'calendar',
    title: 'Calendar Date Picker',
    titleBn: 'ক্যালেন্ডার তারিখ',
    badge: 'calendar',
    icon: <Calendar size={16} />,
    color: '#db2777',
    description: 'DatePickerDialog for birthdays or sowing dates',
  },
  {
    type: 'image',
    title: 'Photo Upload + GPS',
    titleBn: 'ছবি আপলোড ও লোকেশন',
    badge: 'image',
    icon: <Image size={16} />,
    color: '#10b981',
    description: 'Camera image with WebP compression & GPS check',
  },
  {
    type: 'read_only',
    title: 'Read Only Note',
    titleBn: 'শুধুমাত্র পড়ার নোট',
    badge: 'read_only',
    icon: <Eye size={16} />,
    color: '#64748b',
    description: 'Non-editable contextual prompt or verified info',
  },
];

interface InputTypeViewsPanelProps {
  isOpen?: boolean;
  width?: number;
  isResizing?: boolean;
  onToggleCollapse?: () => void;
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  nodes?: Node[];
  edges: Edge[];
  groups?: ReusableQuestionGroup[];
  groupMeta: GroupMeta;
  onUpdateNodeData: (nodeId: string, newData: any) => void;
  onUpdateEdgeData: (edgeId: string, newData: any) => void;
  onUpdateGroupMeta: (newMeta: Partial<GroupMeta>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onAddNestedQuestion?: (parentNodeId: string, optionValue: string) => void;
  onAddQuestion?: (
    answerType: AnswerType,
    name: string,
    nameBn: string,
    options?: string
  ) => void;
  onAddEdge?: (edge: Edge) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onFocusNode?: (nodeId: string) => void;
}

export const InputTypeViewsPanel: React.FC<InputTypeViewsPanelProps> = ({
  isOpen = true,
  width,
  isResizing,
  onToggleCollapse,
  selectedNode,
  selectedEdge,
  nodes = [],
  edges,
  groups = [],
  groupMeta,
  onUpdateNodeData,
  onUpdateEdgeData,
  onUpdateGroupMeta,
  onDeleteNode,
  onDuplicateNode,
  onAddNestedQuestion,
  onAddQuestion,
  onAddEdge,
  onDeleteEdge,
  onFocusNode,
}) => {
  // Store active tab and track selection transitions during render
  const [tab, setTab] = useState<'widgets' | 'inspector'>(
    selectedNode || selectedEdge ? 'inspector' : 'widgets'
  );
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(
    selectedNode?.id || selectedEdge?.id || null
  );

  // Cross-Group Foreign Dependency Builder State (MySQL Workbench style)
  const [isCrossGroupBuilderOpen, setIsCrossGroupBuilderOpen] = useState(false);
  const [crossSourceGroupId, setCrossSourceGroupId] = useState<number | ''>('');
  const [crossSourceQuestionId, setCrossSourceQuestionId] = useState<string>('');
  const [crossValType, setCrossValType] = useState<ValidationType>('match');
  const [crossTriggerValue, setCrossTriggerValue] = useState<string>('');

  const currentSelectedId = selectedNode?.id || selectedEdge?.id || null;
  if (currentSelectedId !== prevSelectedId) {
    setPrevSelectedId(currentSelectedId);
    if (currentSelectedId) {
      setTab('inspector');
    }
  }

  const activeTab = tab;
  const setActiveTab = setTab;

  const onDragStart = (event: React.DragEvent, item: InputTypeItem) => {
    const payload = JSON.stringify({
      nodeType: 'question',
      answerType: item.type,
      name: item.title,
      nameBn: item.titleBn,
      options: item.defaultOptions || '',
    });
    event.dataTransfer.setData('application/reactflow-node', payload);
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleApplyAnswerType = (item: InputTypeItem) => {
    if (selectedNode && selectedNode.type === 'question') {
      const qData = selectedNode.data as unknown as QuestionNodeData;
      onUpdateNodeData(selectedNode.id, {
        ...qData,
        answer_type: item.type,
        options: qData.options || item.defaultOptions || '',
      });
    } else if (onAddQuestion) {
      onAddQuestion(item.type, item.title, item.titleBn, item.defaultOptions);
    }
  };

  return (
    <aside
      className={`sidebar right-sidebar input-types-sidebar ${!isOpen ? 'is-collapsed' : ''} ${isResizing ? 'is-resizing' : ''
        }`}
      style={isOpen && width ? { width: `${width}px`, minWidth: `${width}px` } : undefined}
    >
      {/* Sidebar Header with Switcher Tabs */}
      <div className="sidebar-header">
        <div className="input-panel-tabs" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className={`panel-tab-btn ${activeTab === 'widgets' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('widgets')}
          >
            <LayoutGrid size={14} />
            <span>Input Type Views</span>
          </button>
          <button
            className={`panel-tab-btn ${activeTab === 'inspector' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('inspector')}
          >
            <Sliders size={14} />
            <span>
              {selectedNode
                ? selectedNode.type === 'question'
                  ? 'Question Inspector'
                  : selectedNode.type === 'groupContainer' || selectedNode.type === 'groupFrame'
                    ? 'Question Group Inspector'
                    : selectedNode.type === 'decision'
                      ? 'Decision Inspector'
                      : selectedNode.type === 'groupJump'
                        ? 'Jump Inspector'
                        : 'Node Inspector'
                : selectedEdge
                  ? 'Rule Inspector'
                  : 'Group Settings'}
            </span>
          </button>

          {onToggleCollapse && (
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={onToggleCollapse}
              title="Collapse Inspector (Ctrl+J)"
              style={{ marginLeft: 'auto' }}
            >
              <PanelRightClose size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Input Type Views Palette */}
      {activeTab === 'widgets' && (
        <div className="palette-container">
          <div className="palette-intro">
            <span className="intro-title">Question Input Widgets</span>
            <span className="intro-sub">
              Drag onto the canvas to add an input view, or click to apply to selected question.
            </span>
          </div>

          <div className="input-types-grid">
            {INPUT_TYPE_VIEWS.map((item) => (
              <div
                key={item.type}
                className={`input-type-card ${selectedNode &&
                  selectedNode.type === 'question' &&
                  (selectedNode.data as any).answer_type === item.type
                  ? 'is-current-type'
                  : ''
                  }`}
                draggable
                onDragStart={(e) => onDragStart(e, item)}
                onClick={() => handleApplyAnswerType(item)}
                title="Drag onto canvas or click to apply to selected question"
              >
                <div className="card-drag-indicator">
                  <GripVertical size={12} />
                </div>

                <div
                  className="input-type-icon-box"
                  style={{ color: item.color, backgroundColor: `${item.color}15` }}
                >
                  {item.icon}
                </div>

                <div className="input-type-info">
                  <div className="input-type-name-row">
                    <span className="input-type-name">{item.title}</span>
                    <span
                      className="input-type-badge"
                      style={{ color: item.color, backgroundColor: `${item.color}15` }}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <span className="input-type-bn">{item.titleBn}</span>
                  <span className="input-type-desc">{item.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Property Inspector */}
      {activeTab === 'inspector' && (
        <div className="inspector-content">
          {/* If Edge Selected */}
          {selectedEdge && (() => {
            const edgeData = (selectedEdge.data as any) || {};

            return (
              <div className="edge-inspector-block">
                <div className="flex-between">
                  <span className="text-secondary font-mono text-xs">
                    Link: {selectedEdge.source} ➔ {selectedEdge.target}
                  </span>
                  {onDeleteEdge && (
                    <button
                      className="icon-action-btn text-danger"
                      onClick={() => onDeleteEdge(selectedEdge.id)}
                      title="Delete Link"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Connection Endpoints */}
                <div className="edge-connection-badge">
                  <div className="edge-endpoint-desc">
                    <span className="edge-node-badge">{selectedEdge.source}</span>
                    <span className="edge-handle-tag">
                      {selectedEdge.sourceHandle || 'source'}
                    </span>
                  </div>
                  <ArrowRight size={14} className="text-muted" />
                  <div className="edge-endpoint-desc">
                    <span className="edge-node-badge">{selectedEdge.target}</span>
                    <span className="edge-handle-tag">
                      {selectedEdge.targetHandle || 'target'}
                    </span>
                  </div>
                </div>

                <div className="edge-reconnect-hint">
                  💡 <strong>Tip:</strong> Drag line endpoints on canvas to re-anchor to any of the 8 ports.
                </div>

                <div className="form-group">
                  <label className="form-label">Validation Rule Type</label>
                  <select
                    className="form-select"
                    value={edgeData.validationType || 'match'}
                    onChange={(e) => {
                      const newType = e.target.value as ValidationType;
                      const triggerVal = edgeData.triggerValue || '';
                      let label = 'Depends On';
                      if (newType === 'match') label = `IF == "${triggerVal}"`;
                      else if (newType === 'greater') label = `IF > ${triggerVal}`;
                      else if (newType === 'less') label = `IF < ${triggerVal}`;
                      onUpdateEdgeData(selectedEdge.id, {
                        ...edgeData,
                        validationType: newType,
                        triggerValue: triggerVal,
                        label,
                      });
                    }}
                  >
                    <option value="match">Match Value (equals string)</option>
                    <option value="greater">Greater Than (&gt; number)</option>
                    <option value="less">Less Than (&lt; number)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Answer Value</label>
                  <input
                    type="text"
                    className="form-input"
                    value={edgeData.triggerValue ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const valType = edgeData.validationType || 'match';
                      let label = 'Depends On';
                      if (valType === 'match') label = `IF == "${val}"`;
                      else if (valType === 'greater') label = `IF > ${val}`;
                      else if (valType === 'less') label = `IF < ${val}`;
                      onUpdateEdgeData(selectedEdge.id, {
                        ...edgeData,
                        triggerValue: val,
                        label,
                      });
                    }}
                    placeholder="e.g. হ্যাঁ (Yes) or 50000"
                  />
                </div>

                <div className="rule-preview-card">
                  <div className="preview-title">Generated Logic:</div>
                  <div className="preview-rule-code">
                    {edgeData.validationType === 'match'
                      ? `validation: { "${edgeData.triggerValue}": true }`
                      : `validation: ${edgeData.triggerValue} (${edgeData.validationType})`}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* If Question Node Selected */}
          {selectedNode && selectedNode.type === 'question' && (
            <div className="node-inspector-block">
              <div className="flex-between">
                <div>
                  <span className="text-secondary font-mono text-xs">
                    ID: {(selectedNode.data as any).question_id}
                  </span>
                </div>
                <div className="inspector-actions">
                  <button
                    className="icon-action-btn"
                    onClick={() => onDuplicateNode(selectedNode.id)}
                    title="Duplicate"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="icon-action-btn text-danger"
                    onClick={() => onDeleteNode(selectedNode.id)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Question ID & Group Display Order */}
              <div className="form-row-2">
                <div className="form-group flex-1">
                  <label className="form-label">Question ID</label>
                  <input
                    type="number"
                    className="form-input"
                    value={(selectedNode.data as any).question_id}
                    onChange={(e) =>
                      onUpdateNodeData(selectedNode.id, {
                        ...selectedNode.data,
                        question_id: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="form-group flex-1">
                  <label className="form-label">Display Order</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 1"
                    value={(selectedNode.data as any).group_display_order ?? ''}
                    onChange={(e) =>
                      onUpdateNodeData(selectedNode.id, {
                        ...selectedNode.data,
                        group_display_order:
                          e.target.value === '' ? undefined : parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              {/* Question Level Flags: Mandatory, Editable, Active, Auto-filled, Hidden */}
              <div style={{ marginTop: 10, marginBottom: 6 }}>
                <span className="text-secondary font-mono text-xs font-semibold" style={{ letterSpacing: '0.5px' }}>
                  QUESTION VALIDATION & FLAGS
                </span>
              </div>

              <div className="form-row-2" style={{ marginBottom: 6 }}>
                <div className="form-group flex-1">
                  <label className="form-label">Mandatory?</label>
                  <div
                    className={`toggle-pill ${(selectedNode.data as any).mandatory ? 'is-checked' : ''
                      }`}
                    onClick={() =>
                      onUpdateNodeData(selectedNode.id, {
                        ...selectedNode.data,
                        mandatory: !(selectedNode.data as any).mandatory,
                      })
                    }
                    title="Toggle required status"
                  >
                    <CheckCircle size={14} />
                    <span>
                      {(selectedNode.data as any).mandatory ? 'Required *' : 'Optional'}
                    </span>
                  </div>
                </div>

                <div className="form-group flex-1">
                  <label className="form-label">Editable?</label>
                  <div
                    className={`toggle-pill ${((selectedNode.data as any).editable ?? true) ? 'is-checked' : 'is-locked'
                      }`}
                    onClick={() =>
                      onUpdateNodeData(selectedNode.id, {
                        ...selectedNode.data,
                        editable: !((selectedNode.data as any).editable ?? true),
                      })
                    }
                    title="Toggle whether facilitator can edit or if value is locked (read-only)"
                  >
                    {((selectedNode.data as any).editable ?? true) ? (
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

              <div className="form-row-2" style={{ marginBottom: 6 }}>
                <div className="form-group flex-1">
                  <label className="form-label">Active Status?</label>
                  <div
                    className={`toggle-pill ${((selectedNode.data as any).active ?? true) ? 'is-checked' : 'is-locked'
                      }`}
                    onClick={() =>
                      onUpdateNodeData(selectedNode.id, {
                        ...selectedNode.data,
                        active: !((selectedNode.data as any).active ?? true),
                      })
                    }
                    title="Toggle whether question is actively evaluated in this survey"
                  >
                    {((selectedNode.data as any).active ?? true) ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <Ban size={14} />
                        <span>Inactive</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="form-group flex-1">
                  <label className="form-label">Auto-filled?</label>
                  <div
                    className={`toggle-pill ${(selectedNode.data as any).auto_filled ? 'is-purple' : ''
                      }`}
                    onClick={() =>
                      onUpdateNodeData(selectedNode.id, {
                        ...selectedNode.data,
                        auto_filled: !(selectedNode.data as any).auto_filled,
                      })
                    }
                    title="Indicates whether this field is pre-filled from farmer records"
                  >
                    <Sparkles size={14} />
                    <span>
                      {(selectedNode.data as any).auto_filled ? 'Auto-filled' : 'Manual Input'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: 10 }}>
                <div className="form-group flex-1">
                  <label className="form-label">Initial Visibility</label>
                  <div
                    className={`toggle-pill ${(selectedNode.data as any).hidden ? 'is-amber' : ''
                      }`}
                    onClick={() =>
                      onUpdateNodeData(selectedNode.id, {
                        ...selectedNode.data,
                        hidden: !(selectedNode.data as any).hidden,
                      })
                    }
                    title="When true, starts hidden until triggered by conditional logic"
                  >
                    {(selectedNode.data as any).hidden ? (
                      <>
                        <EyeOff size={14} />
                        <span>Hidden on Start</span>
                      </>
                    ) : (
                      <>
                        <Eye size={14} />
                        <span>Visible on Start</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Answer Widget Type</label>
                <select
                  className="form-select"
                  value={(selectedNode.data as any).answer_type}
                  onChange={(e) =>
                    onUpdateNodeData(selectedNode.id, {
                      ...selectedNode.data,
                      answer_type: e.target.value as AnswerType,
                    })
                  }
                >
                  {INPUT_TYPE_VIEWS.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {opt.title} ({opt.badge})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Bengali Label (question_bn)</label>
                <input
                  type="text"
                  className="form-input bn-font"
                  value={(selectedNode.data as any).question_bn || ''}
                  onChange={(e) =>
                    onUpdateNodeData(selectedNode.id, {
                      ...selectedNode.data,
                      question_bn: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">English Label (question)</label>
                <input
                  type="text"
                  className="form-input"
                  value={(selectedNode.data as any).question || ''}
                  onChange={(e) =>
                    onUpdateNodeData(selectedNode.id, {
                      ...selectedNode.data,
                      question: e.target.value,
                    })
                  }
                />
              </div>

              {['dropdown', 'select_one', 'select_multiple', 'radio'].includes(
                (selectedNode.data as any).answer_type
              ) && (
                  <div className="form-group">
                    <label className="form-label">Options (Comma separated)</label>
                    <textarea
                      className="form-textarea bn-font"
                      rows={2}
                      value={(selectedNode.data as any).options || ''}
                      onChange={(e) =>
                        onUpdateNodeData(selectedNode.id, {
                          ...selectedNode.data,
                          options: e.target.value,
                        })
                      }
                    />
                    <div className="quick-presets">
                      <span className="preset-label">Presets:</span>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() =>
                          onUpdateNodeData(selectedNode.id, {
                            ...selectedNode.data,
                            options: 'হ্যাঁ (Yes), না (No)',
                          })
                        }
                      >
                        Yes/No
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() =>
                          onUpdateNodeData(selectedNode.id, {
                            ...selectedNode.data,
                            options: 'ধান, ভুট্টা, আলু, সবজি, মাছ চাষ',
                          })
                        }
                      >
                        Crops
                      </button>
                    </div>

                    {/* Option-level Nested Flowchart Branches */}
                    {((selectedNode.data as any).options || '')
                      .split(',')
                      .map((o: string) => o.trim())
                      .filter((o: string) => o.length > 0).length > 0 && (
                        <div className="option-nested-flow-inspector">
                          <div className="nested-header">
                            <GitBranch size={13} className="text-amber" />
                            <span className="nested-title">Nested Sub-Flows per Option:</span>
                          </div>
                          <p className="nested-help">
                            Connect child questions directly from option ports on the canvas, or click below:
                          </p>
                          <div className="nested-options-cards">
                            {((selectedNode.data as any).options || '')
                              .split(',')
                              .map((o: string) => o.trim())
                              .filter((o: string) => o.length > 0)
                              .map((trimmedOpt: string, i: number) => {
                                const connectedEdges = edges.filter(
                                  (e) =>
                                    e.source === selectedNode.id &&
                                    e.sourceHandle === `opt-${encodeURIComponent(trimmedOpt)}`
                                );

                                return (
                                  <div key={i} className="nested-option-row">
                                    <div className="nested-option-info">
                                      <span className="nested-option-name bn-font">
                                        {trimmedOpt}
                                      </span>
                                      <span className="connected-count">
                                        {connectedEdges.length === 0
                                          ? '0 nested nodes'
                                          : `${connectedEdges.length} nested node${connectedEdges.length > 1 ? 's' : ''
                                          }`}
                                      </span>
                                    </div>
                                    {onAddNestedQuestion && (
                                      <button
                                        type="button"
                                        className="btn-add-nested"
                                        onClick={() =>
                                          onAddNestedQuestion(selectedNode.id, trimmedOpt)
                                        }
                                        title={`Add a nested question branching from "${trimmedOpt}"`}
                                      >
                                        <Plus size={12} />
                                        <span>+ Nested Branch</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                  </div>
                )}

              <div className="form-group">
                <label className="form-label">Placeholder</label>
                <input
                  type="text"
                  className="form-input"
                  value={(selectedNode.data as any).placeholder || ''}
                  onChange={(e) =>
                    onUpdateNodeData(selectedNode.id, {
                      ...selectedNode.data,
                      placeholder: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hint Text</label>
                <input
                  type="text"
                  className="form-input bn-font"
                  value={(selectedNode.data as any).hint || ''}
                  onChange={(e) =>
                    onUpdateNodeData(selectedNode.id, {
                      ...selectedNode.data,
                      hint: e.target.value,
                    })
                  }
                />
              </div>

              {/* Cross-Group Dependencies (MySQL Workbench ERD Style) */}
              {(() => {
                const currentGroupNum = groupMeta.groupNumber || 1;
                const currentQuestionGroup = resolveNodeGroupId(
                  selectedNode,
                  nodes,
                  currentGroupNum
                );

                // Find incoming cross-group edges targeting this question
                const incomingCrossGroupEdges = edges.filter((e) => {
                  if (e.target !== selectedNode.id) return false;
                  const srcNode = nodes.find((n) => n.id === e.source);
                  if (!srcNode || srcNode.type !== 'question') return false;
                  const srcGroup = resolveNodeGroupId(srcNode, nodes, currentGroupNum);
                  return srcGroup !== currentQuestionGroup;
                });

                // Compute available source groups (excluding the question's own group)
                const groupMap = new Map<number, string>();
                nodes.forEach((n) => {
                  if (n.type === 'groupContainer' || n.type === 'groupFrame') {
                    const gId =
                      (n.data as any)?.numericGroupId || parseInt((n.data as any)?.groupId) || 1;
                    const gTitle = (n.data as any)?.title || `Group ${gId}`;
                    groupMap.set(gId, gTitle);
                  }
                });
                groups.forEach((g) => {
                  const gId = typeof g.groupId === 'number' ? g.groupId : parseInt(g.id, 10);
                  if (!isNaN(gId)) {
                    groupMap.set(gId, g.name);
                  }
                });
                nodes.forEach((n) => {
                  if (n.type === 'question') {
                    const gId = resolveNodeGroupId(n, nodes, currentGroupNum);
                    if (!groupMap.has(gId)) {
                      groupMap.set(gId, (n.data as any)?.group_name || `Group ${gId}`);
                    }
                  }
                });

                const otherGroups = Array.from(groupMap.entries())
                  .map(([id, title]) => ({ id, title }))
                  .filter((g) => g.id !== currentQuestionGroup)
                  .sort((a, b) => a.id - b.id);

                // Available question nodes in the selected source group
                const availableSourceQuestions = nodes.filter((n) => {
                  if (n.type !== 'question') return false;
                  const gId = resolveNodeGroupId(n, nodes, currentGroupNum);
                  return crossSourceGroupId !== '' && gId === Number(crossSourceGroupId);
                });

                const selectedSourceQNode = nodes.find((n) => n.id === crossSourceQuestionId);
                const sourceOptions = (selectedSourceQNode?.data as any)?.options
                  ? String((selectedSourceQNode?.data as any)?.options)
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                  : [];

                const handleAddCrossDependency = () => {
                  if (!selectedSourceQNode || !selectedNode) return;
                  const srcGroup = resolveNodeGroupId(selectedSourceQNode, nodes, 1);
                  const tgtGroup = currentQuestionGroup;
                  const srcQData = selectedSourceQNode.data as unknown as QuestionNodeData;
                  const targetData = selectedNode.data as unknown as QuestionNodeData;

                  let sourceHandle: string | undefined = undefined;
                  if (crossValType === 'match' && crossTriggerValue) {
                    sourceHandle = `opt-${encodeURIComponent(crossTriggerValue.trim())}`;
                  }

                  const ruleDesc =
                    crossValType === 'match'
                      ? `IF "${crossTriggerValue}"`
                      : `IF ${crossValType === 'greater' ? '>' : '<'} ${crossTriggerValue}`;
                  const edgeLabel = `[G${srcGroup}➔G${tgtGroup}] ${ruleDesc}`;
                  const newEdgeId = `e-cross-${selectedSourceQNode.id}-${selectedNode.id}-${Date.now()}`;

                  const newEdge: Edge = {
                    id: newEdgeId,
                    source: selectedSourceQNode.id,
                    sourceHandle,
                    target: selectedNode.id,
                    targetHandle: 'in',
                    type: 'surveyEdge',
                    animated: true,
                    label: edgeLabel,
                    style: {
                      stroke: '#8b5cf6',
                      strokeWidth: 2,
                      strokeDasharray: '5 5',
                    },
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                      width: 16,
                      height: 16,
                      color: '#8b5cf6',
                    },
                    data: {
                      validationType: crossValType,
                      triggerValue: crossTriggerValue,
                      isCrossGroup: true,
                      sourceGroup: srcGroup,
                      targetGroup: tgtGroup,
                    },
                  };

                  if (onAddEdge) {
                    onAddEdge(newEdge);
                  }

                  // Update target question to start hidden and update depends_on
                  const currentDependsOn = Array.isArray(targetData.depends_on)
                    ? [...targetData.depends_on]
                    : [];
                  if (srcQData.question_id && !currentDependsOn.includes(srcQData.question_id)) {
                    currentDependsOn.push(srcQData.question_id);
                  }

                  onUpdateNodeData(selectedNode.id, {
                    ...targetData,
                    hidden: true,
                    depends_on: currentDependsOn,
                  });

                  setIsCrossGroupBuilderOpen(false);
                  setCrossTriggerValue('');
                };

                const handleRemoveCrossDependency = (edgeId: string, srcId: string) => {
                  if (onDeleteEdge) {
                    onDeleteEdge(edgeId);
                  }
                  const srcNode = nodes.find((n) => n.id === srcId);
                  const parentQId = (srcNode?.data as any)?.question_id;
                  const targetData = selectedNode.data as unknown as QuestionNodeData;
                  const remainingEdgesFromParent = edges.filter(
                    (e) => e.id !== edgeId && e.target === selectedNode.id && e.source === srcId
                  );
                  if (parentQId && remainingEdgesFromParent.length === 0) {
                    const newDependsOn = Array.isArray(targetData.depends_on)
                      ? targetData.depends_on.filter((id: number) => id !== parentQId)
                      : [];
                    onUpdateNodeData(selectedNode.id, {
                      ...targetData,
                      depends_on: newDependsOn.length > 0 ? newDependsOn : undefined,
                    });
                  }
                };

                return (
                  <div className="cross-group-inspector-card">
                    <div className="cross-group-header">
                      <div className="cross-group-title-row">
                        <Network size={14} />
                        <span>Cross-Group Logic (Foreign Keys)</span>
                      </div>
                      <span className="cross-group-badge-count">
                        {incomingCrossGroupEdges.length} Active
                      </span>
                    </div>

                    <p className="cross-group-desc">
                      Connect conditions from questions in other groups, just like table relationships in MySQL Workbench.
                    </p>

                    {/* Existing Cross-group rules targeting this question */}
                    {incomingCrossGroupEdges.length > 0 ? (
                      <div className="cross-group-items-list">
                        {incomingCrossGroupEdges.map((cEdge) => {
                          const srcNode = nodes.find((n) => n.id === cEdge.source);
                          const srcData = srcNode?.data as any;
                          const srcGroupId = resolveNodeGroupId(srcNode, nodes, 1);
                          const edgeData = (cEdge.data as any) || {};
                          const condText =
                            edgeData.triggerValue !== undefined && edgeData.triggerValue !== ''
                              ? `IF ${edgeData.validationType === 'greater' ? '>' : edgeData.validationType === 'less' ? '<' : '=='} "${edgeData.triggerValue}"`
                              : cEdge.label || 'Cross-Group Dependency';

                          return (
                            <div key={cEdge.id} className="cross-group-item-card">
                              <div className="cross-group-item-main">
                                <div className="cross-group-origin-tag">
                                  <Database size={10} />
                                  <span>Group {srcGroupId}</span>
                                  <span>•</span>
                                  <span>Q#{srcData?.question_id || '?'}</span>
                                </div>
                                <div
                                  className="cross-group-question-name bn-font"
                                  title={srcData?.question_bn || srcData?.question}
                                >
                                  {srcData?.question_bn || srcData?.question || 'Source Question'}
                                </div>
                                <div className="cross-group-condition-tag">
                                  <span>{condText}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="icon-action-btn text-danger"
                                onClick={() => handleRemoveCrossDependency(cEdge.id, cEdge.source)}
                                title="Remove Cross-Group Link"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          fontStyle: 'italic',
                          padding: '4px 0',
                        }}
                      >
                        No incoming cross-group conditions yet.
                      </div>
                    )}

                    {/* Inline Foreign Key Builder */}
                    {!isCrossGroupBuilderOpen ? (
                      <button
                        type="button"
                        className="btn-add-cross-group"
                        onClick={() => setIsCrossGroupBuilderOpen(true)}
                      >
                        <Plus size={13} />
                        <span>Add Dependency from Another Group</span>
                      </button>
                    ) : (
                      <div className="cross-group-form-builder">
                        <div className="flex-between">
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#c084fc',
                              textTransform: 'uppercase',
                            }}
                          >
                            New Cross-Group Rule
                          </span>
                          <button
                            type="button"
                            className="icon-action-btn"
                            style={{ width: 20, height: 20 }}
                            onClick={() => setIsCrossGroupBuilderOpen(false)}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>

                        {/* Step 1: Source Group */}
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: 10 }}>
                            1. Source Group (Table)
                          </label>
                          <select
                            className="form-select"
                            value={crossSourceGroupId}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setCrossSourceGroupId(val);
                              setCrossSourceQuestionId('');
                              setCrossTriggerValue('');
                            }}
                          >
                            <option value="">-- Select Source Group --</option>
                            {otherGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                Group {g.id}: {g.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Step 2: Source Question */}
                        {crossSourceGroupId !== '' && (
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: 10 }}>
                              2. Source Question (Column)
                            </label>
                            <select
                              className="form-select bn-font"
                              value={crossSourceQuestionId}
                              onChange={(e) => {
                                setCrossSourceQuestionId(e.target.value);
                                setCrossTriggerValue('');
                              }}
                            >
                              <option value="">-- Select Question --</option>
                              {availableSourceQuestions.map((q) => {
                                const qData = q.data as any;
                                return (
                                  <option key={q.id} value={q.id}>
                                    Q#{qData.question_id}: {qData.question_bn || qData.question}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}

                        {/* Step 3: Condition Type & Trigger Value */}
                        {crossSourceQuestionId && (
                          <>
                            <div className="form-row-2">
                              <div className="form-group flex-1">
                                <label className="form-label" style={{ fontSize: 10 }}>
                                  3. Condition
                                </label>
                                <select
                                  className="form-select"
                                  value={crossValType}
                                  onChange={(e) =>
                                    setCrossValType(e.target.value as ValidationType)
                                  }
                                >
                                  <option value="match">Match (==)</option>
                                  <option value="greater">Greater (&gt;)</option>
                                  <option value="less">Less (&lt;)</option>
                                </select>
                              </div>

                              <div className="form-group flex-1">
                                <label className="form-label" style={{ fontSize: 10 }}>
                                  4. Trigger Value
                                </label>
                                <input
                                  type="text"
                                  className="form-input bn-font"
                                  placeholder="e.g. হ্যাঁ or 50"
                                  value={crossTriggerValue}
                                  onChange={(e) => setCrossTriggerValue(e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Option Presets from Source Question */}
                            {sourceOptions.length > 0 && (
                              <div className="cross-group-quick-pills">
                                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                                  Source Options:
                                </span>
                                {sourceOptions.map((opt, i) => (
                                  <span
                                    key={i}
                                    className={`cross-group-pill-opt ${crossTriggerValue === opt ? 'is-selected' : ''
                                      }`}
                                    onClick={() => {
                                      setCrossTriggerValue(opt);
                                      setCrossValType('match');
                                    }}
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            )}

                            <button
                              type="button"
                              className="btn-add-cross-group"
                              style={{ background: '#8b5cf6', color: '#fff', marginTop: 4 }}
                              disabled={!crossTriggerValue}
                              onClick={handleAddCrossDependency}
                            >
                              <Link2 size={13} />
                              <span>Link Cross-Group Dependency</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* If Decision Node Selected */}
          {selectedNode && selectedNode.type === 'decision' && (
            <div className="node-inspector-block">
              <div className="flex-between">
                <span className="text-secondary font-mono text-xs">
                  Decision Diamond
                </span>
                <button
                  className="icon-action-btn text-danger"
                  onClick={() => onDeleteNode(selectedNode.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Parent Group Membership Indicator */}
              {(() => {
                const containerId = (selectedNode.data as any)?.containerId;
                const parentFrame = containerId ? nodes.find((n) => n.id === containerId) : null;
                const groupNum = (selectedNode.data as any)?.group || (parentFrame?.data as any)?.numericGroupId;
                if (!parentFrame && !groupNum) return null;
                const frameColor = (parentFrame?.data as any)?.color || '#f59e0b';
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 12px 0', padding: '6px 10px', borderRadius: 6, background: `${frameColor}15`, border: `1px solid ${frameColor}35` }}>
                    <Layers size={13} style={{ color: frameColor }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: frameColor }}>
                      Group #{groupNum || 1}
                    </span>
                    {parentFrame && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        • {(parentFrame.data as any)?.titleBn || (parentFrame.data as any)?.title || 'Group Area'}
                      </span>
                    )}
                  </div>
                );
              })()}

              <div className="form-group">
                <label className="form-label">Condition Label</label>
                <input
                  type="text"
                  className="form-input"
                  value={(selectedNode.data as any).label || ''}
                  onChange={(e) =>
                    onUpdateNodeData(selectedNode.id, {
                      ...selectedNode.data,
                      label: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Comparison Rule</label>
                <select
                  className="form-select"
                  value={(selectedNode.data as any).conditionType}
                  onChange={(e) =>
                    onUpdateNodeData(selectedNode.id, {
                      ...selectedNode.data,
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
                  value={(selectedNode.data as any).comparisonValue || ''}
                  onChange={(e) =>
                    onUpdateNodeData(selectedNode.id, {
                      ...selectedNode.data,
                      comparisonValue: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}

          {/* If Group Jump Selected */}
          {selectedNode && selectedNode.type === 'groupJump' && (() => {
            const jumpData = selectedNode.data as unknown as GroupJumpNodeData;

            // Available Canvas Group Containers
            const canvasGroups = nodes
              .filter((n) => n.type === 'groupContainer' || n.type === 'groupFrame')
              .map((n) => {
                const d = n.data as any;
                const gId = Number(d.numericGroupId || 1);
                return {
                  id: `canvas-${n.id}`,
                  groupId: gId,
                  title: d.title || `Group ${gId}`,
                  titleBn: d.titleBn || '',
                  color: d.color || '#0284c7',
                  category: d.category || 'custom',
                  source: 'Canvas Container',
                };
              });

            // Available Library Groups
            const libGroups = (groups || []).map((g) => {
              const gId = Number(g.groupId || 1);
              return {
                id: `lib-${g.id}`,
                groupId: gId,
                title: g.name,
                titleBn: g.nameBn || '',
                color: g.color || '#10b981',
                category: g.category || 'custom',
                source: 'Group Library',
              };
            });

            // Check if current targetGroupId matches any existing group
            const matchedGroup =
              canvasGroups.find((g) => g.groupId === jumpData.targetGroupId) ||
              libGroups.find((g) => g.groupId === jumpData.targetGroupId);

            const selectedValue = matchedGroup
              ? matchedGroup.id
              : jumpData.targetGroupId
                ? 'custom'
                : '';

            return (
              <div className="node-inspector-block">
                <div className="flex-between">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        backgroundColor: '#8b5cf625',
                        color: '#8b5cf6',
                        padding: 4,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FastForward size={14} />
                    </div>
                    <span className="badge-type" style={{ color: '#a78bfa' }}>
                      Group Connector
                    </span>
                  </div>
                  <button
                    className="icon-action-btn text-danger"
                    onClick={() => onDeleteNode(selectedNode.id)}
                    title="Delete Connector"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Parent Group Membership Indicator */}
                {(() => {
                  const containerId = (selectedNode.data as any)?.containerId;
                  const parentFrame = containerId ? nodes.find((n) => n.id === containerId) : null;
                  const groupNum = (selectedNode.data as any)?.group || (parentFrame?.data as any)?.numericGroupId;
                  if (!parentFrame && !groupNum) return null;
                  const frameColor = (parentFrame?.data as any)?.color || '#8b5cf6';
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 12px 0', padding: '6px 10px', borderRadius: 6, background: `${frameColor}15`, border: `1px solid ${frameColor}35` }}>
                      <Layers size={13} style={{ color: frameColor }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: frameColor }}>
                        Group #{groupNum || 1}
                      </span>
                      {parentFrame && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          • {(parentFrame.data as any)?.titleBn || (parentFrame.data as any)?.title || 'Group Area'}
                        </span>
                      )}
                    </div>
                  );
                })()}

                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label required-label">
                    Target Question Group (Jump Destination)
                  </label>
                  <select
                    className="form-select"
                    value={selectedValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val || val === 'custom') {
                        return;
                      }
                      const target =
                        canvasGroups.find((g) => g.id === val) ||
                        libGroups.find((g) => g.id === val);
                      if (target) {
                        onUpdateNodeData(selectedNode.id, {
                          ...jumpData,
                          targetGroupId: target.groupId,
                          targetGroupTitle: target.titleBn
                            ? `${target.title} (${target.titleBn})`
                            : target.title,
                        });
                      }
                    }}
                  >
                    <option value="">-- Choose Target Group --</option>
                    {canvasGroups.length > 0 && (
                      <optgroup label="Groups on Canvas">
                        {canvasGroups.map((cg) => (
                          <option key={cg.id} value={cg.id}>
                            [Group #{cg.groupId}] {cg.title} {cg.titleBn ? `(${cg.titleBn})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {libGroups.length > 0 && (
                      <optgroup label="Reusable Group Library">
                        {libGroups.map((lg) => (
                          <option key={lg.id} value={lg.id}>
                            [Group #{lg.groupId}] {lg.title} {lg.titleBn ? `(${lg.titleBn})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="custom">⚙️ Custom / External Group ID...</option>
                  </select>
                </div>

                {matchedGroup ? (
                  <div
                    style={{
                      background: 'rgba(139, 92, 246, 0.08)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      marginTop: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div className="flex-between" style={{ marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#a78bfa',
                          backgroundColor: 'rgba(139, 92, 246, 0.2)',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        GROUP #{matchedGroup.groupId}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                        }}
                      >
                        {matchedGroup.source}
                      </span>
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: '#f8fafc',
                      }}
                    >
                      {matchedGroup.title}
                    </div>
                    {matchedGroup.titleBn && (
                      <div
                        className="bn-font"
                        style={{
                          fontSize: 12,
                          color: '#94a3b8',
                          marginTop: 2,
                        }}
                      >
                        {matchedGroup.titleBn}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Manual Group Target Fields */}
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label className="form-label">Target Group ID (Numeric)</label>
                  <div className="input-with-icon">
                    <Hash size={14} className="input-icon" />
                    <input
                      type="number"
                      min={1}
                      className="form-input has-icon"
                      value={jumpData.targetGroupId || 1}
                      onChange={(e) =>
                        onUpdateNodeData(selectedNode.id, {
                          ...jumpData,
                          targetGroupId: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Group Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 2: কৃষি প্রকল্প ও সম্পদ তথ্য"
                    value={jumpData.targetGroupTitle || ''}
                    onChange={(e) =>
                      onUpdateNodeData(selectedNode.id, {
                        ...jumpData,
                        targetGroupTitle: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            );
          })()}

          {/* If Question Group Container Selected */}
          {selectedNode && (selectedNode.type === 'groupContainer' || selectedNode.type === 'groupFrame') && (() => {
            const containerData = selectedNode.data as any;
            const childQuestions = nodes.filter(
              (n) => isNodeInContainer(n, selectedNode, nodes)
            );
            const activeColor = containerData.color || '#0284c7';

            const CATEGORY_OPTIONS: { value: string; label: string; defaultColor: string }[] = [
              { value: 'kyc', label: 'Farmer KYC & Identity', defaultColor: '#0284c7' },
              { value: 'land', label: 'Land & Plots', defaultColor: '#10b981' },
              { value: 'crop', label: 'Crops & Yield', defaultColor: '#f59e0b' },
              { value: 'financial', label: 'Financial & Income', defaultColor: '#8b5cf6' },
              { value: 'verification', label: 'Geo & Field Verification', defaultColor: '#ec4899' },
              { value: 'custom', label: 'Custom Domain Sets', defaultColor: '#64748b' },
            ];

            const PRESET_COLORS = [
              '#0284c7', // Sky
              '#10b981', // Emerald
              '#f59e0b', // Amber
              '#8b5cf6', // Violet
              '#ec4899', // Pink
              '#06b6d4', // Cyan
              '#6366f1', // Indigo
              '#64748b', // Slate
            ];

            return (
              <div className="node-inspector-block">
                <div className="flex-between">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        backgroundColor: activeColor,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        display: 'inline-block',
                        boxShadow: `0 0 8px ${activeColor}80`,
                      }}
                    />
                    <span className="badge-type">Question Group</span>
                    <span
                      className="group-cat-chip"
                      style={{
                        backgroundColor: `${activeColor}18`,
                        color: activeColor,
                        borderColor: `${activeColor}40`,
                      }}
                    >
                      <Tag size={9} />
                      <span>{(containerData.category || 'custom').toUpperCase()}</span>
                    </span>
                  </div>
                  <button
                    className="icon-action-btn text-danger"
                    onClick={() => {
                      if (containerData.onDeleteGroup) {
                        containerData.onDeleteGroup(selectedNode.id);
                      } else {
                        onDeleteNode(selectedNode.id);
                      }
                    }}
                    title="Delete Question Group"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="form-row-2" style={{ marginTop: 12 }}>
                  <div className="form-group flex-1">
                    <label className="form-label required-label">Backend Group ID *</label>
                    <div className="input-with-icon">
                      <Hash size={14} className="input-icon" />
                      <input
                        type="number"
                        min={1}
                        className="form-input has-icon"
                        value={containerData.numericGroupId || 1}
                        onChange={(e) => {
                          const newId = Math.max(1, parseInt(e.target.value) || 1);
                          onUpdateNodeData(selectedNode.id, {
                            ...selectedNode.data,
                            numericGroupId: newId,
                          });
                        }}
                      />
                    </div>
                  </div>
                  <div className="form-group flex-1">
                    <label className="form-label">Questions</label>
                    <div
                      className="form-input"
                      style={{
                        opacity: 0.9,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {childQuestions.length || containerData.questionCount || 0} Questions
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Group Title (English)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={containerData.title || ''}
                    onChange={(e) =>
                      onUpdateNodeData(selectedNode.id, {
                        ...selectedNode.data,
                        title: e.target.value,
                      })
                    }
                    placeholder="e.g. Farmer Personal KYC"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Group Title (Bengali)</label>
                  <input
                    type="text"
                    className="form-input bn-font"
                    value={containerData.titleBn || ''}
                    onChange={(e) =>
                      onUpdateNodeData(selectedNode.id, {
                        ...selectedNode.data,
                        titleBn: e.target.value,
                      })
                    }
                    placeholder="e.g. কৃষকের ব্যক্তিগত তথ্য"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Domain Category</label>
                  <select
                    className="form-select"
                    value={containerData.category || 'custom'}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      const matched = CATEGORY_OPTIONS.find((c) => c.value === newCat);
                      onUpdateNodeData(selectedNode.id, {
                        ...selectedNode.data,
                        category: newCat,
                        color: matched ? matched.defaultColor : activeColor,
                      });
                    }}
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Accent Theme Color</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          onUpdateNodeData(selectedNode.id, {
                            ...selectedNode.data,
                            color: c,
                          })
                        }
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          backgroundColor: c,
                          border: activeColor === c ? '2px solid #fff' : '2px solid transparent',
                          boxShadow: activeColor === c ? `0 0 8px ${c}` : 'none',
                          cursor: 'pointer',
                          transition: 'transform 0.15s ease',
                          transform: activeColor === c ? 'scale(1.15)' : 'scale(1)',
                        }}
                        title={`Select color ${c}`}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {containerData.onToggleCollapse && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={() => containerData.onToggleCollapse(selectedNode.id)}
                    >
                      {containerData.isCollapsed ? (
                        <>
                          <ChevronDown size={14} />
                          <span>Expand</span>
                        </>
                      ) : (
                        <>
                          <ChevronUp size={14} />
                          <span>Collapse</span>
                        </>
                      )}
                    </button>
                  )}
                  {containerData.onUngroup && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => containerData.onUngroup(selectedNode.id)}
                    >
                      Ungroup
                    </button>
                  )}
                </div>

                {/* Child Elements Preview List */}
                {childQuestions.length > 0 && (
                  <div className="form-group" style={{ marginTop: 16 }}>
                    <div className="flex-between" style={{ marginBottom: 6 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        Group Elements ({childQuestions.length})
                      </label>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Contained items</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        maxHeight: 200,
                        overflowY: 'auto',
                        padding: 4,
                      }}
                    >
                      {childQuestions.map((cq, idx) => {
                        const qd = cq.data as any;
                        let typeBadge = qd.answer_type || 'question';
                        let labelText = `Q${qd.question_id || '?'}: ${qd.question_bn || qd.question || 'Untitled Question'}`;
                        let badgeColor = activeColor;

                        if (cq.type === 'decision') {
                          typeBadge = 'DECISION';
                          badgeColor = '#f59e0b';
                          labelText = `Condition: ${qd.label || 'Decision'} (${qd.conditionType || 'match'}: ${qd.comparisonValue ?? 'Yes'})`;
                        } else if (cq.type === 'groupJump') {
                          typeBadge = 'JUMP';
                          badgeColor = '#8b5cf6';
                          labelText = `Jump to: ${qd.targetGroupTitle || 'Group Jump'}`;
                        } else if (cq.type === 'start') {
                          typeBadge = 'START';
                          badgeColor = '#10b981';
                          labelText = `Start: ${qd.label || 'Group Start Point'}`;
                        } else if (cq.type === 'end') {
                          typeBadge = 'END';
                          badgeColor = '#ef4444';
                          labelText = `End: ${qd.label || 'Group End / Submit'}`;
                        } else if (cq.type === 'process') {
                          typeBadge = 'PROCESS';
                          badgeColor = '#6366f1';
                          labelText = `Process: ${qd.label || 'Action Step'}`;
                        } else if (cq.type === 'document') {
                          typeBadge = 'DOCUMENT';
                          badgeColor = '#06b6d4';
                          labelText = `Output: ${qd.label || 'Document PDF'}`;
                        }

                        return (
                          <div
                            key={cq.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 8px',
                              borderRadius: 6,
                              background: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border-subtle)',
                              fontSize: 11,
                            }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-default)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                flexShrink: 0,
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: `${badgeColor}15`,
                                color: badgeColor,
                                border: `1px solid ${badgeColor}30`,
                                textTransform: 'uppercase',
                                flexShrink: 0,
                              }}
                            >
                              {typeBadge}
                            </span>
                            <span
                              className="bn-font"
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: 'var(--text-primary)',
                                flex: 1,
                              }}
                              title={labelText}
                            >
                              {labelText}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* If Other Flowchart Node (Start, End, Process, Document) */}
          {selectedNode &&
            selectedNode.type !== 'question' &&
            selectedNode.type !== 'decision' &&
            selectedNode.type !== 'groupJump' &&
            selectedNode.type !== 'groupContainer' &&
            selectedNode.type !== 'groupFrame' && (
              <div className="node-inspector-block">
                <div className="flex-between">
                  <span className="badge-type">{selectedNode.type}</span>
                  <button
                    className="icon-action-btn text-danger"
                    onClick={() => onDeleteNode(selectedNode.id)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Parent Group Membership Indicator */}
                {(() => {
                  const containerId = (selectedNode.data as any)?.containerId;
                  const parentFrame = containerId ? nodes.find((n) => n.id === containerId) : null;
                  const groupNum = (selectedNode.data as any)?.group || (parentFrame?.data as any)?.numericGroupId;
                  if (!parentFrame && !groupNum) return null;
                  const frameColor = (parentFrame?.data as any)?.color || '#6366f1';
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 12px 0', padding: '6px 10px', borderRadius: 6, background: `${frameColor}15`, border: `1px solid ${frameColor}35` }}>
                      <Layers size={13} style={{ color: frameColor }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: frameColor }}>
                        Group #{groupNum || 1}
                      </span>
                      {parentFrame && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          • {(parentFrame.data as any)?.titleBn || (parentFrame.data as any)?.title || 'Group Area'}
                        </span>
                      )}
                    </div>
                  );
                })()}

                <div className="form-group">
                  <label className="form-label">Label</label>
                  <input
                    type="text"
                    className="form-input"
                    value={(selectedNode.data as any).label || ''}
                    onChange={(e) =>
                      onUpdateNodeData(selectedNode.id, {
                        ...selectedNode.data,
                        label: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            )}

          {/* Dependency Path Tracing Section (for any inspectable node) */}
          {selectedNode &&
            selectedNode.type !== 'groupContainer' &&
            selectedNode.type !== 'groupFrame' && (() => {
              const trace = calculateDependencyTrace(nodes, edges, selectedNode.id);
              if (!trace) return null;

              const ancestors = trace.predecessorNodes;
              const descendants = trace.successorNodes;

              return (
                <div className="dependency-trace-section">
                  <div className="dependency-trace-header">
                    <div className="dependency-trace-header-left">
                      <GitFork size={14} className="text-cyan-400" />
                      <span>Dependency Path Trace</span>
                    </div>
                    <span className="text-secondary font-mono text-xs">
                      {ancestors.length} Up • {descendants.length} Down
                    </span>
                  </div>

                  {ancestors.length === 0 && descendants.length === 0 ? (
                    <div className="trace-empty-hint">
                      Node is independent: no incoming prerequisites or outgoing dependents.
                    </div>
                  ) : (
                    <>
                      {/* Upstream Predecessors */}
                      <div className="trace-group">
                        <div className="trace-group-title text-cyan">
                          <span>Upstream Predecessors ({ancestors.length})</span>
                        </div>
                        {ancestors.length === 0 ? (
                          <div className="trace-empty-hint">None (Entry root or isolated)</div>
                        ) : (
                          <div className="trace-pill-list">
                            {ancestors.map((node) => (
                              <button
                                key={node.id}
                                type="button"
                                className="trace-node-pill pill-cyan"
                                onClick={() => onFocusNode?.(node.id)}
                                title={`Focus and center ${getNodeTraceLabel(node)} on canvas`}
                              >
                                <span className="pill-text font-mono">
                                  {getNodeTraceLabel(node)}
                                </span>
                                <ArrowRight size={12} className="pill-arrow" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Downstream Dependents */}
                      <div className="trace-group">
                        <div className="trace-group-title text-amber">
                          <span>Downstream Dependents ({descendants.length})</span>
                        </div>
                        {descendants.length === 0 ? (
                          <div className="trace-empty-hint">None (Terminal node)</div>
                        ) : (
                          <div className="trace-pill-list">
                            {descendants.map((node) => (
                              <button
                                key={node.id}
                                type="button"
                                className="trace-node-pill pill-amber"
                                onClick={() => onFocusNode?.(node.id)}
                                title={`Focus and center ${getNodeTraceLabel(node)} on canvas`}
                              >
                                <span className="pill-text font-mono">
                                  {getNodeTraceLabel(node)}
                                </span>
                                <ArrowRight size={12} className="pill-arrow" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

          {/* If Nothing Selected: Group Settings */}
          {!selectedNode && !selectedEdge && (
            <div className="group-settings-block">
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
                  <span>
                    {groupMeta.hasNextGroup ? 'Next Group Exists (true)' : 'Last Step / Submit (false)'}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Group Instruction (Bengali)</label>
                <textarea
                  className="form-textarea bn-font"
                  rows={3}
                  value={groupMeta.instruction}
                  onChange={(e) => onUpdateGroupMeta({ instruction: e.target.value })}
                />
              </div>

              <div className="info-tip-box">
                <HelpCircle size={16} className="tip-icon" />
                <div className="tip-text">
                  Click on any question node or connecting line in the canvas to inspect its validation rules.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
