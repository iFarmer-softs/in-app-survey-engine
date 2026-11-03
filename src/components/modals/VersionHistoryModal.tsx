import React, { useState, useMemo } from 'react';
import {
  History,
  RotateCcw,
  Smartphone,
  Download,
  Calendar,
  User,
  GitBranch,
  GitCommit,
  CheckCircle2,
  Plus,
  Minus,
  Edit3,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { Modal } from '../ui/Modal';
import type { FlowchartProject, FlowchartVersion } from '../../types/project';
import { compareFlowSnapshots } from '../../utils/projectStorage';
import { compileFlowToSchema } from '../../utils/schemaCompiler';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FlowchartProject;
  currentNodes: Node[];
  currentEdges: Edge[];
  onRestoreVersion: (versionId: string) => void;
  onOpenMobilePreview?: (nodes: Node[], edges: Edge[], meta: any) => void;
  onOpenCreateVersion?: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  project,
  currentNodes,
  currentEdges,
  onRestoreVersion,
  onOpenMobilePreview,
  onOpenCreateVersion,
}) => {
  const versions = project.versions || [];
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    versions[0]?.id || ''
  );
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  // Sync selected version when versions change
  const activeSelected = useMemo(() => {
    return versions.find((v) => v.id === selectedVersionId) || versions[0];
  }, [versions, selectedVersionId]);

  // Compute diff between active canvas and selected version snapshot
  const diffResult = useMemo(() => {
    if (!activeSelected) return null;
    return compareFlowSnapshots(
      activeSelected.nodes,
      currentNodes,
      activeSelected.edges,
      currentEdges
    );
  }, [activeSelected, currentNodes, currentEdges]);

  // Format date nicely
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Unknown date';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleDownloadSchema = (ver: FlowchartVersion) => {
    try {
      const schema = compileFlowToSchema(ver.nodes, ver.edges, ver.groupMeta);
      const jsonStr = JSON.stringify(schema, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.title.toLowerCase().replace(/\s+/g, '-')}-v${ver.version}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to compile & download schema:', err);
      alert('Failed to compile JSON schema for this version.');
    }
  };

  const handleExecuteRestore = (ver: FlowchartVersion) => {
    onRestoreVersion(ver.id);
    setConfirmRestoreId(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="version-history-modal-content"
      icon={
        <div className="modal-badge-icon">
          <History size={18} className="text-emerald" />
        </div>
      }
      title={`Version History & Audit Log`}
      subtitle={`${project.title} • ${versions.length} checkpoint${versions.length === 1 ? '' : 's'} recorded`}
      headerActions={
        onOpenCreateVersion && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              onClose();
              onOpenCreateVersion();
            }}
          >
            <GitCommit size={14} />
            <span>Create Snapshot</span>
          </button>
        )
      }
    >
      <div className="version-history-split-pane">
        {/* Left Column: Version Timeline */}
        <div className="version-timeline-column">
          <div className="timeline-header-label">
            <span>Release Timeline</span>
            <span className="badge-timeline-count">{versions.length}</span>
          </div>

          <div className="timeline-items-list">
            {versions.map((ver, idx) => {
              const isSelected = ver.id === activeSelected?.id;
              const isPublished = ver.status === 'published';
              const isCurrent = ver.version === project.currentVersion;

              return (
                <div
                  key={ver.id}
                  className={`timeline-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    setSelectedVersionId(ver.id);
                    setConfirmRestoreId(null);
                  }}
                >
                  <div className="timeline-card-node-indicator">
                    <div
                      className={`timeline-dot ${
                        isPublished ? 'dot-published' : 'dot-draft'
                      }`}
                    />
                    {idx < versions.length - 1 && <div className="timeline-line" />}
                  </div>

                  <div className="timeline-card-content">
                    <div className="timeline-card-top">
                      <div className="version-badge-group">
                        <span className="timeline-version-tag">v{ver.version}</span>
                        {isPublished ? (
                          <span className="badge-tag-published">
                            <Rocket size={10} /> Published
                          </span>
                        ) : (
                          <span className="badge-tag-draft">Draft</span>
                        )}
                        {isCurrent && (
                          <span className="badge-tag-current">Baseline</span>
                        )}
                      </div>
                      <span className="timeline-date">{formatDate(ver.createdAt)}</span>
                    </div>

                    <h4 className="timeline-card-title">{ver.title}</h4>

                    <div className="timeline-card-meta">
                      <span>{ver.nodeCount} nodes</span>
                      <span>•</span>
                      <span>{ver.edgeCount} links</span>
                      <span>•</span>
                      <span>{ver.createdBy || 'Designer'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Version Inspector & Diff */}
        <div className="version-inspector-column">
          {activeSelected ? (
            <div className="inspector-content-wrap">
              {/* Top Banner */}
              <div className="inspector-header-card">
                <div className="inspector-title-row">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="inspector-version-heading">
                        Version {activeSelected.version}
                      </h3>
                      {activeSelected.status === 'published' ? (
                        <span className="badge-tag-published">
                          <ShieldCheck size={12} /> Live Production Release
                        </span>
                      ) : (
                        <span className="badge-tag-draft">
                          Working Draft Snapshot
                        </span>
                      )}
                    </div>
                    <h4 className="inspector-summary-text">{activeSelected.title}</h4>
                  </div>

                  {/* Actions for this version */}
                  <div className="inspector-action-buttons">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDownloadSchema(activeSelected)}
                      title="Export compiled JSON schema for this version"
                    >
                      <Download size={13} />
                      <span>Export JSON</span>
                    </button>

                    {onOpenMobilePreview && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          onOpenMobilePreview(
                            activeSelected.nodes,
                            activeSelected.edges,
                            activeSelected.groupMeta
                          )
                        }
                        title="Preview this exact version in mobile emulator"
                      >
                        <Smartphone size={13} />
                        <span>Preview</span>
                      </button>
                    )}

                    <button
                      className="btn btn-primary btn-sm btn-restore"
                      onClick={() => setConfirmRestoreId(activeSelected.id)}
                      title="Restore canvas to this version's state"
                    >
                      <RotateCcw size={13} />
                      <span>Rollback Here</span>
                    </button>
                  </div>
                </div>

                {confirmRestoreId === activeSelected.id && (
                  <div className="restore-confirm-banner">
                    <div className="confirm-text">
                      <strong>Restore canvas to v{activeSelected.version}?</strong>
                      <p>
                        This will replace the active working canvas with this snapshot's
                        nodes and edges.
                      </p>
                    </div>
                    <div className="confirm-actions">
                      <button
                        className="btn btn-secondary btn-xs"
                        onClick={() => setConfirmRestoreId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary btn-xs btn-confirm-restore"
                        onClick={() => handleExecuteRestore(activeSelected)}
                      >
                        Confirm Restore
                      </button>
                    </div>
                  </div>
                )}

                {/* Metadata Row */}
                <div className="inspector-meta-row">
                  <div className="inspector-meta-item">
                    <Calendar size={13} />
                    <span>Created: {formatDate(activeSelected.createdAt)}</span>
                  </div>
                  <div className="inspector-meta-item">
                    <User size={13} />
                    <span>Author: {activeSelected.createdBy || 'Survey Designer'}</span>
                  </div>
                </div>

                {/* Description / Changelog */}
                {activeSelected.description && (
                  <div className="inspector-notes-box">
                    <span className="notes-box-label">Changelog & Release Notes:</span>
                    <p className="notes-box-body">{activeSelected.description}</p>
                  </div>
                )}
              </div>

              {/* Stats Overview */}
              <div className="inspector-stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Questions & Logic</span>
                  <span className="stat-value">{activeSelected.questionCount}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Canvas Nodes</span>
                  <span className="stat-value">{activeSelected.nodeCount}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Connecting Edges</span>
                  <span className="stat-value">{activeSelected.edgeCount}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Form Groups</span>
                  <span className="stat-value">{activeSelected.groupCount}</span>
                </div>
              </div>

              {/* Changes comparison vs Active Working Canvas */}
              {diffResult && (
                <div className="inspector-diff-section">
                  <div className="diff-header">
                    <div className="flex items-center gap-2">
                      <GitBranch size={14} className="text-emerald-400" />
                      <span className="font-semibold text-sm">
                        Changes Between Active Canvas & Snapshot
                      </span>
                    </div>
                    <span className="diff-count-pill">
                      {diffResult.totalChanges === 0
                        ? 'Identical to working canvas'
                        : `${diffResult.totalChanges} difference${
                            diffResult.totalChanges === 1 ? '' : 's'
                          }`}
                    </span>
                  </div>

                  {diffResult.totalChanges === 0 ? (
                    <div className="diff-empty-notice">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <span>
                        The active canvas matches this version snapshot exactly.
                      </span>
                    </div>
                  ) : (
                    <div className="diff-details-list">
                      {diffResult.addedNodes.length > 0 && (
                        <div className="diff-category-group">
                          <span className="diff-tag tag-added">
                            <Plus size={11} /> {diffResult.addedNodes.length} Added on Canvas
                          </span>
                          <ul className="diff-items-list">
                            {diffResult.addedNodes.map((name, i) => (
                              <li key={i} className="diff-item added">
                                + {name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {diffResult.removedNodes.length > 0 && (
                        <div className="diff-category-group">
                          <span className="diff-tag tag-removed">
                            <Minus size={11} /> {diffResult.removedNodes.length} Missing from
                            Canvas
                          </span>
                          <ul className="diff-items-list">
                            {diffResult.removedNodes.map((name, i) => (
                              <li key={i} className="diff-item removed">
                                - {name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {diffResult.modifiedNodes.length > 0 && (
                        <div className="diff-category-group">
                          <span className="diff-tag tag-modified">
                            <Edit3 size={11} /> {diffResult.modifiedNodes.length} Modified
                          </span>
                          <ul className="diff-items-list">
                            {diffResult.modifiedNodes.map((name, i) => (
                              <li key={i} className="diff-item modified">
                                ~ {name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(diffResult.addedEdgesCount > 0 ||
                        diffResult.removedEdgesCount > 0) && (
                        <div className="diff-category-group">
                          <span className="diff-tag tag-edges">
                            Link transitions: {diffResult.addedEdgesCount > 0 ? `+${diffResult.addedEdgesCount} added ` : ''}
                            {diffResult.removedEdgesCount > 0 ? `-${diffResult.removedEdgesCount} removed` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="inspector-empty-state">
              <History size={32} />
              <p>Select a version from the timeline to view details and audit diffs.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
