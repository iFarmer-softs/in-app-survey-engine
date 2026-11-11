import React, { useState, useMemo } from 'react';
import {
  Search,
  GripVertical,
  GitBranch,
  X,
  PanelLeftClose,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { FlowNodeType, AnswerType } from '../../types/survey';
import type { ReusableQuestionGroup } from '../../types/group';
import { INPUT_TYPE_VIEWS, type InputTypeItem } from './InputTypeViewsPanel';

interface FlowLogicItem {
  id: string;
  nodeType: FlowNodeType;
  title: string;
  titleBn: string;
  badge: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const FLOW_LOGIC_ITEMS: FlowLogicItem[] = [
  {
    id: 'decision-branch',
    nodeType: 'decision',
    title: 'Condition / Branch',
    titleBn: 'শর্ত / লজিক্যাল শাখা',
    badge: 'if / else',
    icon: <GitBranch size={16} />,
    color: '#f59e0b',
    description: 'Evaluates conditional logic (Match, Greater, Less) based on answer',
  },
];

interface FlowchartSymbolsPanelProps {
  isOpen?: boolean;
  width?: number;
  isResizing?: boolean;
  onToggleCollapse?: () => void;
  onAddSymbol?: (nodeType: FlowNodeType, name: string, nameBn: string) => void;
  onAddQuestion?: (answerType: AnswerType, name: string, nameBn: string, options?: string) => void;
  groups?: ReusableQuestionGroup[];
  onInsertGroup?: (group: ReusableQuestionGroup) => void;
  onNavigateToGroups?: () => void;
  onDeleteGroup?: (groupId: string) => void;
}

export const FlowchartSymbolsPanel: React.FC<FlowchartSymbolsPanelProps> = ({
  isOpen = true,
  width,
  isResizing,
  onToggleCollapse,
  onAddSymbol,
  onAddQuestion,
}) => {
  const [search, setSearch] = useState('');

  const onDragStartLogic = (
    event: React.DragEvent,
    item: FlowLogicItem
  ) => {
      const payload = JSON.stringify({
        nodeType: item.nodeType,
        name: item.title,
        nameBn: item.titleBn,
      });
      event.dataTransfer.setData('application/reactflow-node', payload);
      event.dataTransfer.setData('text/plain', payload);
      event.dataTransfer.effectAllowed = 'copyMove';
    };

    const onDragStartQuestion = (
      event: React.DragEvent,
      item: InputTypeItem
    ) => {
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

    const filteredLogicItems = useMemo(() => {
      if (!search.trim()) return FLOW_LOGIC_ITEMS;
      const q = search.toLowerCase().trim();
    return FLOW_LOGIC_ITEMS.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              (item.titleBn && item.titleBn.toLowerCase().includes(q)) ||
              item.badge.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q)
          );
    }, [search]);

    const filteredQuestionTypes = useMemo(() => {
      if (!search.trim()) return INPUT_TYPE_VIEWS;
      const q = search.toLowerCase().trim();
      return INPUT_TYPE_VIEWS.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.titleBn && item.titleBn.toLowerCase().includes(q)) ||
          item.badge.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
      );
    }, [search]);

    const totalResults = filteredLogicItems.length + filteredQuestionTypes.length;

    return (
      <aside
        className={`sidebar left-sidebar flowchart-symbols-sidebar ${!isOpen ? 'is-collapsed' : ''} ${isResizing ? 'is-resizing' : ''
          }`}
        style={isOpen && width ? { width: `${width}px`, minWidth: `${width}px` } : undefined}
      >
        {/* Top Header */}
        <div className="left-panel-tab-switcher" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px' }}>
            <Layers size={16} style={{ color: 'var(--primary-color, #10b981)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.2px' }}>
              Survey Toolbox
            </span>
          </div>

            { onToggleCollapse && (
              <button
                type="button"
                className="sidebar-collapse-btn"
                onClick={onToggleCollapse}
                title="Collapse Toolbox (Ctrl+B)"
              >
                <PanelLeftClose size={15} />
              </button>
            )}
        </div>

        {/* Scoped Sidebar Search Input */}
        <div className="sidebar-search-wrapper">
          <div className="sidebar-search-inner">
            <Search size={14} className="sidebar-search-icon" />
            <input
              type="text"
              placeholder="Search logic or question types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sidebar-search-input"
            />
            {search && (
              <button
                type="button"
                className="sidebar-search-clear-btn"
                onClick={() => setSearch('')}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

            {/* TOOLBOX PALETTE */}
            <div className="palette-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {totalResults === 0 ? (
                <div className="sidebar-search-empty">
                  <Layers size={26} className="empty-search-icon" />
                  <span className="empty-search-title">No elements found</span>
                  <span className="empty-search-sub">No results for "{search}"</span>
                  <button
                    type="button"
                    className="btn-clear-filter"
                    onClick={() => setSearch('')}
                  >
                    Clear search
                  </button>
                </div>
            ) : (
          <>
              {/* Section 1: Logic & Branching */}
              {filteredLogicItems.length > 0 && (
                <div className="toolbox-section">
                  <div className="toolbox-section-title">LOGIC & BRANCHES</div>
                  <div className="input-types-grid">
                    {filteredLogicItems.map((item) => (
                      <div
                        key={item.id}
                        className="input-type-card"
                        draggable
                        onDragStart={(e) => onDragStartLogic(e, item)}
                        onClick={() => onAddSymbol?.(item.nodeType, item.title, item.titleBn)}
                        title={`${item.title}: ${item.description} (Drag or Click to add)`}
                      >
                        <div className="card-drag-indicator">
                          <GripVertical size={12} />
                        </div>

                                <div
                                  className="input-type-icon-box"
                                  style={{ color: item.color, backgroundColor: `${item.color}18` }}
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

                            {/* Section 2: Question Input Types */}
                            {filteredQuestionTypes.length > 0 && (
                              <div className="toolbox-section">
                                <div className="toolbox-section-title">
                                  QUESTION TYPES ({filteredQuestionTypes.length})
                                </div>
                                <div className="input-types-grid">
                                  {filteredQuestionTypes.map((item) => (
                                    <div
                                      key={item.type}
                                      className="input-type-card"
                                      draggable
                                      onDragStart={(e) => onDragStartQuestion(e, item)}
                                      onClick={() => {
                                        if (onAddQuestion) {
                                          onAddQuestion(item.type, item.title, item.titleBn, item.defaultOptions);
                                        } else if (onAddSymbol) {
                                          onAddSymbol('question', item.title, item.titleBn);
                                        }
                                      }}
                                      title={`${item.title}: ${item.description} (Drag or Click to add)`}
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

                          {/* Quick Helper Tip */}
                          <div
                            style={{
                              marginTop: 6,
                              padding: '10px 12px',
                              background: 'rgba(0, 0, 0, 0.2)',
                              borderRadius: 8,
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <Sparkles size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                              Drag elements directly onto canvas, or click once to add into the active Group Area.
                            </span>
                          </div>
                        </>
        )}
                      </div>
    </aside>
                  );
};
