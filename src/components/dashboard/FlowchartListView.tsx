import React, { useState, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  FolderKanban,
  Sparkles,
  Workflow,
  Copy,
  Trash2,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import type { FlowchartProject } from '../../types/project';
import { compileFlowToSchema } from '../../utils/schemaCompiler';

interface FlowchartListViewProps {
  projects: FlowchartProject[];
  activeProjectId: string;
  onOpenProject: (id: string) => void;
  onCreateNew: () => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

export const FlowchartListView: React.FC<FlowchartListViewProps> = ({
  projects,
  activeProjectId,
  onOpenProject,
  onCreateNew,
  onDuplicateProject,
  onDeleteProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchQuery =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.titleBn && p.titleBn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === 'all' || p.status === statusFilter;

      return matchQuery && matchStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  // Aggregate statistics
  const stats = useMemo(() => {
    const total = projects.length;
    const published = projects.filter((p) => p.status === 'published').length;
    const totalNodes = projects.reduce((acc, p) => acc + p.nodes.length, 0);
    const totalQuestions = projects.reduce(
      (acc, p) => acc + p.nodes.filter((n) => n.type === 'question').length,
      0
    );
    return { total, published, totalNodes, totalQuestions };
  }, [projects]);

  // Export JSON helper
  const handleQuickExport = (e: React.MouseEvent, p: FlowchartProject) => {
    e.stopPropagation();
    const schema = compileFlowToSchema(p.nodes, p.edges, p.groupMeta);
    const jsonStr = JSON.stringify(schema, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_schema.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="flowchart-dashboard-container">
      {/* Dashboard Header Banner */}
      <div className="dashboard-header-banner">
        <div className="dashboard-title-area">
          <div className="dashboard-badge">
            <FolderKanban size={16} className="text-emerald" />
            <span>ADMIN WORKSPACE</span>
          </div>
          <h1 className="dashboard-main-title">Survey Flowcharts Directory</h1>
          <p className="dashboard-subtitle">
            Manage, duplicate, and design dynamic KYC flowcharts for facilitator mobile apps.
          </p>
        </div>

        <button
          className="btn btn-primary create-hero-btn"
          onClick={onCreateNew}
        >
          <PlusCircle size={18} />
          <span>Create New Flowchart</span>
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="dashboard-stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Flowcharts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-emerald">{stats.published}</div>
          <div className="stat-label">Published / Live</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-cyan">{stats.totalQuestions}</div>
          <div className="stat-label">Mapped Questions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-amber">{stats.totalNodes}</div>
          <div className="stat-label">Flow Logic Nodes</div>
        </div>
      </div>

      {/* Controls Bar: Search & Status Filters */}
      <div className="dashboard-filter-bar">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="dashboard-search-input"
            placeholder="Search flowcharts by name, Bengali title, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        <div className="filter-pill-group">
          <button
            className={`filter-pill ${statusFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({projects.length})
          </button>
          <button
            className={`filter-pill ${
              statusFilter === 'published' ? 'is-active' : ''
            }`}
            onClick={() => setStatusFilter('published')}
          >
            Published ({projects.filter((p) => p.status === 'published').length})
          </button>
          <button
            className={`filter-pill ${
              statusFilter === 'draft' ? 'is-active' : ''
            }`}
            onClick={() => setStatusFilter('draft')}
          >
            Drafts ({projects.filter((p) => p.status === 'draft').length})
          </button>
        </div>
      </div>

      {/* Flowcharts Grid */}
      <div className="flowchart-cards-grid">
        {filteredProjects.map((p) => {
          const isActive = p.id === activeProjectId;
          const questionCount = p.nodes.filter(
            (n) => n.type === 'question'
          ).length;

          return (
            <div
              key={p.id}
              className={`flowchart-project-card ${
                isActive ? 'is-current-active' : ''
              }`}
              onClick={() => onOpenProject(p.id)}
            >
              {/* Card Top Row */}
              <div className="card-header-row">
                <div className="status-badge-wrap">
                  <span
                    className={`status-pill status-${p.status}`}
                  >
                    {p.status === 'published' ? (
                      <>
                        <CheckCircle2 size={11} />
                        <span>Published</span>
                      </>
                    ) : (
                      <>
                        <Clock size={11} />
                        <span>Draft</span>
                      </>
                    )}
                  </span>
                  {isActive && (
                    <span className="current-badge">
                      <Sparkles size={11} />
                      <span>Active in Studio</span>
                    </span>
                  )}
                </div>

                <div className="card-actions-quick" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="quick-icon-btn"
                    title="Export JSON"
                    onClick={(e) => handleQuickExport(e, p)}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    className="quick-icon-btn"
                    title="Duplicate Flowchart"
                    onClick={() => onDuplicateProject(p.id)}
                  >
                    <Copy size={14} />
                  </button>
                  {projects.length > 1 && (
                    <button
                      className="quick-icon-btn text-danger"
                      title="Delete Flowchart"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to delete "${p.title}"?`
                          )
                        ) {
                          onDeleteProject(p.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <div className="card-body">
                <h3 className="card-title">{p.title}</h3>
                {p.titleBn && (
                  <div className="card-title-bn">{p.titleBn}</div>
                )}
                <p className="card-description">{p.description}</p>
              </div>

              {/* Metadata chips */}
              <div className="card-meta-row">
                <div className="meta-chip" title="Total Groups">
                  <Layers size={13} />
                  <span>{p.groupMeta.totalGroups} Groups</span>
                </div>
                <div className="meta-chip" title="Questions & Nodes">
                  <Workflow size={13} />
                  <span>{questionCount} Questions ({p.nodes.length} Nodes)</span>
                </div>
                <div className="meta-chip" title="Last Updated">
                  <Calendar size={13} />
                  <span>{formatRelativeTime(p.updatedAt)}</span>
                </div>
              </div>

              {/* Card Footer: Open In Studio Button */}
              <div className="card-footer-row">
                <button
                  className={`card-open-btn ${isActive ? 'is-active-btn' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProject(p.id);
                  }}
                >
                  <span>{isActive ? 'Continue in Studio' : 'Open in Studio'}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="no-flowcharts-empty">
            <div className="empty-icon-wrap">
              <HelpCircle size={32} />
            </div>
            <h3>No flowcharts found</h3>
            <p>
              Try adjusting your search query or create a new survey flowchart.
            </p>
            <button
              className="btn btn-secondary"
              onClick={onCreateNew}
            >
              <PlusCircle size={16} />
              <span>Create New Flowchart</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
