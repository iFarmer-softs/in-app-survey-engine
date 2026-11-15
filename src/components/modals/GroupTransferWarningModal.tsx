import React from 'react';
import { AlertTriangle, ArrowRight, Layers } from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { Node } from '@xyflow/react';

export interface PendingGroupTransfer {
  nodes: Node[];
  sourceContainer: Node;
  targetContainer: Node;
  onConfirm: () => void;
  onCancel: () => void;
}

interface GroupTransferWarningModalProps {
  isOpen: boolean;
  transfer: PendingGroupTransfer | null;
  onClose: () => void;
}

export const GroupTransferWarningModal: React.FC<GroupTransferWarningModalProps> = ({
  isOpen,
  transfer,
  onClose,
}) => {
  if (!transfer) return null;

  const { nodes, sourceContainer, targetContainer, onConfirm, onCancel } = transfer;

  const sourceData = sourceContainer.data as any;
  const targetData = targetContainer.data as any;

  const sourceGroupId =
    sourceData?.numericGroupId ||
    parseInt(String(sourceData?.groupId || '').replace(/\D+/g, ''), 10) ||
    1;
  const targetGroupId =
    targetData?.numericGroupId ||
    parseInt(String(targetData?.groupId || '').replace(/\D+/g, ''), 10) ||
    1;

  const sourceTitle =
    sourceData?.title || sourceData?.titleBn || `Group Area #${sourceGroupId}`;
  const targetTitle =
    targetData?.title || targetData?.titleBn || `Group Area #${targetGroupId}`;

  const sourceColor = sourceData?.color || '#0284c7';
  const targetColor = targetData?.color || '#10b981';

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const nodeLabels = nodes.map((n) => {
    const data = n.data as any;
    if (n.type === 'question') {
      const qId = data?.question_id ? `Q#${data.question_id}` : '';
      const text = data?.question_bn || data?.question || 'Untitled Question';
      return qId ? `${qId}: ${text}` : text;
    }
    if (n.type === 'decision') return `Condition: ${data?.label || 'Decision'}`;
    if (n.type === 'groupJump') return `Group Jump: Group ${data?.targetGroupId || ''}`;
    return data?.label || n.id;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      className="warning-alert-modal group-transfer-warning-modal"
      icon={
        <div
          className="warning-icon-wrapper"
          style={{
            background: 'rgba(245, 158, 11, 0.15)',
            borderColor: 'rgba(245, 158, 11, 0.4)',
          }}
        >
          <AlertTriangle
            size={22}
            className="warning-title-icon"
            style={{ color: '#f59e0b' }}
          />
        </div>
      }
      title="Move Question/Symbol to Another Group?"
      subtitle="Group Membership & Connection Reconfiguration"
    >
      <div className="warning-modal-body">
        {/* Visual Diagram: Source Group -> Target Group */}
        <div
          className="conflict-diagram-card"
          style={{ background: '#090d16', padding: '16px', borderRadius: '10px' }}
        >
          <div
            className="conflict-node-box source-box"
            style={{
              borderColor: `${sourceColor}60`,
              background: `${sourceColor}10`,
              flex: 1,
            }}
          >
            <span
              className="conflict-node-tag"
              style={{
                color: sourceColor,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Layers size={10} />
              <span>Current Group #{sourceGroupId}</span>
            </span>
            <span className="conflict-node-name bn-font" style={{ color: '#fff' }}>
              {sourceTitle}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 8px',
              color: '#fbbf24',
            }}
          >
            <ArrowRight size={20} />
          </div>

          <div
            className="conflict-node-box target-box"
            style={{
              borderColor: `${targetColor}60`,
              background: `${targetColor}10`,
              flex: 1,
            }}
          >
            <span
              className="conflict-node-tag"
              style={{
                color: targetColor,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Layers size={10} />
              <span>Destination Group #{targetGroupId}</span>
            </span>
            <span className="conflict-node-name bn-font" style={{ color: '#fff' }}>
              {targetTitle}
            </span>
          </div>
        </div>

        {/* Affected Nodes List */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            padding: '12px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Moving Item{nodes.length > 1 ? 's' : ''} ({nodes.length}):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {nodeLabels.map((lbl, idx) => (
              <span
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 12,
                  color: '#e2e8f0',
                }}
                className="bn-font"
              >
                {lbl}
              </span>
            ))}
          </div>
        </div>

        {/* Warning Explanation */}
        <div className="warning-explanation-box">
          <p
            className="warning-main-text"
            style={{ fontSize: 13, lineHeight: '1.5', margin: 0 }}
          >
            Moving {nodes.length > 1 ? 'these items' : 'this item'} to{' '}
            <strong style={{ color: targetColor }}>
              Group #{targetGroupId} ({targetTitle})
            </strong>{' '}
            will update {nodes.length > 1 ? 'their' : 'its'} group membership.
          </p>
          <div
            className="warning-tip-box"
            style={{
              marginTop: 10,
              background: 'rgba(245, 158, 11, 0.08)',
              borderColor: 'rgba(245, 158, 11, 0.3)',
              padding: '10px 12px',
            }}
          >
            <div
              className="tip-badge"
              style={{
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              <AlertTriangle size={12} />
              <span>Important Note on Connections</span>
            </div>
            <p
              className="tip-text"
              style={{
                fontSize: 12,
                margin: '4px 0 0 0',
                color: 'var(--text-secondary)',
              }}
            >
              Any existing incoming or outgoing links connecting{' '}
              {nodes.length > 1 ? 'these symbols' : 'this symbol'} with
              questions inside <strong>Group #{sourceGroupId}</strong> will be
              automatically severed to avoid invalid cross-group dependencies.
            </p>
          </div>
        </div>
      </div>

      <div
        className="modal-footer warning-modal-footer"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          padding: '16px 20px',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleCancel}
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          Cancel (Stay in Group #{sourceGroupId})
        </button>
        <button
          type="button"
          className="btn btn-warning"
          onClick={handleConfirm}
          style={{
            background: '#f59e0b',
            color: '#000',
            fontWeight: 600,
            padding: '8px 18px',
            fontSize: 13,
            border: 'none',
            borderRadius: 'var(--radius-md, 6px)',
            cursor: 'pointer',
          }}
        >
          Confirm Move to Group #{targetGroupId}
        </button>
      </div>
    </Modal>
  );
};

