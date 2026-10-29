import React, { useState } from 'react';
import { Search, GripVertical, Network } from 'lucide-react';
import type { FlowNodeType } from '../../types/survey';

interface FlowchartSymbol {
  id: string;
  name: string;
  nameBn: string;
  standardSymbol: string; // e.g. "Terminator", "Process", "Decision"
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
    id: 'symbol-process',
    name: 'Process / Action',
    nameBn: 'প্রক্রিয়া / অ্যাকশন (আয়তক্ষেত্র)',
    standardSymbol: 'Process (Rectangle)',
    nodeType: 'process',
    color: '#6366f1',
    description: 'Executes an automated computation or system step',
    svgShape: (
      <svg viewBox="0 0 44 26" className="symbol-svg" fill="none">
        <rect x="2" y="3" width="40" height="20" rx="3" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
        <line x1="8" y1="10" x2="36" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="16" x2="26" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'symbol-jump',
    name: 'Connector / Group Jump',
    nameBn: 'কানেক্টর / গ্রুপ জাম্প (বৃত্ত)',
    standardSymbol: 'Connector (Circle)',
    nodeType: 'groupJump',
    color: '#8b5cf6',
    description: 'Routes flow to another questionnaire group',
    svgShape: (
      <svg viewBox="0 0 44 26" className="symbol-svg" fill="none">
        <circle cx="22" cy="13" r="10" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
        <polyline points="18,13 24,13 21,9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="18,13 24,13 21,17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'symbol-document',
    name: 'Document / Agreement',
    nameBn: 'ডকুমেন্ট / সম্মতিপত্র (তরঙ্গায়িত)',
    standardSymbol: 'Document (Wave Base)',
    nodeType: 'document',
    color: '#06b6d4',
    description: 'Farmer consent, terms, or PDF agreement step',
    svgShape: (
      <svg viewBox="0 0 44 26" className="symbol-svg" fill="none">
        <path d="M4,3 L40,3 L40,19 C34,16 30,22 24,19 C18,16 14,22 4,19 Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
        <line x1="10" y1="9" x2="34" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'symbol-end',
    name: 'End Terminator',
    nameBn: 'গ্রুপ সমাপ্তি / সাবমিট',
    standardSymbol: 'Terminator (Oval)',
    nodeType: 'end',
    color: '#ec4899',
    description: 'Submits survey or advances to final loan creation',
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
}

export const FlowchartSymbolsPanel: React.FC<FlowchartSymbolsPanelProps> = ({
  onAddSymbol,
}) => {
  const [search, setSearch] = useState('');

  const onDragStart = (
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

  const filteredSymbols = FLOWCHART_SYMBOLS.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.nameBn.includes(search) ||
      s.standardSymbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="sidebar left-sidebar flowchart-symbols-sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-title-wrapper">
          <Network size={18} className="sidebar-title-icon text-emerald" />
          <h2 className="sidebar-title">Flowchart Symbols</h2>
        </div>
        <p className="sidebar-subtitle">Drag standard flowchart shapes onto canvas</p>
      </div>

      {/* Search Input */}
      <div className="search-box">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Filter flowchart symbols..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Symbols List */}
      <div className="palette-container">
        <div className="symbols-list">
          {filteredSymbols.map((item) => (
            <div
              key={item.id}
              className="flowchart-symbol-card"
              draggable
              onDragStart={(e) =>
                onDragStart(e, item.nodeType, item.name, item.nameBn)
              }
              onClick={() => onAddSymbol?.(item.nodeType, item.name, item.nameBn)}
              title={`${item.standardSymbol}: ${item.description} (Drag or Click to add)`}
            >
              <div className="card-drag-indicator">
                <GripVertical size={12} />
              </div>

              {/* Graphic SVG Shape representation */}
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
          ))}
        </div>

        {/* Informational Footer Card */}
        <div className="flowchart-guide-card">
          <div className="guide-title">Standard Notation:</div>
          <ul className="guide-list">
            <li><strong>Oval:</strong> Start/End of a survey group</li>
            <li><strong>Parallelogram:</strong> Farmer question input</li>
            <li><strong>Diamond:</strong> Conditional branch (Match/&gt;/&lt;)</li>
            <li><strong>Circle:</strong> Inter-group jump or connector</li>
          </ul>
        </div>
      </div>
    </aside>
  );
};
