import React from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Target,
  Workflow,
} from 'lucide-react';
import type { FlowDiagnostic } from '../../utils/flowValidator';
import { Modal } from '../ui/Modal';

interface FlowDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: FlowDiagnostic[];
  onSelectNode: (nodeId: string) => void;
}

export const FlowDiagnosticsModal: React.FC<FlowDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
  onSelectNode,
}) => {
  const errorCount = diagnostics.filter((d) => d.type === 'error').length;
  const warningCount = diagnostics.filter((d) => d.type === 'warning').length;
  const infoCount = diagnostics.filter((d) => d.type === 'info').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="diagnostics-modal"
      icon={<Workflow size={20} className="text-emerald" />}
      title="Flowchart Health & Validation"
      subtitle="Real-time checks for schema compliance, connectivity, and mobile compatibility"
    >
      {/* Status Summary Banner */}
      <div className="diagnostics-summary-bar">
        {errorCount === 0 && warningCount === 0 ? (
          <div className="diagnostics-status-pill status-healthy">
            <CheckCircle2 size={16} />
            <span>Flowchart is healthy & ready for export (0 errors)</span>
          </div>
        ) : (
          <div className="diagnostics-counts-row">
            {errorCount > 0 && (
              <div className="badge-count badge-error">
                <AlertCircle size={14} />
                <span>{errorCount} Error{errorCount > 1 ? 's' : ''}</span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="badge-count badge-warning">
                <AlertTriangle size={14} />
                <span>{warningCount} Warning{warningCount > 1 ? 's' : ''}</span>
              </div>
            )}
            {infoCount > 0 && (
              <div className="badge-count badge-info">
                <Info size={14} />
                <span>{infoCount} Tip{infoCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Diagnostics List */}
      <div className="diagnostics-list">
        {diagnostics.length === 0 ? (
          <div className="diagnostics-empty">
            <CheckCircle2 size={40} className="text-emerald" />
            <h3>All Checks Passed</h3>
            <p>No orphan nodes, missing options, or cyclical dependencies found.</p>
          </div>
        ) : (
          diagnostics.map((diag) => {
            const isError = diag.type === 'error';
            const isWarning = diag.type === 'warning';

            return (
              <div
                key={diag.id}
                className={`diagnostic-card card-${diag.type}`}
              >
                <div className="diagnostic-card-header">
                  <div className="diagnostic-icon-title">
                    {isError ? (
                      <AlertCircle size={16} className="diag-icon diag-error" />
                    ) : isWarning ? (
                      <AlertTriangle size={16} className="diag-icon diag-warning" />
                    ) : (
                      <Info size={16} className="diag-icon diag-info" />
                    )}
                    <span className="diagnostic-title">{diag.title}</span>
                  </div>

                  {diag.nodeId && (
                    <button
                      className="btn-locate-node"
                      onClick={() => {
                        onSelectNode(diag.nodeId!);
                        onClose();
                      }}
                      title="Focus node on canvas"
                    >
                      <Target size={13} />
                      <span>Locate</span>
                    </button>
                  )}
                </div>
                <p className="diagnostic-desc">{diag.description}</p>
              </div>
            );
          })
        )}
      </div>

      <div className="modal-footer">
        <button className="btn btn-primary" onClick={onClose}>
          Close Diagnostics
        </button>
      </div>
    </Modal>
  );
};
