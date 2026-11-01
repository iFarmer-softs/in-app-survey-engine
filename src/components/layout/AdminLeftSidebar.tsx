import React, { useState } from 'react';
import {
  PlusCircle,
  FolderKanban,
  Workflow,
  ChevronRight,
  Pin,
  PinOff,
  Sparkles,
  Info,
  Layers,
} from 'lucide-react';

interface AdminLeftSidebarProps {
  activeView: 'editor' | 'list' | 'groups';
  onSelectView: (view: 'editor' | 'list' | 'groups') => void;
  onOpenCreateModal: () => void;
  activeProjectTitle: string;
  totalProjectsCount: number;
  totalGroupsCount?: number;
}

export const AdminLeftSidebar: React.FC<AdminLeftSidebarProps> = ({
  activeView,
  onSelectView,
  onOpenCreateModal,
  activeProjectTitle,
  totalProjectsCount,
  totalGroupsCount = 5,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const isExpanded = isHovered || isPinned;

  return (
    <aside
      className={`admin-left-sidebar ${isExpanded ? 'is-expanded' : 'is-collapsed'} ${
        isPinned ? 'is-pinned' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Brand Header */}
      <div className="admin-sidebar-header">
        <div className="admin-brand-icon">
          <Workflow size={22} className="brand-logo-icon" />
        </div>
        {isExpanded && (
          <div className="admin-brand-text">
            <span className="admin-app-name">iFarmer Admin</span>
            <span className="admin-app-sub">Survey Flow Engine</span>
          </div>
        )}
      </div>

      {/* Primary Action: Create New Flowchart */}
      <div className="admin-sidebar-action-wrap">
        <button
          className="admin-create-flow-btn"
          onClick={onOpenCreateModal}
          title="Create New Flowchart"
        >
          <PlusCircle size={20} className="action-icon" />
          {isExpanded && <span className="action-label">Create New Flow</span>}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="admin-sidebar-nav">
        <div className="admin-nav-section-title">
          {isExpanded ? 'FLOWCHART MENUS' : '•••'}
        </div>

        {/* Option 1: Flowchart Studio (Visual Editor) */}
        <button
          className={`admin-nav-item ${
            activeView === 'editor' ? 'is-active' : ''
          }`}
          onClick={() => onSelectView('editor')}
          title="Flowchart Studio (Visual Editor)"
        >
          <div className="nav-icon-wrap">
            <Workflow size={19} />
          </div>
          {isExpanded && (
            <div className="nav-label-group">
              <span className="nav-title">Flowchart Studio</span>
              <span className="nav-sub">Canvas & Drag-Drop</span>
            </div>
          )}
          {isExpanded && activeView === 'editor' && (
            <ChevronRight size={14} className="active-arrow" />
          )}
        </button>

        {/* Option 2: List of Created Flowcharts */}
        <button
          className={`admin-nav-item ${
            activeView === 'list' ? 'is-active' : ''
          }`}
          onClick={() => onSelectView('list')}
          title="List of Created Flowcharts"
        >
          <div className="nav-icon-wrap">
            <FolderKanban size={19} />
          </div>
          {isExpanded && (
            <div className="nav-label-group">
              <span className="nav-title">All Flowcharts</span>
              <span className="nav-sub">Catalog & Revisions</span>
            </div>
          )}
          <span className="nav-count-badge">{totalProjectsCount}</span>
        </button>

        {/* Option 3: Question Groups Library */}
        <button
          className={`admin-nav-item ${
            activeView === 'groups' ? 'is-active' : ''
          }`}
          onClick={() => onSelectView('groups')}
          title="Reusable Question Groups"
        >
          <div className="nav-icon-wrap">
            <Layers size={19} />
          </div>
          {isExpanded && (
            <div className="nav-label-group">
              <span className="nav-title">Question Groups</span>
              <span className="nav-sub">Reusable Sets</span>
            </div>
          )}
          {isExpanded && activeView === 'groups' && (
            <ChevronRight size={14} className="active-arrow" />
          )}
          <span className="nav-count-badge">{totalGroupsCount}</span>
        </button>
      </nav>

      {/* Active Project Card Preview (visible when expanded) */}
      {isExpanded && (
        <div className="admin-active-project-card">
          <div className="card-top-row">
            <Sparkles size={12} className="text-emerald" />
            <span className="card-label">CURRENT ACTIVE</span>
          </div>
          <div className="active-proj-name" title={activeProjectTitle}>
            {activeProjectTitle}
          </div>
          <button
            className="switch-back-btn"
            onClick={() => onSelectView('editor')}
          >
            Open in Studio →
          </button>
        </div>
      )}

      {/* Sidebar Footer */}
      <div className="admin-sidebar-footer">
        <button
          className="admin-pin-toggle-btn"
          onClick={() => setIsPinned(!isPinned)}
          title={isPinned ? 'Unpin sidebar (collapse to rail)' : 'Pin sidebar expanded'}
        >
          {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
          {isExpanded && (
            <span className="pin-text">{isPinned ? 'Unpin Rail' : 'Pin Expanded'}</span>
          )}
        </button>

        {isExpanded && (
          <div className="admin-version-info">
            <Info size={12} />
            <span>v2.4 • Dynamic KYC</span>
          </div>
        )}
      </div>
    </aside>
  );
};
