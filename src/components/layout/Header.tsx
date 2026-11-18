import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  GitCommit,
  Rocket,
  ChevronDown,
  SlidersHorizontal,
  Undo2,
  Redo2,
  GitFork,
  Crop,
  Trash2,
  Plus,
  Layers,
} from 'lucide-react';
import type { GroupMeta } from '../../utils/schemaCompiler';
import type { FlowNodeType, AnswerType } from '../../types/survey';
import type { ReusableQuestionGroup } from '../../types/group';
import type { CanvasToolMode } from '../canvas/FigmaToolbar';
import type { ThemeMode, ResolvedTheme } from '../../hooks/useTheme';

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

interface HeaderProps {
  projectTitle?: string;
  currentVersion?: string;
  versionStatus?: 'published' | 'draft' | 'archived';
  groupMeta: GroupMeta;
  onOpenJsonModal?: () => void;
  onOpenMobileModal?: () => void;
  onResetSample?: () => void;
  onClearCanvas?: () => void;
  onAutoLayout?: () => void;
  onBackToList?: () => void;
  nodeCount: number;
  edgeCount: number;
  diagnosticsCount: number;
  diagnosticsErrors: number;
  onOpenDiagnostics: () => void;
  onAlignHorizontal?: () => void;
  onAlignVertical?: () => void;
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
  onResetSample: _onResetSample,
  onClearCanvas,
  onAutoLayout: _onAutoLayout,
  onBackToList,
  nodeCount: _nodeCount,
  edgeCount: _edgeCount,
  diagnosticsCount,
  diagnosticsErrors,
  onOpenDiagnostics,
  onAlignHorizontal: _onAlignHorizontal,
  onAlignVertical: _onAlignVertical,
  onOpenVersionHistory,
  onOpenCreateSnapshot,
  onPublishVersion,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isPathTracingEnabled,
  onTogglePathTracing,
  onAddGroupArea,
  isServerConnected,
  onSave: _onSave,
  isSaving: _isSaving,
  isSaved: _isSaved,
  activeToolMode,
  onSelectMode,
  onAddSymbol,
  onAddQuestion,
  groups = [],
  onInsertGroup: _onInsertGroup,
  onNavigateToGroups,
  theme: _theme,
  resolvedTheme: _resolvedTheme = 'dark',
  onCycleTheme: _onCycleTheme,
}) => {
  const [isVersionMenuOpen, setIsVersionMenuOpen] = useState(false);

  const versionDropdownRef = useRef<HTMLDivElement>(null);

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Global shortcut: Esc closes dropdown menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVersionMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const onDragStartQuestion = (event: React.DragEvent) => {
    const payload = JSON.stringify({
      nodeType: 'question',
      answerType: 'string',
      name: 'New Question',
      nameBn: 'নতুন প্রশ্ন',
      options: '',
    });
    event.dataTransfer.setData('application/reactflow-node', payload);
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleQuickAddQuestion = () => {
    if (onAddQuestion) {
      onAddQuestion('string', 'New Question', 'নতুন প্রশ্ন');
    } else if (onAddSymbol) {
      onAddSymbol('question', 'New Question', 'নতুন প্রশ্ন');
    }
  };

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

  const handleQuickAddLogic = (item: FlowLogicItem) => {
    onAddSymbol?.(item.nodeType, item.title, item.titleBn);
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

  return (
    <header className="app-header">
      {/* Standalone Separate Floating Back Button on Top Left */}
      {onBackToList && (
        <button
          type="button"
          className="header-icon-btn header-back-list-btn header-floating-back"
          onClick={onBackToList}
          data-tooltip="Back to All Flowcharts"
          data-tooltip-pos="bottom-right"
          aria-label="Back to All Flowcharts"
        >
          <ArrowLeft size={16} />
        </button>
      )}

      {/* Merged Top Floating Action Bar: Brand/Identity + Canvas Controls Dock */}
      <div className="header-brand header-meta header-center-dock">
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
                      <Rocket size={15} className="menu-icon text-emerald-400" />
                      <div className="menu-text-wrap">
                        <span className="menu-title">Publish Version (Release)</span>
                        <span className="menu-desc">
                          Bump SemVer & deploy live schema
                        </span>
                      </div>
                    </button>
                  )}

                  {onOpenVersionHistory && (
                    <button
                      type="button"
                      className="version-menu-item"
                      onClick={() => {
                        setIsVersionMenuOpen(false);
                        onOpenVersionHistory();
                      }}
                    >
                      <SlidersHorizontal size={15} className="menu-icon text-violet-400" />
                      <div className="menu-text-wrap">
                        <span className="menu-title">Version History & Rollback</span>
                        <span className="menu-desc">
                          Compare & rollback across releases
                        </span>
                      </div>
                    </button>
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

        <div className="header-dock-divider" />

        {/* Creation Tool 1: Question / Input (Draggable onto canvas or click to add) */}
        <div
          className="header-icon-btn figma-draggable-item"
          draggable
          onDragStart={onDragStartQuestion}
          onClick={handleQuickAddQuestion}
          data-tooltip="Question / Input (Click to add or drag to canvas)"
          data-tooltip-pos="bottom"
          aria-label="Question / Input"
        >
          <Plus size={16} className="text-cyan-400" />
        </div>

        {/* Creation Tool 2: Condition / Branch (Draggable onto canvas or click to add) */}
        <div
          className="header-icon-btn figma-draggable-item"
          draggable
          onDragStart={(e) => onDragStartLogic(e, FLOW_LOGIC_ITEMS[0])}
          onClick={() => handleQuickAddLogic(FLOW_LOGIC_ITEMS[0])}
          data-tooltip="Condition / Branch (Drag to canvas or click to add)"
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
          className="header-icon-btn"
          onClick={onNavigateToGroups}
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

        {/* Clear Canvas */}
        <button
          type="button"
          className="header-icon-btn tools-menu-item item-danger"
          onClick={() => onClearCanvas?.()}
          data-tooltip="Clear Canvas (Blank)"
          data-tooltip-pos="bottom"
          aria-label="Clear Canvas (Blank)"
        >
          <Trash2 size={15} />
        </button>

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
      </div>
    </header>
  );
};
