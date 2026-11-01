import React, { useState, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  Layers,
  Edit3,
  Trash2,
  Workflow,
  Tag,
  AlertTriangle,
  X,
  RotateCcw,
} from 'lucide-react';
import type { ReusableQuestionGroup, GroupCategory } from '../../types/group';

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
  const [groupToDelete, setGroupToDelete] = useState<ReusableQuestionGroup | null>(null);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
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
  }, [groups, searchQuery, selectedCategory]);

  return (
    <div className="flowchart-dashboard-container group-dashboard-container">
      {/* Dashboard Header Banner */}
      <div className="dashboard-banner">
        <div className="dashboard-banner-left">
          <div className="banner-badge-row">
            <span className="banner-badge">
              <Layers size={13} />
              <span>Reusable Question Sets</span>
            </span>
            <span className="banner-count">{groups.length} Pre-built Groups</span>
          </div>
          <h1 className="dashboard-title">Question Groups Library</h1>
          <p className="dashboard-sub">
            Modular bundles of standardized survey questions that can be dropped into any flowchart on demand.
          </p>
        </div>

        <div className="dashboard-banner-right">
          <button
            className="btn btn-primary btn-create-lg"
            onClick={onCreateGroupInStudio}
            title="Visually design questions using the Flowchart Studio canvas"
          >
            <PlusCircle size={17} />
            <span>Design New Group in Studio</span>
          </button>
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
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="dashboard-filter-bar">
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

        <div className="filter-chips-row">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`filter-chip ${selectedCategory === cat.id ? 'is-active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Question Groups Grid */}
      <div className="groups-catalog-grid">
        {filteredGroups.length === 0 ? (
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
          filteredGroups.map((group) => {
            return (
              <div
                key={group.id}
                className="group-catalog-card"
                style={{ borderTopColor: group.color }}
              >
                {/* Card Top */}
                <div className="group-card-header">
                  <div className="group-card-title-group">
                    <div className="category-pill-wrap">
                      <span
                        className="group-cat-pill"
                        style={{
                          backgroundColor: `${group.color}20`,
                          color: group.color,
                          borderColor: `${group.color}40`,
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
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="btn-card-action btn-delete-action"
                      onClick={() => setGroupToDelete(group)}
                      title="Delete Group"
                    >
                      <Trash2 size={14} />
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
