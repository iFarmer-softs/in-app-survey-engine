import React from 'react';
import { AlertTriangle, X, ArrowRight, GitBranch, Check } from 'lucide-react';

export interface WarningAlertData {
  title: string;
  sourceLabel: string;
  targetLabel: string;
  existingBranch: string;
  newBranch: string;
  message?: string;
  tip?: string;
}

interface WarningAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: WarningAlertData | null;
}

export const WarningAlertModal: React.FC<WarningAlertModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen || !data) return null;

  return (
    <div className="modal-backdrop warning-alert-backdrop" onClick={onClose}>
      <div
        className="modal-container warning-alert-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header warning-modal-header">
          <div className="modal-title-row">
            <div className="warning-icon-wrapper">
              <AlertTriangle size={22} className="warning-title-icon" />
            </div>
            <div>
              <h3 className="modal-title warning-title">{data.title}</h3>
              <p className="modal-subtitle">Flowchart Branching Logic Conflict</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Dismiss">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="warning-modal-body">
          {/* Visual Conflict Diagram */}
          <div className="conflict-diagram-card">
            <div className="conflict-node-box source-box">
              <span className="conflict-node-tag">Source Question</span>
              <span className="conflict-node-name">{data.sourceLabel}</span>
            </div>

            <div className="conflict-arrows-col">
              <div className="conflict-branch-line branch-existing">
                <span className="branch-pill existing-pill">
                  <GitBranch size={11} />
                  <span>{data.existingBranch}</span>
                </span>
                <ArrowRight size={14} className="arrow-icon" />
              </div>

              <div className="conflict-branch-line branch-new">
                <span className="branch-pill new-pill">
                  <GitBranch size={11} />
                  <span>{data.newBranch} (Blocked)</span>
                </span>
                <ArrowRight size={14} className="arrow-icon" />
              </div>
            </div>

            <div className="conflict-node-box target-box">
              <span className="conflict-node-tag">Target Question</span>
              <span className="conflict-node-name">{data.targetLabel}</span>
            </div>
          </div>

          {/* Explanation Text */}
          <div className="warning-explanation-box">
            <p className="warning-main-text">
              {data.message || (
                <>
                  Branch <strong>{data.existingBranch}</strong> is already connected to{' '}
                  <strong>{data.targetLabel}</strong>. Connecting{' '}
                  <strong>{data.newBranch}</strong> to the exact same question creates a{' '}
                  <span className="text-amber">redundant condition</span>.
                </>
              )}
            </p>
            <div className="warning-tip-box">
              <div className="tip-badge">
                <Check size={12} />
                <span>Recommended Solution</span>
              </div>
              <p className="tip-text">
                {data.tip ||
                  'If this downstream step should always appear regardless of the answer, delete the conditional option branch and connect from the default bottom handle (unconditional progression) instead.'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer warning-modal-footer">
          <button className="btn btn-primary btn-warning-action" onClick={onClose}>
            Got it, I understand
          </button>
        </div>
      </div>
    </div>
  );
};
