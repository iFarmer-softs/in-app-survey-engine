import React, { useState, useMemo } from 'react';
import {
  Search,
  GripVertical,
  Network,
  X,
  PanelLeftClose,
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
];

interface FlowchartSymbolsPanelProps {
  isOpen?: boolean;
  width?: number;
  isResizing?: boolean;
  onToggleCollapse?: () => void;
  onAddSymbol?: (nodeType: FlowNodeType, name: string, nameBn: string) => void;
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
}) => {
  const [search, setSearch] = useState('');

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
    event.dataTransfer.effectAllowed = 'copyMove';
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

  return (
    <aside
      className={`sidebar left-sidebar flowchart-symbols-sidebar ${!isOpen ? 'is-collapsed' : ''} ${isResizing ? 'is-resizing' : ''
        }`}
      style={isOpen && width ? { width: `${width}px`, minWidth: `${width}px` } : undefined}
    >
      {/* Top Header */}
      <div className="left-panel-tab-switcher" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px' }}>
            <Network size={15} style={{ color: 'var(--primary-color, #10b981)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.2px' }}>
              Flowchart Symbols
            </span>
          </div>

          {onToggleCollapse && (
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={onToggleCollapse}
              title="Collapse Sidebar (Ctrl+B)"
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
              placeholder="Filter symbols (name, type)..."
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

                {/* FLOWCHART SYMBOLS */}
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
                            <li><strong>Parallelogram:</strong> Farmer question input</li>
                            <li><strong>Diamond:</strong> Conditional branch (Match/&gt;/&lt;)</li>
                          </ul>
                        </div>
                      </div>
    </aside>
                  );
};
