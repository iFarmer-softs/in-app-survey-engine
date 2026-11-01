import React from 'react';
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
} from 'lucide-react';
import type { GroupMeta } from '../../utils/schemaCompiler';

interface HeaderProps {
  projectTitle?: string;
  groupMeta: GroupMeta;
  onOpenJsonModal: () => void;
  onOpenMobileModal: () => void;
  onResetSample: () => void;
  onAutoLayout: () => void;
  onBackToList?: () => void;
  nodeCount: number;
  edgeCount: number;
  diagnosticsCount: number;
  diagnosticsErrors: number;
  onOpenDiagnostics: () => void;
  edgeRouting: 'smoothstep' | 'bezier' | 'straight';
  onChangeEdgeRouting: (routing: 'smoothstep' | 'bezier' | 'straight') => void;
  onAlignHorizontal: () => void;
  onAlignVertical: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectTitle,
  groupMeta,
  onOpenJsonModal,
  onOpenMobileModal,
  onResetSample,
  onAutoLayout,
  onBackToList,
  nodeCount,
  edgeCount,
  diagnosticsCount,
  diagnosticsErrors,
  onOpenDiagnostics,
  edgeRouting,
  onChangeEdgeRouting,
  onAlignHorizontal,
  onAlignVertical,
}) => {
  return (
    <header className="app-header">
      {/* Brand logo & title */}
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
            <span className="badge-beta">Dynamic KYC</span>
          </div>
          <span className="brand-sub">Visual Flowchart Designer & Schema Generator</span>
        </div>
      </div>

      {/* Middle status & stats */}
      <div className="header-meta">
        <div className="meta-pill group-pill">
          <span className="pill-dot"></span>
          <span>Group {groupMeta.groupNumber} of {groupMeta.totalGroups}</span>
        </div>
        <div className="meta-pill stats-pill">
          <span>{nodeCount} Nodes</span>
          <span className="pill-divider">•</span>
          <span>{edgeCount} Links</span>
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
              <span>{diagnosticsErrors} Flow Errors</span>
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

      {/* Action buttons & tools */}
      <div className="header-actions">
        {/* Edge Routing Selector */}
        <div className="header-routing-selector" title="Flowchart Line Style">
          <GitBranch size={13} className="routing-icon" />
          <select
            value={edgeRouting}
            onChange={(e) =>
              onChangeEdgeRouting(
                e.target.value as 'smoothstep' | 'bezier' | 'straight'
              )
            }
            className="header-select-routing"
          >
            <option value="smoothstep">Orthogonal (Flowchart)</option>
            <option value="bezier">Smooth Curved</option>
            <option value="straight">Straight Line</option>
          </select>
        </div>

        {/* Alignment Tools */}
        <div className="header-align-group">
          <button
            className="btn btn-icon"
            onClick={onAlignHorizontal}
            title="Align Nodes Horizontally (Center Y)"
          >
            <AlignHorizontalDistributeCenter size={14} />
          </button>
          <button
            className="btn btn-icon"
            onClick={onAlignVertical}
            title="Align Nodes Vertically (Center X)"
          >
            <AlignVerticalDistributeCenter size={14} />
          </button>
        </div>

        <button
          className="btn btn-secondary"
          onClick={onAutoLayout}
          title="Hierarchical Tree Auto Layout (No branch overlap)"
        >
          <Sparkles size={14} />
          <span>Tree Layout</span>
        </button>

        <button
          className="btn btn-secondary"
          onClick={onResetSample}
          title="Reset to default sample"
        >
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>

        <button
          className="btn btn-secondary btn-mobile-preview"
          onClick={onOpenMobileModal}
        >
          <Smartphone size={15} />
          <span>Mobile Preview</span>
        </button>

        <button
          className="btn btn-primary"
          onClick={onOpenJsonModal}
        >
          <Code2 size={15} />
          <span>Generate JSON</span>
        </button>
      </div>
    </header>
  );
};
