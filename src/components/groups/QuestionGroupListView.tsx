import React, { useState, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  Layers,
  SquarePen,
  Trash2,
  Workflow,
  Tag,
  AlertTriangle,
  X,
  RotateCcw,
  ArrowDownUp,
} from 'lucide-react';
import type { ReusableQuestionGroup, GroupCategory } from '../../types/group';

type SortOption =
  | 'id_asc'
  | 'id_desc'
  | 'name_asc'
  | 'name_desc'
  | 'questions_desc'
  | 'questions_asc';

interface QuestionGroupListViewProps {
  groups: ReusableQuestionGroup[];
  onCreateGroupInStudio: () => void;
  onEditGroupInStudio: (group: ReusableQuestionGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onInsertGroupIntoCanvas: (group: ReusableQuestionGroup) => void;
  onResetDefaults?: () => void;
}

const CATEGORIES: { id: 'all' | GroupCategory; label: string }[] = [
  { id: 'all', label: 'All Groups' },
  { id: 'kyc', label: 'Farmer KYC' },
  { id: 'land', label: 'Land & Plots' },
  { id: 'crop', label: 'Crops & Yield' },
  { id: 'financial', label: 'Financials' },
  { id: 'verification', label: 'Geo-Verification' },
  { id: 'custom', label: 'Custom Sets' },
];

export const QuestionGroupListView: React.FC<QuestionGroupListViewProps> = ({
  groups,
  onCreateGroupInStudio,
  onEditGroupInStudio,
  onDeleteGroup,
  onInsertGroupIntoCanvas,
  onResetDefaults,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | GroupCategory>('all');
  const [sortBy, setSortBy] = useState<SortOption>('id_asc');
  const [groupToDelete, setGroupToDelete] = useState<ReusableQuestionGroup | null>(null);

  const stats = useMemo(() => {
    const total = groups.length;
    const totalQuestions = groups.reduce((acc, g) => acc + g.questions.length, 0);
    const categoriesCount = new Set(groups.map((g) => g.category)).size;
    const customSets = groups.filter((g) => g.category === 'custom').length;
    return { total, totalQuestions, categoriesCount, customSets };
  }, [groups]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: groups.length };
    groups.forEach((g) => {
      counts[g.category] = (counts[g.category] || 0) + 1;
    });
    return counts;
  }, [groups]);

  const sortedAndFilteredGroups = useMemo(() => {
    const filtered = groups.filter((g) => {
      const matchSearch =
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.nameBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.questions.some(
          (q) =>
            q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            q.question_bn.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchCategory =
        selectedCategory === 'all' || g.category === selectedCategory;

      return matchSearch && matchCategory;
    });

    return filtered.sort((a, b) => {
      const idA = a.groupId || 1;
      const idB = b.groupId || 1;
      if (sortBy === 'id_asc') return idA - idB;
      if (sortBy === 'id_desc') return idB - idA;
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'questions_desc') return b.questions.length - a.questions.length;
      if (sortBy === 'questions_asc') return a.questions.length - b.questions.length;
      return 0;
    });
  }, [groups, searchQuery, selectedCategory, sortBy]);

  return (
    <div className="flowchart-dashboard-container group-dashboard-container">
      {/* 1. Dashboard Header Banner */}
      <div className="dashboard-header-banner">
        <div className="dashboard-title-area">
          <div className="dashboard-badge">
            <Layers size={16} className="text-emerald" />
            <span>REUSABLE TEMPLATES</span>
          </div>
          <h1 className="dashboard-main-title">Question Groups Library</h1>
          <p className="dashboard-subtitle">
            Modular bundles of standardized survey questions that can be dropped into any flowchart on demand.
          </p>
        </div>

        <div className="dashboard-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {onResetDefaults && (
            <button
              className="btn btn-secondary"
              onClick={onResetDefaults}
              title="Restore standard pre-built question groups"
            >
              <RotateCcw size={14} />
              <span>Restore Defaults</span>
            </button>
          )}

          <button
            className="btn btn-primary create-hero-btn"
            onClick={onCreateGroupInStudio}
            title="Visually design questions using the Flowchart Studio canvas"
          >
            <PlusCircle size={18} />
            <span>Design New Group</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Stats Bar */}
      <div className="dashboard-stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Question Groups</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-emerald">{stats.totalQuestions}</div>
          <div className="stat-label">Total Mapped Questions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-cyan">{stats.categoriesCount}</div>
          <div className="stat-label">Active Categories</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-amber">{stats.customSets}</div>
          <div className="stat-label">Custom Domain Sets</div>
        </div>
      </div>

      {/* 3. Controls Bar: Two-tier layout for spacious, un-congested UX */}
      <div className="dashboard-controls-section" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Tier 1: Search + Sort Dropdown + Match Summary */}
        <div className="dashboard-filter-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="dashboard-search-input"
              placeholder="Search question groups or specific questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowDownUp size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                style={{ minWidth: 180, height: 38, fontSize: 12, padding: '4px 10px' }}
                aria-label="Sort Question Groups"
              >
                <option value="id_asc">Sort: Group ID (1 → 9)</option>
                <option value="id_desc">Sort: Group ID (9 → 1)</option>
                <option value="name_asc">Sort: Title (A → Z)</option>
                <option value="name_desc">Sort: Title (Z → A)</option>
                <option value="questions_desc">Sort: Most Questions</option>
                <option value="questions_asc">Sort: Fewest Questions</option>
              </select>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Showing {sortedAndFilteredGroups.length} of {groups.length}
            </span>
          </div>
        </div>

        {/* Tier 2: Category Filter Pills */}
        <div className="category-filter-chips" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`filter-pill ${selectedCategory === cat.id ? 'is-active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span>{cat.label}</span>
              <span style={{ opacity: 0.7, marginLeft: 5, fontSize: 11, fontWeight: 700 }}>
                ({categoryCounts[cat.id] || 0})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Question Groups Grid */}
      <div className="groups-catalog-grid">
        {sortedAndFilteredGroups.length === 0 ? (
          <div className="dashboard-empty-state">
            <Layers size={44} className="empty-icon" />
            <h3 className="empty-title">No question groups found</h3>
            <p className="empty-sub">
              {searchQuery
                ? 'Try searching with a different term or clear filters.'
                : 'Create your first reusable question group to build standard survey templates.'}
            </p>
            <button
              className="btn btn-primary"
              onClick={onCreateGroupInStudio}
            >
              <PlusCircle size={16} />
              <span>Design Question Group in Studio</span>
            </button>
            {onResetDefaults && (
              <button
                className="btn btn-secondary"
                onClick={onResetDefaults}
                style={{ marginTop: 8 }}
              >
                <RotateCcw size={14} />
                <span>Restore Standard Groups</span>
              </button>
            )}
          </div>
        ) : (
          sortedAndFilteredGroups.map((group) => {
            return (
              <div
                key={group.id}
                className="group-catalog-card"
                style={{ borderTopColor: group.color }}
              >
                {/* Card Top */}
                <div className="group-card-header">
                  <div className="group-card-title-group">
                    <div className="category-pill-wrap" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {group.groupId && (
                        <span
                          className="group-cat-pill"
                          style={{
                            backgroundColor: `${group.color}25`,
                            color: group.color,
                            borderColor: `${group.color}50`,
                            fontWeight: 700,
                          }}
                        >
                          <span>GROUP #{group.groupId}</span>
                        </span>
                      )}
                      <span
                        className="group-cat-pill"
                        style={{
                          backgroundColor: `${group.color}15`,
                          color: group.color,
                          borderColor: `${group.color}35`,
                        }}
                      >
                        <Tag size={10} />
                        <span>{group.category.toUpperCase()}</span>
                      </span>
                      <span className="group-q-count-tag">
                        {group.questions.length} Question{group.questions.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <h3 className="group-card-title">{group.name}</h3>
                    <p className="group-card-title-bn bn-font">{group.nameBn}</p>
                  </div>
                </div>

                <p className="group-card-desc">{group.description}</p>

                {/* Question Items Preview */}
                <div className="group-questions-preview-box">
                  <span className="preview-label">INCLUDED QUESTIONS:</span>
                  <div className="preview-questions-list">
                    {group.questions.slice(0, 4).map((q, qIdx) => (
                      <div key={qIdx} className="preview-q-row">
                        <span className="q-type-badge">{q.answer_type}</span>
                        <span className="preview-q-text bn-font" title={q.question_bn || q.question}>
                          {q.question_bn || q.question}
                        </span>
                        {q.mandatory && <span className="text-red-400 font-bold">*</span>}
                      </div>
                    ))}
                    {group.questions.length > 4 && (
                      <span className="preview-more-count">
                        +{group.questions.length - 4} more questions in this group
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="group-card-footer">
                  <button
                    className="btn btn-primary btn-insert-flow"
                    onClick={() => onInsertGroupIntoCanvas(group)}
                    title="Insert this question group into active flowchart"
                  >
                    <Workflow size={14} />
                    <span>Insert into Flowchart</span>
                  </button>

                  <div className="group-card-icon-actions">
                    <button
                      className="btn-card-action"
                      onClick={() => onEditGroupInStudio(group)}
                      title="Edit Group in Flowchart Studio"
                    >
                      <SquarePen size={15} />
                    </button>
                    <button
                      className="btn-card-action btn-delete-action"
                      onClick={() => setGroupToDelete(group)}
                      title="Delete Group"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* In-App Delete Confirmation Modal (no window.confirm popup blocking) */}
      {groupToDelete && (
        <div className="modal-backdrop" onClick={() => setGroupToDelete(null)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 450, maxWidth: '95vw' }}
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
                    onDeleteGroup(groupToDelete.id);
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
    </div>
  );
};
