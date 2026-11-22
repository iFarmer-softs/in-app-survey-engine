import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Crop,
  Trash2,
  Plus,
  Layers,
  Menu,
  Split,
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
    icon: <Split size={16} />,
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
  currentVersion: _currentVersion = '1.0.0',
  versionStatus: _versionStatus = 'draft',
  groupMeta: _groupMeta,
  onOpenJsonModal: _onOpenJsonModal,
  onOpenMobileModal: _onOpenMobileModal,
  onResetSample: _onResetSample,
  onClearCanvas,
  onAutoLayout: _onAutoLayout,
  onBackToList,
  nodeCount: _nodeCount,
  edgeCount: _edgeCount,
  diagnosticsCount: _diagnosticsCount,
  diagnosticsErrors: _diagnosticsErrors,
  onOpenDiagnostics: _onOpenDiagnostics,
  onAlignHorizontal: _onAlignHorizontal,
  onAlignVertical: _onAlignVertical,
  onOpenVersionHistory: _onOpenVersionHistory,
  onOpenCreateSnapshot: _onOpenCreateSnapshot,
  onPublishVersion: _onPublishVersion,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isPathTracingEnabled: _isPathTracingEnabled,
  onTogglePathTracing: _onTogglePathTracing,
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
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 280);
  };

  const handleTogglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      if (!next) {
        setIsHovered(false);
      }
      return next;
    });
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest(
          '.header-center-dock .figma-hamburger-btn, .header-center-dock .figma-dock-action'
        )
      ) {
        return;
      }
      setIsPinned(false);
      setIsHovered(false);
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
        setIsPinned(false);
        setIsHovered(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isExpanded = isHovered || isPinned;

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
          <Split size={15} className="text-amber-400" />
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

        {/* History Controls (Undo / Redo) - Hidden by default, reveals smoothly from right to left upon canvas changes */}
        <div
          className={`header-history-controls ${
            canUndo || canRedo ? 'is-visible' : 'is-hidden'
          }`}
          aria-hidden={!canUndo && !canRedo}
        >
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
            tabIndex={canUndo || canRedo ? 0 : -1}
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
            tabIndex={canUndo || canRedo ? 0 : -1}
          >
            <Redo2 size={15} />
          </button>
        </div>

        <div className="header-dock-divider" />

        {/* Hamburger Menu Trigger Icon */}
        <button
          type="button"
          className={`figma-action-btn figma-hamburger-btn ${isExpanded ? 'is-active' : ''}`}
          onClick={handleTogglePin}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          data-tooltip={isExpanded ? 'Collapse Actions' : 'Expand Actions'}
          data-tooltip-pos="bottom"
          aria-label="Actions Menu"
        >
          <Menu size={16} />
        </button>

        {/* 1. Question Group Library */}
        <button
          type="button"
          className={`figma-action-btn figma-dock-action ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
          onClick={onNavigateToGroups}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          data-tooltip="Question Groups Library"
          data-tooltip-pos="bottom"
          aria-label="Question Groups Library"
          tabIndex={isExpanded ? 0 : -1}
          aria-hidden={!isExpanded}
        >
          <Layers size={15} />
          {groups.length > 0 && <span className="header-dot-indicator" />}
        </button>

        {/* 2. Clear Canvas Icon */}
        <button
          type="button"
          className={`figma-action-btn figma-dock-action tools-menu-item item-danger ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
          onClick={() => onClearCanvas?.()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          data-tooltip="Clear Canvas (Blank)"
          data-tooltip-pos="bottom"
          aria-label="Clear Canvas (Blank)"
          tabIndex={isExpanded ? 0 : -1}
          aria-hidden={!isExpanded}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </header>
  );
};
