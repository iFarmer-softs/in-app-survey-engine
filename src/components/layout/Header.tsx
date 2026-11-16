import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  GitBranch,
  History,
  GitCommit,
  Rocket,
  ChevronDown,
  SlidersHorizontal,
  Undo2,
  Redo2,
  GitFork,
  Crop,
  Trash2,
  Check,
  Plus,
  Layers,
  Pin,
  PinOff,
  GripVertical,
  Search,
  X,
} from 'lucide-react';
import type { GroupMeta } from '../../utils/schemaCompiler';
import type { FlowNodeType, AnswerType } from '../../types/survey';
import type { ReusableQuestionGroup } from '../../types/group';
import type { CanvasToolMode } from '../canvas/FigmaToolbar';
import type { ThemeMode, ResolvedTheme } from '../../hooks/useTheme';
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

export type FlyoutTab = 'all' | 'questions' | 'logic' | 'groups';

interface HeaderProps {
  projectTitle?: string;
  currentVersion?: string;
  versionStatus?: 'published' | 'draft' | 'archived';
  groupMeta: GroupMeta;
  onOpenJsonModal?: () => void;
  onOpenMobileModal?: () => void;
  onResetSample: () => void;
  onClearCanvas?: () => void;
  onAutoLayout: () => void;
  onBackToList?: () => void;
  nodeCount: number;
  edgeCount: number;
  diagnosticsCount: number;
  diagnosticsErrors: number;
  onOpenDiagnostics: () => void;
  onAlignHorizontal: () => void;
  onAlignVertical: () => void;
  onOpenVersionHistory?: () => void;
  onOpenCreateSnapshot?: () => void;
  onPublishVersion?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  isPathTracingEnabled?: boolean;
  onTogglePathTracing?: () => void;
  onAddGroupArea?: () => void;
  isServerConnected?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
  // Creation tools integrated from left dock:
  activeToolMode?: CanvasToolMode;
  onSelectMode?: (mode: CanvasToolMode) => void;
  onAddSymbol?: (nodeType: FlowNodeType, name: string, nameBn: string) => void;
  onAddQuestion?: (
    answerType: AnswerType,
    name: string,
    nameBn: string,
    options?: string
  ) => void;
  groups?: ReusableQuestionGroup[];
  onInsertGroup?: (group: ReusableQuestionGroup) => void;
  onNavigateToGroups?: () => void;
  theme?: ThemeMode;
  resolvedTheme?: ResolvedTheme;
  onCycleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectTitle,
  currentVersion = '1.0.0',
  versionStatus = 'draft',
  groupMeta: _groupMeta,
  onOpenJsonModal: _onOpenJsonModal,
  onOpenMobileModal: _onOpenMobileModal,
  onResetSample,
  onClearCanvas,
  onAutoLayout,
  onBackToList,
  nodeCount: _nodeCount,
  edgeCount: _edgeCount,
  diagnosticsCount,
  diagnosticsErrors,
  onOpenDiagnostics,
  onAlignHorizontal,
  onAlignVertical,
  onOpenVersionHistory,
  onOpenCreateSnapshot,
  onPublishVersion,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  isPathTracingEnabled = true,
  onTogglePathTracing,
  onAddGroupArea,
  isServerConnected = false,
  onSave: _onSave,
  isSaving: _isSaving = false,
  isSaved: _isSaved = false,
  activeToolMode = 'select',
  onSelectMode,
  onAddSymbol,
  onAddQuestion,
  groups = [],
  onInsertGroup,
  onNavigateToGroups,
  theme: _theme,
  resolvedTheme: _resolvedTheme = 'dark',
  onCycleTheme: _onCycleTheme,
}) => {
  const [isVersionMenuOpen, setIsVersionMenuOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  // Floating Flyout Drawer state
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [activeTab, setActiveTab] = useState<FlyoutTab>('all');
  const [search, setSearch] = useState('');
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const versionDropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const flyoutToggleRef = useRef<HTMLButtonElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        versionDropdownRef.current &&
        !versionDropdownRef.current.contains(target)
      ) {
        setIsVersionMenuOpen(false);
      }
      if (
        toolsDropdownRef.current &&
        !toolsDropdownRef.current.contains(target)
      ) {
        setIsToolsMenuOpen(false);
      }
      if (
        !isPinned &&
        flyoutRef.current &&
        !flyoutRef.current.contains(target) &&
        flyoutToggleRef.current &&
        !flyoutToggleRef.current.contains(target)
      ) {
        setIsFlyoutOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPinned]);

  // Global shortcut: Q toggles Questions drawer, Esc closes unpinned
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'q' || e.key === 'Q') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setIsFlyoutOpen((prev) => !prev);
          if (!isFlyoutOpen) {
            setActiveTab('questions');
          }
        }
      } else if (e.key === 'Escape') {
        if (isFlyoutOpen && !isPinned) {
          setIsFlyoutOpen(false);
        }
        setIsVersionMenuOpen(false);
        setIsToolsMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlyoutOpen, isPinned]);

  const toggleFlyoutTab = (tab: FlyoutTab) => {
    if (isFlyoutOpen && activeTab === tab) {
      if (!isPinned) {
        setIsFlyoutOpen(false);
      }
    } else {
      setActiveTab(tab);
      setIsFlyoutOpen(true);
    }
  };

  // Drag and drop start handlers
  const onDragStartLogic = (event: React.DragEvent, item: FlowLogicItem) => {
    const payload = JSON.stringify({
      nodeType: item.nodeType,
      name: item.title,
      nameBn: item.titleBn,
    });
    event.dataTransfer.setData('application/reactflow-node', payload);
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.effectAllowed = 'copyMove';
  };

  const onDragStartQuestion = (event: React.DragEvent, item: InputTypeItem) => {
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

  const onDragStartGroup = (
    event: React.DragEvent,
    grp: ReusableQuestionGroup
  ) => {
    const payload = JSON.stringify(grp);
    event.dataTransfer.setData('application/reactflow-question-group', payload);
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleQuickAddQuestion = (item: InputTypeItem) => {
    if (onAddQuestion) {
      onAddQuestion(
        item.type,
        item.title,
        item.titleBn,
        item.defaultOptions
      );
    } else if (onAddSymbol) {
      onAddSymbol('question', item.title, item.titleBn);
    }
    setJustAddedId(item.type);
    setTimeout(() => setJustAddedId(null), 800);
  };

  const handleQuickAddLogic = (item: FlowLogicItem) => {
    onAddSymbol?.(item.nodeType, item.title, item.titleBn);
    setJustAddedId(item.id);
    setTimeout(() => setJustAddedId(null), 800);
  };

  const handleQuickInsertGroup = (grp: ReusableQuestionGroup) => {
    onInsertGroup?.(grp);
    setJustAddedId(grp.id);
    setTimeout(() => setJustAddedId(null), 800);
  };

  const handleToggleDrawArea = () => {
    if (onSelectMode) {
      if (activeToolMode === 'drawArea') {
        onSelectMode('select');
      } else {
        onSelectMode('drawArea');
      }
    }
  };

  // Filtered lists for the flyout drawer
  const filteredLogicItems = useMemo(() => {
    if (activeTab === 'questions' || activeTab === 'groups') return [];
    if (!search.trim()) return FLOW_LOGIC_ITEMS;
    const q = search.toLowerCase().trim();
    return FLOW_LOGIC_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.titleBn && item.titleBn.toLowerCase().includes(q)) ||
        item.badge.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [search, activeTab]);

  const filteredQuestionTypes = useMemo(() => {
    if (activeTab === 'logic' || activeTab === 'groups') return [];
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
  }, [search, activeTab]);

  const filteredGroups = useMemo(() => {
    if (activeTab === 'questions' || activeTab === 'logic') return [];
    if (!search.trim()) return groups;
    const q = search.toLowerCase().trim();
    return groups.filter(
      (grp) =>
        grp.name.toLowerCase().includes(q) ||
        (grp.nameBn && grp.nameBn.toLowerCase().includes(q)) ||
        grp.category.toLowerCase().includes(q) ||
        grp.description.toLowerCase().includes(q)
    );
  }, [search, groups, activeTab]);

  const totalResults =
    filteredLogicItems.length +
    filteredQuestionTypes.length +
    filteredGroups.length;

  return (
    <header className="app-header">
      {/* 1. Left Island: Identity & Release */}
      <div className="header-brand">
        {onBackToList && (
          <button
            type="button"
            className="header-icon-btn header-back-list-btn"
            onClick={onBackToList}
            data-tooltip="Back to All Flowcharts"
            data-tooltip-pos="bottom-right"
            aria-label="Back to All Flowcharts"
          >
            <ArrowLeft size={16} />
          </button>
        )}

        <div className="brand-titles">
          <div className="brand-name-row">
            <span className="brand-product">
              {projectTitle || 'SurveyFlow Studio'}
            </span>

            {/* Version Indicator Dropdown */}
            <div
              className="header-version-dropdown-container"
              ref={versionDropdownRef}
            >
              <button
                type="button"
                className="header-version-pill"
                onClick={() => setIsVersionMenuOpen((prev) => !prev)}
                data-tooltip="Flowchart Releases & History"
                data-tooltip-pos="bottom-right"
                aria-label="Flowchart Releases & History"
              >
                <GitBranch size={12} className="version-pill-icon" />
                <span className="version-pill-text">v{currentVersion}</span>
                <span className={`version-pill-tag tag-${versionStatus}`}>
                  {versionStatus === 'published' ? 'Live' : 'Draft'}
                </span>
                <ChevronDown
                  size={11}
                  className={`version-chevron ${
                    isVersionMenuOpen ? 'is-rotated' : ''
                  }`}
                />
              </button>

              {isVersionMenuOpen && (
                <div className="header-version-menu animate-in">
                  <div className="menu-header-info">
                    <span className="menu-current-ver">
                      Current: v{currentVersion}
                    </span>
                    <span className="menu-current-status">
                      {versionStatus === 'published'
                        ? '🟢 Published production release'
                        : '🟡 Working draft (unreleased)'}
                    </span>
                  </div>

                  <div className="menu-divider" />

                  {onOpenCreateSnapshot && (
                    <button
                      type="button"
                      className="version-menu-item"
                      onClick={() => {
                        setIsVersionMenuOpen(false);
                        onOpenCreateSnapshot();
                      }}
                    >
                      <GitCommit size={15} className="menu-icon text-blue-400" />
                      <div className="menu-text-wrap">
                        <span className="menu-title">Save Draft Snapshot</span>
                        <span className="menu-desc">
                          Record an immutable working checkpoint
                        </span>
                      </div>
                    </button>
                  )}

                  {onPublishVersion && (
                    <button
                      type="button"
                      className="version-menu-item"
                      onClick={() => {
                        setIsVersionMenuOpen(false);
                        onPublishVersion();
                      }}
                    >
                      <Rocket
                        size={15}
                        className="menu-icon text-emerald-400"
                      />
                      <div className="menu-text-wrap">
                        <span className="menu-title">Publish Version</span>
                        <span className="menu-desc">
                          Bump version and promote to production
                        </span>
                      </div>
                    </button>
                  )}

                  {onOpenVersionHistory && (
                    <>
                      <div className="menu-divider" />
                      <button
                        type="button"
                        className="version-menu-item"
                        onClick={() => {
                          setIsVersionMenuOpen(false);
                          onOpenVersionHistory();
                        }}
                      >
                        <History
                          size={15}
                          className="menu-icon text-purple-400"
                        />
                        <div className="menu-text-wrap">
                          <span className="menu-title">
                            Version History & Diff
                          </span>
                          <span className="menu-desc">
                            Timeline, audit notes, rollback, and JSON export
                          </span>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Backend Server Connectivity Status Dot */}
            <div
              className={`header-server-status-dot ${isServerConnected ? 'connected' : 'offline'}`}
              data-tooltip={
                isServerConnected
                  ? 'Connected to Spring Boot API (:8080)'
                  : 'Backend Offline (Using Local Storage Cache)'
              }
              data-tooltip-pos="bottom-right"
            />
          </div>
        </div>
      </div>

      {/* 2. Top-Center Island: Creation & Canvas Tools Dock (Reorganized from Left Dock) */}
      <div className="header-meta header-center-dock">
        {/* Creation Tool 1: Add Questions & Elements (Plus) */}
        <button
          type="button"
          ref={flyoutToggleRef}
          className={`header-icon-btn ${
            isFlyoutOpen && (activeTab === 'questions' || activeTab === 'all')
              ? 'is-active'
              : ''
          }`}
          onClick={() => toggleFlyoutTab('questions')}
          data-tooltip="Add Questions & Elements (Q)"
          data-tooltip-pos="bottom"
          aria-label="Add Questions & Elements"
        >
          <Plus size={16} />
        </button>

        {/* Creation Tool 2: Condition / Branch (Draggable onto canvas or click to add) */}
        <div
          className="header-icon-btn figma-draggable-item"
          draggable
          onDragStart={(e) => onDragStartLogic(e, FLOW_LOGIC_ITEMS[0])}
          onClick={() => handleQuickAddLogic(FLOW_LOGIC_ITEMS[0])}
          data-tooltip="Condition / Branch (Drag to canvas)"
          data-tooltip-pos="bottom"
          aria-label="Condition / Branch"
        >
          <GitBranch size={15} className="text-amber-400" />
        </div>

        {/* Creation Tool 3: Group Area Mode Toggle (Crop) */}
        <button
          type="button"
          className={`header-icon-btn ${activeToolMode === 'drawArea' ? 'is-active' : ''}`}
          onClick={(e) => {
            if (e.altKey && onAddGroupArea) {
              onAddGroupArea();
              return;
            }
            handleToggleDrawArea();
          }}
          data-tooltip={
            activeToolMode === 'drawArea'
              ? 'Draw Area Mode Active (F)'
              : 'Draw Group Area (F)'
          }
          data-tooltip-pos="bottom"
          aria-label="Draw Group Area"
        >
          <Crop
            size={15}
            className={activeToolMode === 'drawArea' ? 'text-cyan-400' : ''}
          />
        </button>

        {/* Creation Tool 4: Reusable Question Groups Library */}
        <button
          type="button"
          className={`header-icon-btn ${
            isFlyoutOpen && activeTab === 'groups' ? 'is-active' : ''
          }`}
          onClick={() => toggleFlyoutTab('groups')}
          data-tooltip="Question Groups Library"
          data-tooltip-pos="bottom"
          aria-label="Question Groups Library"
        >
          <Layers size={15} />
          {groups.length > 0 && <span className="header-dot-indicator" />}
        </button>

        <div className="header-dock-divider" />

        {/* History: Undo */}
        <button
          type="button"
          className="header-icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          data-tooltip="Undo (Ctrl+Z)"
          data-tooltip-pos="bottom"
          aria-label="Undo"
        >
          <Undo2 size={15} />
        </button>

        {/* History: Redo */}
        <button
          type="button"
          className="header-icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          data-tooltip="Redo (Ctrl+Y)"
          data-tooltip-pos="bottom"
          aria-label="Redo"
        >
          <Redo2 size={15} />
        </button>

        {/* Dependency Path Tracing */}
        {onTogglePathTracing && (
          <button
            type="button"
            className={`header-icon-btn ${isPathTracingEnabled ? 'is-active-cyan' : ''}`}
            onClick={onTogglePathTracing}
            data-tooltip={
              isPathTracingEnabled
                ? 'Dependency Path Tracing (ON)'
                : 'Dependency Path Tracing (OFF)'
            }
            data-tooltip-pos="bottom"
            aria-label="Dependency Path Tracing"
          >
            <GitFork size={15} />
          </button>
        )}

        {/* Canvas Tools & Alignment Dropdown */}
        <div className="header-tools-dropdown-container" ref={toolsDropdownRef}>
          <button
            type="button"
            className={`header-icon-btn ${isToolsMenuOpen ? 'is-active' : ''}`}
            onClick={() => setIsToolsMenuOpen((prev) => !prev)}
            data-tooltip="Canvas Layout & Alignment"
            data-tooltip-pos="bottom"
            aria-label="Canvas Layout & Alignment"
          >
            <SlidersHorizontal size={15} />
          </button>

          {isToolsMenuOpen && (
            <div className="header-tools-menu animate-in">
              <div className="tools-section-title">Layout & Alignment</div>
              <button
                type="button"
                className="tools-menu-item"
                onClick={() => {
                  setIsToolsMenuOpen(false);
                  onAutoLayout();
                }}
              >
                <Sparkles size={14} className="text-emerald-400" />
                <div className="tools-item-text">
                  <span className="tools-title">Tree Auto Layout</span>
                  <span className="tools-sub">Re-arrange hierarchy neatly</span>
                </div>
              </button>

              {onAddGroupArea && (
                <button
                  type="button"
                  className="tools-menu-item"
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    onAddGroupArea();
                  }}
                >
                  <Crop size={14} className="text-cyan-400" />
                  <div className="tools-item-text">
                    <span className="tools-title">Add Group Area</span>
                    <span className="tools-sub">Create a new bounded section</span>
                  </div>
                </button>
              )}

              <div className="tools-align-row">
                <button
                  type="button"
                  className="tools-compact-btn"
                  onClick={() => {
                    onAlignHorizontal();
                  }}
                  title="Align selected nodes horizontally (Center Y)"
                >
                  <AlignHorizontalDistributeCenter size={13} />
                  <span>Align Horizontal</span>
                </button>
                <button
                  type="button"
                  className="tools-compact-btn"
                  onClick={() => {
                    onAlignVertical();
                  }}
                  title="Align selected nodes vertically (Center X)"
                >
                  <AlignVerticalDistributeCenter size={13} />
                  <span>Align Vertical</span>
                </button>
              </div>

              <div className="menu-divider" />

              <div className="tools-section-title">Canvas Reset</div>
              <button
                type="button"
                className="tools-menu-item item-danger"
                onClick={() => {
                  setIsToolsMenuOpen(false);
                  onClearCanvas?.();
                }}
              >
                <Trash2 size={14} />
                <div className="tools-item-text">
                  <span className="tools-title">Clear Canvas (Blank)</span>
                  <span className="tools-sub">Empty flowchart canvas</span>
                </div>
              </button>

              <button
                type="button"
                className="tools-menu-item"
                onClick={() => {
                  setIsToolsMenuOpen(false);
                  onResetSample();
                }}
              >
                <RotateCcw size={14} />
                <div className="tools-item-text">
                  <span className="tools-title">Load Sample KYC Flowchart</span>
                  <span className="tools-sub">Preview reference KYC survey</span>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="header-dock-divider" />

        {/* Real-time Flow Diagnostics Icon Button */}
        <button
          type="button"
          className={`header-icon-btn diagnostics-btn ${
            diagnosticsErrors > 0
              ? 'has-error'
              : diagnosticsCount > 0
              ? 'has-warning'
              : 'is-healthy'
          }`}
          onClick={onOpenDiagnostics}
          data-tooltip={
            diagnosticsErrors > 0
              ? `${diagnosticsErrors} Errors Detected`
              : diagnosticsCount > 0
              ? `${diagnosticsCount} Warnings`
              : 'Flow Valid — No Errors'
          }
          data-tooltip-pos="bottom"
          aria-label="Flow Diagnostics"
        >
          {diagnosticsErrors > 0 ? (
            <>
              <AlertTriangle size={15} className="text-red-400" />
              <span className="diagnostics-badge-number">{diagnosticsErrors}</span>
            </>
          ) : diagnosticsCount > 0 ? (
            <>
              <AlertTriangle size={15} className="text-amber-400" />
              <span className="diagnostics-badge-number">{diagnosticsCount}</span>
            </>
          ) : (
            <CheckCircle2 size={15} className="text-emerald-400" />
          )}
        </button>

        {/* Floating Flyout Drawer (Centered directly below the dock) */}
        {isFlyoutOpen && (
          <div className="top-flyout-drawer animate-in" ref={flyoutRef}>
            {/* Flyout Header */}
            <div className="flyout-header">
              <div className="flyout-title-row">
                <div className="flyout-title-badge">
                  <Sparkles size={14} className="text-emerald-400" />
                  <span className="flyout-title-text">Survey Elements</span>
                </div>
                <div className="flyout-header-actions">
                  <button
                    type="button"
                    className={`flyout-icon-btn ${isPinned ? 'is-pinned' : ''}`}
                    onClick={() => setIsPinned(!isPinned)}
                    data-tooltip={
                      isPinned
                        ? 'Unpin Drawer'
                        : 'Pin Drawer'
                    }
                    data-tooltip-pos="bottom-left"
                    aria-label="Pin or Unpin Drawer"
                  >
                    {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                  </button>
                  <button
                    type="button"
                    className="flyout-icon-btn"
                    onClick={() => setIsFlyoutOpen(false)}
                    data-tooltip="Close Drawer (Esc)"
                    data-tooltip-pos="bottom-left"
                    aria-label="Close Drawer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Flyout Search Bar */}
              <div className="flyout-search-wrap">
                <Search size={13} className="flyout-search-icon" />
                <input
                  type="text"
                  placeholder="Search question types & logic..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flyout-search-input"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    className="flyout-search-clear"
                    onClick={() => setSearch('')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flyout-tabs-row">
                <button
                  type="button"
                  className={`flyout-tab-pill ${activeTab === 'all' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`flyout-tab-pill ${
                    activeTab === 'questions' ? 'is-active' : ''
                  }`}
                  onClick={() => setActiveTab('questions')}
                >
                  Questions
                </button>
                <button
                  type="button"
                  className={`flyout-tab-pill ${
                    activeTab === 'logic' ? 'is-active' : ''
                  }`}
                  onClick={() => setActiveTab('logic')}
                >
                  Logic
                </button>
                <button
                  type="button"
                  className={`flyout-tab-pill ${
                    activeTab === 'groups' ? 'is-active' : ''
                  }`}
                  onClick={() => setActiveTab('groups')}
                >
                  Groups ({groups.length})
                </button>
              </div>
            </div>

            {/* Flyout Body */}
            <div className="flyout-body">
              {totalResults === 0 ? (
                <div className="flyout-empty-state">
                  <Layers size={24} className="text-slate-500" />
                  <span className="empty-title">No matching elements</span>
                  <span className="empty-sub">Try searching with other keywords</span>
                  <button
                    type="button"
                    className="flyout-clear-btn"
                    onClick={() => setSearch('')}
                  >
                    Reset Search
                  </button>
                </div>
              ) : (
                <>
                  {/* Logic Items */}
                  {filteredLogicItems.length > 0 && (
                    <div className="flyout-section">
                      <div className="flyout-section-heading">LOGIC & BRANCHES</div>
                      <div className="flyout-cards-list">
                        {filteredLogicItems.map((item) => (
                          <div
                            key={item.id}
                            className={`flyout-card ${
                              justAddedId === item.id ? 'just-added' : ''
                            }`}
                            draggable
                            onDragStart={(e) => onDragStartLogic(e, item)}
                            onClick={() => handleQuickAddLogic(item)}
                            title={`${item.title} — Drag onto canvas or click to add`}
                          >
                            <div className="flyout-card-drag">
                              <GripVertical size={13} />
                            </div>
                            <div
                              className="flyout-card-icon"
                              style={{
                                color: item.color,
                                backgroundColor: `${item.color}18`,
                              }}
                            >
                              {item.icon}
                            </div>
                            <div className="flyout-card-content">
                              <div className="flyout-card-title-row">
                                <span className="flyout-card-title">
                                  {item.title}
                                </span>
                                <span
                                  className="flyout-card-badge"
                                  style={{
                                    color: item.color,
                                    backgroundColor: `${item.color}15`,
                                  }}
                                >
                                  {item.badge}
                                </span>
                              </div>
                              <span className="flyout-card-bn">{item.titleBn}</span>
                              <span className="flyout-card-desc">
                                {item.description}
                              </span>
                            </div>
                            {justAddedId === item.id && (
                              <div className="flyout-card-added-pill">
                                <Check size={11} />
                                <span>Added</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Question Types */}
                  {filteredQuestionTypes.length > 0 && (
                    <div className="flyout-section">
                      <div className="flyout-section-heading">
                        QUESTION TYPES ({filteredQuestionTypes.length})
                      </div>
                      <div className="flyout-cards-list">
                        {filteredQuestionTypes.map((item) => (
                          <div
                            key={item.type}
                            className={`flyout-card ${
                              justAddedId === item.type ? 'just-added' : ''
                            }`}
                            draggable
                            onDragStart={(e) => onDragStartQuestion(e, item)}
                            onClick={() => handleQuickAddQuestion(item)}
                            title={`${item.title} — Drag onto canvas or click to add`}
                          >
                            <div className="flyout-card-drag">
                              <GripVertical size={13} />
                            </div>
                            <div
                              className="flyout-card-icon"
                              style={{
                                color: item.color,
                                backgroundColor: `${item.color}15`,
                              }}
                            >
                              {item.icon}
                            </div>
                            <div className="flyout-card-content">
                              <div className="flyout-card-title-row">
                                <span className="flyout-card-title">
                                  {item.title}
                                </span>
                                <span
                                  className="flyout-card-badge"
                                  style={{
                                    color: item.color,
                                    backgroundColor: `${item.color}15`,
                                  }}
                                >
                                  {item.badge}
                                </span>
                              </div>
                              <span className="flyout-card-bn">{item.titleBn}</span>
                              <span className="flyout-card-desc">
                                {item.description}
                              </span>
                            </div>
                            {justAddedId === item.type && (
                              <div className="flyout-card-added-pill">
                                <Check size={11} />
                                <span>Added</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Question Groups */}
                  {filteredGroups.length > 0 && (
                    <div className="flyout-section">
                      <div
                        className="flyout-section-heading"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>
                          QUESTION GROUP TEMPLATES ({filteredGroups.length})
                        </span>
                        {onNavigateToGroups && (
                          <button
                            type="button"
                            className="flyout-tab-pill"
                            onClick={onNavigateToGroups}
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              color: '#10b981',
                            }}
                            title="Open Question Group Designer Studio"
                          >
                            Studio →
                          </button>
                        )}
                      </div>
                      <div className="flyout-cards-list">
                        {filteredGroups.map((grp) => (
                          <div
                            key={grp.id}
                            className={`flyout-card flyout-group-card ${
                              justAddedId === grp.id ? 'just-added' : ''
                            }`}
                            draggable
                            onDragStart={(e) => onDragStartGroup(e, grp)}
                            onClick={() => handleQuickInsertGroup(grp)}
                            title={`Insert ${grp.name} into canvas (${grp.questions.length} questions)`}
                          >
                            <div className="flyout-card-drag">
                              <GripVertical size={13} />
                            </div>
                            <div
                              className="flyout-card-icon"
                              style={{
                                color: grp.color,
                                backgroundColor: `${grp.color}20`,
                              }}
                            >
                              <Layers size={16} />
                            </div>
                            <div className="flyout-card-content">
                              <div className="flyout-card-title-row">
                                <span className="flyout-card-title">
                                  {grp.name}
                                </span>
                                <span
                                  className="flyout-card-badge"
                                  style={{
                                    color: grp.color,
                                    backgroundColor: `${grp.color}18`,
                                  }}
                                >
                                  {grp.category.toUpperCase()}
                                </span>
                              </div>
                              {grp.nameBn && (
                                <span className="flyout-card-bn">{grp.nameBn}</span>
                              )}
                              <span className="flyout-card-desc">
                                {grp.questions.length} Questions • {grp.description}
                              </span>
                            </div>
                            {justAddedId === grp.id && (
                              <div className="flyout-card-added-pill">
                                <Check size={11} />
                                <span>Added</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Flyout Footer */}
            <div className="flyout-footer">
              <Sparkles size={12} className="text-emerald-400 shrink-0" />
              <span className="flyout-footer-tip">
                Drag elements directly to the canvas, or click once to insert.
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
