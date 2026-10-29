import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  GitBranch,
  FastForward,
  HelpCircle,
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
  Search,
  Layers,
  GripVertical,
} from 'lucide-react';
import type { AnswerType, FlowNodeType } from '../../types/survey';

interface PaletteItem {
  id: string;
  name: string;
  nameBn: string;
  nodeType: FlowNodeType;
  answerType?: AnswerType;
  icon: React.ReactNode;
  category: 'flowchart' | 'widgets';
  color: string;
  description: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  // Flowchart Symbols
  {
    id: 'flow-start',
    name: 'Group Start',
    nameBn: 'গ্রুপ শুরুর পয়েন্ট',
    nodeType: 'start',
    icon: <Play size={16} />,
    category: 'flowchart',
    color: '#10b981',
    description: 'Entrypoint for this questionnaire group',
  },
  {
    id: 'flow-question',
    name: 'Generic Question',
    nameBn: 'সাধারণ প্রশ্ন',
    nodeType: 'question',
    answerType: 'string',
    icon: <HelpCircle size={16} />,
    category: 'flowchart',
    color: '#0284c7',
    description: 'Standard question block',
  },
  {
    id: 'flow-decision',
    name: 'Decision / Branch',
    nameBn: 'শর্ত / লজিক্যাল শাখা',
    nodeType: 'decision',
    icon: <GitBranch size={16} />,
    category: 'flowchart',
    color: '#f59e0b',
    description: 'Routes questions by Match, Greater, or Less rules',
  },
  {
    id: 'flow-jump',
    name: 'Group Jump',
    nameBn: 'গ্রুপ জাম্প লক্ষ্য',
    nodeType: 'groupJump',
    icon: <FastForward size={16} />,
    category: 'flowchart',
    color: '#8b5cf6',
    description: 'Jump to non-consecutive question groups',
  },
  {
    id: 'flow-end',
    name: 'Group End',
    nameBn: 'গ্রুপ সমাপ্তি / সাবমিট',
    nodeType: 'end',
    icon: <CheckCircle2 size={16} />,
    category: 'flowchart',
    color: '#6366f1',
    description: 'Transitions to next group or final loan submission',
  },

  // Input Type Views
  {
    id: 'widget-text',
    name: 'Single Text Input',
    nameBn: 'সংক্ষিপ্ত টেক্সট',
    nodeType: 'question',
    answerType: 'string',
    icon: <Type size={16} />,
    category: 'widgets',
    color: '#0284c7',
    description: 'Single-line text entry (Name, Father name, etc.)',
  },
  {
    id: 'widget-bigtext',
    name: 'Long Text / Textarea',
    nameBn: 'বিস্তারিত টেক্সট',
    nodeType: 'question',
    answerType: 'text',
    icon: <AlignLeft size={16} />,
    category: 'widgets',
    color: '#0369a1',
    description: 'Multi-line comments or descriptions',
  },
  {
    id: 'widget-integer',
    name: 'Number Input',
    nameBn: 'সংখ্যা / পূর্ণসংখ্যা',
    nodeType: 'question',
    answerType: 'integer',
    icon: <Hash size={16} />,
    category: 'widgets',
    color: '#7c3aed',
    description: 'Numeric inputs (Amount, Land size in decimals)',
  },
  {
    id: 'widget-phone',
    name: 'Bangladeshi Phone',
    nameBn: 'মোবাইল নম্বর',
    nodeType: 'question',
    answerType: 'phone',
    icon: <Phone size={16} />,
    category: 'widgets',
    color: '#059669',
    description: 'Validated 11-digit BD telephone number',
  },
  {
    id: 'widget-dropdown',
    name: 'Dropdown Spinner',
    nameBn: 'ড্রপডাউন অপশন',
    nodeType: 'question',
    answerType: 'dropdown',
    icon: <ListFilter size={16} />,
    category: 'widgets',
    color: '#ea580c',
    description: 'Single selection from a dropdown list',
  },
  {
    id: 'widget-radio',
    name: 'Radio Chips (Select One)',
    nameBn: 'রেডিও চিপস (একক নির্বাচন)',
    nodeType: 'question',
    answerType: 'select_one',
    icon: <Radio size={16} />,
    category: 'widgets',
    color: '#d97706',
    description: 'Single-choice Material Chip selection',
  },
  {
    id: 'widget-checkbox',
    name: 'Multi-Check Chips',
    nameBn: 'একাধিক নির্বাচন চিপস',
    nodeType: 'question',
    answerType: 'select_multiple',
    icon: <CheckSquare size={16} />,
    category: 'widgets',
    color: '#2563eb',
    description: 'Multi-choice comma-separated answers',
  },
  {
    id: 'widget-date',
    name: 'Calendar Date Picker',
    nameBn: 'তারিখ নির্বাচন',
    nodeType: 'question',
    answerType: 'calendar',
    icon: <Calendar size={16} />,
    category: 'widgets',
    color: '#db2777',
    description: 'Native DatePickerDialog date picker',
  },
  {
    id: 'widget-image',
    name: 'Photo Uploader + GPS',
    nameBn: 'ছবি আপলোড ও লোকেশন',
    nodeType: 'question',
    answerType: 'image',
    icon: <Image size={16} />,
    category: 'widgets',
    color: '#10b981',
    description: 'Camera capture with WebP compression & GPS enforcement',
  },
  {
    id: 'widget-readonly',
    name: 'Read Only Context',
    nameBn: 'শুধুমাত্র পড়ার নোট',
    nodeType: 'question',
    answerType: 'read_only',
    icon: <Eye size={16} />,
    category: 'widgets',
    color: '#64748b',
    description: 'Display static instructions or verified badges',
  },
];

export const LeftSidebar: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'flowchart' | 'widgets'>('all');

  const onDragStart = (
    event: React.DragEvent,
    nodeType: FlowNodeType,
    answerType?: AnswerType,
    name?: string,
    nameBn?: string
  ) => {
    event.dataTransfer.setData(
      'application/reactflow-node',
      JSON.stringify({
        nodeType,
        answerType,
        name,
        nameBn,
      })
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredItems = PALETTE_ITEMS.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.nameBn.includes(search) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || item.category === activeTab;
    return matchesSearch && matchesTab;
  });

  const flowchartItems = filteredItems.filter((i) => i.category === 'flowchart');
  const widgetItems = filteredItems.filter((i) => i.category === 'widgets');

  return (
    <aside className="sidebar left-sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-title-wrapper">
          <Layers size={18} className="sidebar-title-icon text-emerald" />
          <h2 className="sidebar-title">Components</h2>
        </div>
        <p className="sidebar-subtitle">Drag flowchart symbols & widgets onto the canvas</p>
      </div>

      {/* Search Input */}
      <div className="search-box">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Search symbols or widgets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Tabs */}
      <div className="palette-tabs">
        <button
          className={`tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All ({PALETTE_ITEMS.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'flowchart' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('flowchart')}
        >
          Flowchart
        </button>
        <button
          className={`tab-btn ${activeTab === 'widgets' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('widgets')}
        >
          Input Views
        </button>
      </div>

      {/* Scrollable Palette List */}
      <div className="palette-container">
        {/* Flowchart Symbols Section */}
        {flowchartItems.length > 0 && (
          <div className="palette-section">
            <h3 className="section-title">Flowchart Symbols</h3>
            <div className="palette-grid">
              {flowchartItems.map((item) => (
                <div
                  key={item.id}
                  className="palette-card flowchart-card"
                  draggable
                  onDragStart={(e) =>
                    onDragStart(e, item.nodeType, item.answerType, item.name, item.nameBn)
                  }
                  title="Drag and drop onto canvas"
                >
                  <div className="card-drag-indicator">
                    <GripVertical size={12} />
                  </div>
                  <div
                    className="card-icon-box"
                    style={{ color: item.color, backgroundColor: `${item.color}15` }}
                  >
                    {item.icon}
                  </div>
                  <div className="card-info">
                    <span className="card-name">{item.name}</span>
                    <span className="card-bn">{item.nameBn}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Type Views Section */}
        {widgetItems.length > 0 && (
          <div className="palette-section">
            <h3 className="section-title">Input Type Views</h3>
            <div className="palette-grid">
              {widgetItems.map((item) => (
                <div
                  key={item.id}
                  className="palette-card widget-card"
                  draggable
                  onDragStart={(e) =>
                    onDragStart(e, item.nodeType, item.answerType, item.name, item.nameBn)
                  }
                  title={item.description}
                >
                  <div className="card-drag-indicator">
                    <GripVertical size={12} />
                  </div>
                  <div
                    className="card-icon-box"
                    style={{ color: item.color, backgroundColor: `${item.color}15` }}
                  >
                    {item.icon}
                  </div>
                  <div className="card-info">
                    <span className="card-name">{item.name}</span>
                    <span className="card-bn">{item.nameBn}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
