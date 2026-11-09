import React, { useState, useRef, useEffect } from 'react';
import {
  Code2,
  Smartphone,
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
  Save,
  Check,
  Loader2,
} from 'lucide-react';
import type { GroupMeta } from '../../utils/schemaCompiler';

interface HeaderProps {
  projectTitle?: string;
  currentVersion?: string;
  versionStatus?: 'published' | 'draft' | 'archived';
  groupMeta: GroupMeta;
  onOpenJsonModal: () => void;
  onOpenMobileModal: () => void;
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
}

export const Header: React.FC<HeaderProps> = ({
  projectTitle,
  currentVersion = '1.0.0',
  versionStatus = 'draft',
  groupMeta,
  onOpenJsonModal,
  onOpenMobileModal,
  onResetSample,
  onClearCanvas,
  onAutoLayout,
  onBackToList,
  nodeCount,
  edgeCount,
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
  onSave,
  isSaving = false,
  isSaved = false,
}) => {
  const [isVersionMenuOpen, setIsVersionMenuOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  const versionDropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);

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
    };
    if (isVersionMenuOpen || isToolsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVersionMenuOpen, isToolsMenuOpen]);

  return (
    <header className="app-header">
      {/* 1. Left: Brand & Title with Version Dropdown */}
      <div className="header-brand">
        {onBackToList && (
          <button
            className="header-back-list-btn"
            onClick={onBackToList}
            title="Back to All Flowcharts"
          >
            <ArrowLeft size={16} />
            <span>Flowcharts</span>
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
                title="Flowchart Version & Release Management"
              >
                <GitBranch size={13} className="version-pill-icon" />
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

            {/* Backend Server Connectivity Status Pill */}
            {isServerConnected ? (
              <div
                className="header-server-status-pill connected"
                title="Connected to Spring Boot Backend Server (http://localhost:8080/api)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  fontWeight: 600,
                  marginLeft: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
                  }}
                />
                <span>Spring Boot API</span>
              </div>
            ) : (
              <div
                className="header-server-status-pill offline"
                title="Backend Server Offline (Using Local Storage Cache)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#fef3c7',
                  color: '#b45309',
                  border: '1px solid #fde68a',
                  fontWeight: 600,
                  marginLeft: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b',
                  }}
                />
                <span>Local Mode</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Middle: Compact Status & Diagnostics */}
      <div className="header-meta">
        <div className="meta-pill stats-pill">
          <span>
            Group {groupMeta.groupNumber}/{groupMeta.totalGroups}
          </span>
          <span className="pill-divider">•</span>
          <span>
            {nodeCount} Nodes ({edgeCount} Links)
          </span>
        </div>

        {/* Real-time Flow Diagnostics Pill */}
        <button
          className={`meta-pill diagnostics-pill ${
            diagnosticsErrors > 0
              ? 'has-error'
              : diagnosticsCount > 0
              ? 'has-warning'
              : 'is-healthy'
          }`}
          onClick={onOpenDiagnostics}
          title="Click to view flowchart diagnostics"
        >
          {diagnosticsErrors > 0 ? (
            <>
              <AlertTriangle size={13} className="text-red-400" />
              <span>{diagnosticsErrors} Errors</span>
            </>
          ) : diagnosticsCount > 0 ? (
            <>
              <AlertTriangle size={13} className="text-amber-400" />
              <span>{diagnosticsCount} Warnings</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>Flow Valid</span>
            </>
          )}
        </button>
      </div>

      {/* 3. Right: Clean Consolidated Action Group */}
      <div className="header-actions">
        {/* Undo / Redo Segmented Buttons */}
        {(onUndo || onRedo) && (
          <div className="header-history-btn-group">
            <button
              type="button"
              className="btn btn-icon btn-history-action"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z / Cmd+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              className="btn btn-icon btn-history-action"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y / Cmd+Shift+Z)"
            >
              <Redo2 size={14} />
            </button>
          </div>
        )}

        {/* Dependency Path Tracing Quick Toggle */}
        {onTogglePathTracing && (
          <button
            type="button"
            className={`btn btn-icon ${isPathTracingEnabled ? 'btn-active-cyan' : 'btn-secondary'}`}
            onClick={onTogglePathTracing}
            title={
              isPathTracingEnabled
                ? 'Dependency Path Tracing (ON): Highlight upstream & downstream flows. Click to turn OFF'
                : 'Dependency Path Tracing (OFF): Click to turn ON'
            }
            style={
              isPathTracingEnabled
                ? {
                    borderColor: 'rgba(6, 182, 212, 0.5)',
                    color: '#22d3ee',
                    background: 'rgba(6, 182, 212, 0.12)',
                  }
                : undefined
            }
          >
            <GitFork size={14} />
          </button>
        )}

        {/* Consolidated Canvas Tools & Layout Dropdown */}
        <div className="header-tools-dropdown-container" ref={toolsDropdownRef}>
          <button
            type="button"
            className="btn btn-secondary btn-tools-toggle"
            onClick={() => setIsToolsMenuOpen((prev) => !prev)}
            title="Canvas layout, alignment & line style options"
          >
            <SlidersHorizontal size={14} />
            <span>Tools</span>
            <ChevronDown
              size={11}
              className={`tools-chevron ${isToolsMenuOpen ? 'is-rotated' : ''}`}
            />
          </button>

          {isToolsMenuOpen && (
            <div className="header-tools-menu animate-in">
              {/* Section 1: Auto Layout & Align */}
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

              {/* Section 2: Visual Inspection */}
              <div className="tools-section-title">Visual Inspection</div>
              <button
                type="button"
                className={`tools-menu-item ${isPathTracingEnabled ? 'is-active' : ''}`}
                onClick={() => {
                  onTogglePathTracing?.();
                }}
              >
                <GitFork
                  size={14}
                  className={isPathTracingEnabled ? 'text-cyan-400' : ''}
                />
                <div className="tools-item-text">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                    }}
                  >
                    <span className="tools-title">Dependency Tracing</span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: isPathTracingEnabled
                          ? 'rgba(6, 182, 212, 0.2)'
                          : 'rgba(100, 116, 139, 0.2)',
                        color: isPathTracingEnabled ? '#22d3ee' : '#94a3b8',
                      }}
                    >
                      {isPathTracingEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <span className="tools-sub">
                    Highlight ancestors & dependents
                  </span>
                </div>
              </button>

              <div className="menu-divider" />

              {/* Section 4: Clear Canvas / Blank Canvas */}
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

        {/* Primary Action 0: Save Flowchart */}
        {onSave && (
          <button
            type="button"
            className={`btn btn-save ${isSaved ? 'is-saved' : ''} ${isSaving ? 'is-saving' : ''}`}
            onClick={onSave}
            disabled={isSaving}
            title="Save flowchart to local storage & cloud database (Ctrl+S / Cmd+S)"
          >
            {isSaving ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : isSaved ? (
              <>
                <Check size={15} />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>Save</span>
              </>
            )}
          </button>
        )}

        {/* Primary Action 1: Mobile Preview */}
        <button
          className="btn btn-secondary btn-mobile-preview"
          onClick={onOpenMobileModal}
          title="Interactive Mobile App Emulator"
        >
          <Smartphone size={15} />
          <span>Mobile Preview</span>
        </button>

        {/* Primary Action 2: Generate JSON */}
        <button
          className="btn btn-primary"
          onClick={onOpenJsonModal}
          title="Generate & export compiled JSON survey schema"
        >
          <Code2 size={15} />
          <span>Generate JSON</span>
        </button>
      </div>
    </header>
  );
};
