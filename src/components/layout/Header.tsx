import React from 'react';
import {
  Code2,
  Smartphone,
  RotateCcw,
  Sparkles,
  ArrowLeft,
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
          <span>{edgeCount} Connections</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="header-actions">
        <button
          className="btn btn-secondary"
          onClick={onAutoLayout}
          title="Auto arrange nodes top-to-bottom"
        >
          <Sparkles size={14} />
          <span>Auto Layout</span>
        </button>

        <button
          className="btn btn-secondary"
          onClick={onResetSample}
          title="Reset to default sample"
        >
          <RotateCcw size={14} />
          <span>Reset Sample</span>
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
