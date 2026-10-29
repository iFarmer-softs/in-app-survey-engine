import React, { useState } from 'react';
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
} from 'lucide-react';
import type {
  AnswerType,
  QuestionNodeData,
  ValidationType,
} from '../../types/survey';
import type { GroupMeta } from '../../utils/schemaCompiler';

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
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  edges: Edge[];
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
}

export const InputTypeViewsPanel: React.FC<InputTypeViewsPanelProps> = ({
  selectedNode,
  selectedEdge,
  edges,
  groupMeta,
  onUpdateNodeData,
  onUpdateEdgeData,
  onUpdateGroupMeta,
  onDeleteNode,
  onDuplicateNode,
  onAddNestedQuestion,
  onAddQuestion,
}) => {
  // If user selected something, default to inspector tab, otherwise input types
  const [activeTab, setActiveTab] = useState<'widgets' | 'inspector'>(
    selectedNode || selectedEdge ? 'inspector' : 'widgets'
  );

  // Auto-switch to inspector when an element is clicked
  React.useEffect(() => {
    if (selectedNode || selectedEdge) {
      setActiveTab('inspector');
    }
  }, [selectedNode, selectedEdge]);

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
    event.dataTransfer.effectAllowed = 'move';
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
    <aside className="sidebar right-sidebar input-types-sidebar">
      {/* Sidebar Header with Switcher Tabs */}
      <div className="sidebar-header">
        <div className="input-panel-tabs">
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
                ? 'Question Inspector'
                : selectedEdge
                ? 'Rule Inspector'
                : 'Group Settings'}
            </span>
          </button>
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
                className={`input-type-card ${
                  selectedNode &&
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
          {selectedEdge && (
            <div className="edge-inspector-block">
              <div className="edge-connection-badge">
                <span className="edge-node-badge">{selectedEdge.source}</span>
                <ArrowRight size={14} className="text-muted" />
                <span className="edge-node-badge">{selectedEdge.target}</span>
              </div>

              <div className="form-group">
                <label className="form-label">Validation Rule Type</label>
                <select
                  className="form-select"
                  value={(selectedEdge.data as any)?.validationType || 'match'}
                  onChange={(e) => {
                    const newType = e.target.value as ValidationType;
                    const triggerVal = (selectedEdge.data as any)?.triggerValue || '';
                    let label = 'Depends On';
                    if (newType === 'match') label = `IF == "${triggerVal}"`;
                    else if (newType === 'greater') label = `IF > ${triggerVal}`;
                    else if (newType === 'less') label = `IF < ${triggerVal}`;
                    onUpdateEdgeData(selectedEdge.id, {
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
                  value={(selectedEdge.data as any)?.triggerValue ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const valType = (selectedEdge.data as any)?.validationType || 'match';
                    let label = 'Depends On';
                    if (valType === 'match') label = `IF == "${val}"`;
                    else if (valType === 'greater') label = `IF > ${val}`;
                    else if (valType === 'less') label = `IF < ${val}`;
                    onUpdateEdgeData(selectedEdge.id, {
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
                  {(selectedEdge.data as any)?.validationType === 'match'
                    ? `validation: { "${(selectedEdge.data as any)?.triggerValue}": true }`
                    : `validation: ${(selectedEdge.data as any)?.triggerValue} (${(selectedEdge.data as any)?.validationType})`}
                </div>
              </div>
            </div>
          )}

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

              <div className="form-row">
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
                  <label className="form-label">Mandatory?</label>
                  <div
                    className={`toggle-pill ${
                      (selectedNode.data as any).mandatory ? 'is-checked' : ''
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
                    className={`toggle-pill ${
                      ((selectedNode.data as any).editable ?? true) ? 'is-checked' : 'is-locked'
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
                                      : `${connectedEdges.length} nested node${
                                          connectedEdges.length > 1 ? 's' : ''
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
          {selectedNode && selectedNode.type === 'groupJump' && (
            <div className="node-inspector-block">
              <div className="flex-between">
                <span className="text-secondary font-mono text-xs">
                  Group Connector
                </span>
                <button
                  className="icon-action-btn text-danger"
                  onClick={() => onDeleteNode(selectedNode.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Target Group ID</label>
                <input
                  type="number"
                  className="form-input"
                  value={(selectedNode.data as any).targetGroupId}
                  onChange={(e) =>
                    onUpdateNodeData(selectedNode.id, {
                      ...selectedNode.data,
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
                  value={(selectedNode.data as any).targetGroupTitle || ''}
                  onChange={(e) =>
                    onUpdateNodeData(selectedNode.id, {
                      ...selectedNode.data,
                      targetGroupTitle: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}

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
