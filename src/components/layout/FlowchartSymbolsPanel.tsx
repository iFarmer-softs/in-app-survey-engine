import React, { useState, useMemo } from 'react';
import {
  Search,
  GripVertical,
  Network,
  Layers,
  Tag,
  Plus,
  ExternalLink,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { FlowNodeType } from '../../types/survey';
import type { ReusableQuestionGroup } from '../../types/group';

interface FlowchartSymbol {
  id: string;
  name: string;
  nameBn: string;
  standardSymbol: string;
  nodeType: FlowNodeType;
  color: string;
  description: string;
  svgShape: React.ReactNode;
}

const FLOWCHART_SYMBOLS: FlowchartSymbol[] = [
  {
    id: 'symbol-start',
    name: 'Start Terminator',
    nameBn: 'শুরুর পয়েন্ট (ওভাল)',
    standardSymbol: 'Terminator (Oval)',
    nodeType: 'start',
    color: '#10b981',
    description: 'Marks the entrypoint of the questionnaire group',
    svgShape: (
      <svg viewBox="0 0 44 26" className="symbol-svg" fill="none">
        <rect x="2" y="3" width="40" height="20" rx="10" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
        <circle cx="12" cy="13" r="2.5" fill="currentColor" />
        <line x1="18" y1="13" x2="32" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'symbol-data',
    name: 'Input / Question Data',
    nameBn: 'ইনপুট / ডেটা প্রশ্ন (সামান্তরিক)',
    standardSymbol: 'Data / Input (Parallelogram)',
    nodeType: 'question',
    color: '#0284c7',
    description: 'Captures farmer survey inputs and measurements',
    svgShape: (
      <svg viewBox="0 0 44 26" className="symbol-svg" fill="none">
        <polygon points="10,3 42,3 34,23 2,23" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
        <line x1="12" y1="13" x2="30" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'symbol-decision',
    name: 'Decision / Branch',
    nameBn: 'শর্ত / লজিক্যাল শাখা (হীরক/ডায়মন্ড)',
    standardSymbol: 'Decision (Diamond)',
    nodeType: 'decision',
    color: '#f59e0b',
    description: 'Evaluates conditional logic (Match, Greater, Less)',
    svgShape: (
      <svg viewBox="0 0 44 26" className="symbol-svg" fill="none">
        <polygon points="22,2 41,13 22,24 3,13" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
        <circle cx="22" cy="13" r="2.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'symbol-jump',
    name: 'Connector / Group Jump',
    nameBn: 'গ্রুপ জাম্প / সংযোগকারী (বৃত্ত)',
    standardSymbol: 'Connector (Circle)',
    nodeType: 'groupJump',
    color: '#8b5cf6',
    description: 'Jumps to another question group or step',
    svgShape: (
      <svg viewBox="0 0 44 26" className="symbol-svg" fill="none">
        <circle cx="22" cy="13" r="10" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
        <polyline points="19,10 23,13 19,16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="23,10 27,13 23,16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'symbol-process',
    name: 'Process / Calculation',
    nameBn: 'প্রক্রিয়া / হিসাব (আয়তক্ষেত্র)',
    standardSymbol: 'Process (Rectangle)',
    nodeType: 'process',
    color: '#6366f1',
    description: 'Calculates scores, debt ratios, or data transforms',
    svgShape: (
      <svg viewBox="0 0 44 26" className="symbol-svg" fill="none">
        <rect x="3" y="4" width="38" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
        <line x1="10" y1="13" x2="34" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'symbol-document',
    name: 'Document / Report',
    nameBn: 'ডকুমেন্ট / রিপোর্ট আউটপুট',
    standardSymbol: 'Document (Wave Base)',
    nodeType: 'document',
    color: '#06b6d4',
    description: 'Generates KYC assessment PDF or summary receipt',
    svgShape: (
      <svg viewBox="0 0 44 26" className="symbol-svg" fill="none">
        <path d="M 4 4 L 40 4 L 40 18 Q 30 24 20 18 Q 10 12 4 18 Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
        <line x1="10" y1="10" x2="34" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'symbol-end',
    name: 'End Terminator',
    nameBn: 'সমাপ্তি পয়েন্ট (ওভাল)',
    standardSymbol: 'Terminator (Oval)',
    nodeType: 'end',
    color: '#ef4444',
    description: 'Final submission step or group completion',
    svgShape: (
      <svg viewBox="0 0 44 26" className="symbol-svg" fill="none">
        <rect x="2" y="3" width="40" height="20" rx="10" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
        <polyline points="18,13 21,16 27,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

interface FlowchartSymbolsPanelProps {
  onAddSymbol?: (nodeType: FlowNodeType, name: string, nameBn: string) => void;
  groups?: ReusableQuestionGroup[];
  onInsertGroup?: (group: ReusableQuestionGroup) => void;
  onNavigateToGroups?: () => void;
  onDeleteGroup?: (groupId: string) => void;
}

export const FlowchartSymbolsPanel: React.FC<FlowchartSymbolsPanelProps> = ({
  onAddSymbol,
  groups = [],
  onInsertGroup,
  onNavigateToGroups,
  onDeleteGroup,
}) => {
  const [activeTab, setActiveTab] = useState<'symbols' | 'groups'>('symbols');
  const [search, setSearch] = useState('');
  const [groupToDelete, setGroupToDelete] = useState<ReusableQuestionGroup | null>(null);

  const onDragStartSymbol = (
    event: React.DragEvent,
    nodeType: FlowNodeType,
    name: string,
    nameBn: string
  ) => {
    const payload = JSON.stringify({
      nodeType,
      name,
      nameBn,
    });
    event.dataTransfer.setData('application/reactflow-node', payload);
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragStartGroup = (
    event: React.DragEvent,
    group: ReusableQuestionGroup
  ) => {
    const payload = JSON.stringify(group);
    event.dataTransfer.setData('application/reactflow-question-group', payload);
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredSymbols = useMemo(() => {
    if (!search.trim()) return FLOWCHART_SYMBOLS;
    const q = search.toLowerCase().trim();
    return FLOWCHART_SYMBOLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.nameBn && s.nameBn.includes(search.trim())) ||
        s.standardSymbol.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase().trim();
    return groups.filter((g) => {
      const matchName = g.name.toLowerCase().includes(q);
      const matchBn = g.nameBn
        ? g.nameBn.toLowerCase().includes(q) || g.nameBn.includes(search.trim())
        : false;
      const matchCat = g.category ? g.category.toLowerCase().includes(q) : false;
      const matchDesc = g.description ? g.description.toLowerCase().includes(q) : false;
      const matchQuestions = g.questions?.some(
        (item) =>
          item.question?.toLowerCase().includes(q) ||
          (item.question_bn &&
            (item.question_bn.toLowerCase().includes(q) ||
              item.question_bn.includes(search.trim()))) ||
          (item.answer_type && item.answer_type.toLowerCase().includes(q))
      );
      return matchName || matchBn || matchCat || matchDesc || matchQuestions;
    });
  }, [groups, search]);

  return (
    <aside className="sidebar left-sidebar flowchart-symbols-sidebar">
      {/* Top Tab Switcher */}
      <div className="left-panel-tab-switcher">
        <button
          className={`left-tab-btn ${activeTab === 'symbols' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('symbols')}
        >
          <Network size={14} />
          <span>Symbols</span>
        </button>
        <button
          className={`left-tab-btn ${activeTab === 'groups' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          <Layers size={14} />
          <span>Question Groups ({groups.length})</span>
        </button>
      </div>

      {/* Scoped Sidebar Search Input */}
      <div className="sidebar-search-wrapper">
        <div className="sidebar-search-inner">
          <Search size={14} className="sidebar-search-icon" />
          <input
            type="text"
            placeholder={
              activeTab === 'symbols'
                ? 'Filter symbols (name, type)...'
                : 'Filter groups or questions...'
            }
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

      {/* TAB 1: FLOWCHART SYMBOLS */}
      {activeTab === 'symbols' && (
        <div className="palette-container">
          <div className="symbols-list">
            {filteredSymbols.length === 0 ? (
              <div className="sidebar-search-empty">
                <Network size={26} className="empty-search-icon" />
                <span className="empty-search-title">No symbols found</span>
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
              filteredSymbols.map((item) => (
                <div
                  key={item.id}
                  className="flowchart-symbol-card"
                  draggable
                  onDragStart={(e) =>
                    onDragStartSymbol(e, item.nodeType, item.name, item.nameBn)
                  }
                  onClick={() => onAddSymbol?.(item.nodeType, item.name, item.nameBn)}
                  title={`${item.standardSymbol}: ${item.description} (Drag or Click to add)`}
                >
                  <div className="card-drag-indicator">
                    <GripVertical size={12} />
                  </div>

                  <div
                    className="symbol-shape-wrapper"
                    style={{ color: item.color }}
                  >
                    {item.svgShape}
                  </div>

                  <div className="symbol-details">
                    <span className="symbol-standard-tag" style={{ color: item.color }}>
                      {item.standardSymbol}
                    </span>
                    <span className="symbol-primary-name">{item.name}</span>
                    <span className="symbol-bn-name">{item.nameBn}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flowchart-guide-card">
            <div className="guide-title">Standard Notation:</div>
            <ul className="guide-list">
              <li><strong>Oval:</strong> Start/End of a survey group</li>
              <li><strong>Parallelogram:</strong> Farmer question input</li>
              <li><strong>Diamond:</strong> Conditional branch (Match/&gt;/&lt;)</li>
              <li><strong>Circle:</strong> Inter-group jump connector</li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 2: REUSABLE QUESTION GROUPS */}
      {activeTab === 'groups' && (
        <div className="palette-container groups-palette-container">
          <div className="sidebar-group-list">
            {filteredGroups.length === 0 ? (
              <div className="sidebar-search-empty">
                <Layers size={26} className="empty-search-icon" />
                <span className="empty-search-title">No question groups found</span>
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
              filteredGroups.map((group) => (
                <div
                  key={group.id}
                  className="sidebar-group-card"
                  style={{ borderLeftColor: group.color }}
                  draggable
                  onDragStart={(e) => onDragStartGroup(e, group)}
                >
                  <div className="sidebar-group-card-top">
                    <div className="sidebar-group-info">
                      <span
                        className="group-cat-mini"
                        style={{ color: group.color }}
                      >
                        <Tag size={9} />
                        <span>{group.category.toUpperCase()}</span>
                      </span>
                      <span className="sidebar-group-title">{group.name}</span>
                      <span className="sidebar-group-bn bn-font">{group.nameBn}</span>
                    </div>

                    <div className="sidebar-group-actions-mini" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        className="btn-insert-group-mini"
                        onClick={() => onInsertGroup?.(group)}
                        title="Insert this group into canvas"
                      >
                        <Plus size={13} />
                        <span>Insert</span>
                      </button>
                      {onDeleteGroup && (
                        <button
                          type="button"
                          className="btn-card-action btn-delete-action"
                          style={{ width: 26, height: 26, padding: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setGroupToDelete(group);
                          }}
                          title="Delete Group from Library"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="sidebar-group-q-preview">
                    <span className="sidebar-group-count">
                      {group.questions.length} questions:
                    </span>
                    <div className="sidebar-q-tags">
                      {group.questions.slice(0, 3).map((q, idx) => (
                        <span key={idx} className="sidebar-q-tag">
                          {q.answer_type}
                        </span>
                      ))}
                      {group.questions.length > 3 && (
                        <span className="sidebar-q-tag more">
                          +{group.questions.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {onNavigateToGroups && (
            <div className="sidebar-manage-groups-box">
              <button
                className="btn btn-secondary btn-manage-groups"
                onClick={onNavigateToGroups}
              >
                <ExternalLink size={13} />
                <span>Manage Question Groups Library</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {groupToDelete && (
        <div className="modal-backdrop" onClick={() => setGroupToDelete(null)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 440, maxWidth: '95vw' }}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="modal-title">Delete Question Group?</h3>
                  <span className="modal-subtitle">
                    Permanent deletion from reusable library
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setGroupToDelete(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '12px 16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    className="group-cat-pill"
                    style={{
                      backgroundColor: `${groupToDelete.color}20`,
                      color: groupToDelete.color,
                      borderColor: `${groupToDelete.color}40`,
                    }}
                  >
                    {groupToDelete.category.toUpperCase()}
                  </span>
                  <span className="q-count-badge">
                    {groupToDelete.questions.length} Questions
                  </span>
                </div>
                <h4
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#f8fafc',
                    margin: 0,
                  }}
                >
                  {groupToDelete.name}
                </h4>
                {groupToDelete.nameBn && (
                  <span
                    className="bn-font"
                    style={{ fontSize: 12, color: 'var(--text-muted)' }}
                  >
                    {groupToDelete.nameBn}
                  </span>
                )}
              </div>

              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginTop: 14,
                  marginBottom: 0,
                  lineHeight: 1.5,
                }}
              >
                Are you sure you want to permanently delete this group? Any surveys that currently contain these questions will remain unaffected.
              </p>
            </div>

            <div className="modal-footer">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  width: '100%',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setGroupToDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-confirm-delete"
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    onDeleteGroup?.(groupToDelete.id);
                    setGroupToDelete(null);
                  }}
                >
                  <Trash2 size={14} />
                  <span>Delete Group</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
