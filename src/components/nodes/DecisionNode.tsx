import { memo, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position, useEdges, useNodes } from '@xyflow/react';
import { Split, Check, X } from 'lucide-react';
import type { DecisionNodeData } from '../../types/survey';

/**
 * Maps condition type to natural, plain-language English phrases.
 */
export function getOperatorLabel(conditionType?: string, comparisonValue?: any): string {
  switch (conditionType) {
    case 'greater':
      return 'is greater than';
    case 'less':
      return 'is less than';
    case 'greater_or_equal':
      return 'is at least';
    case 'less_or_equal':
      return 'is at most';
    case 'not_match':
      return 'does not equal';
    case 'contains':
      return 'contains';
    case 'match':
    default: {
      const v = String(comparisonValue || '').toLowerCase().trim();
      if (v === 'yes' || v === 'true' || v === 'হ্যাঁ') {
        return 'is';
      }
      return 'equals';
    }
  }
}

export const DecisionNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as DecisionNodeData;
  const edges = useEdges();
  const nodes = useNodes();

  // Find incoming connection to dynamically resolve compared question ID
  const subjectText = useMemo(() => {
    if (nodeData.parentQuestionId) {
      return `Q#${nodeData.parentQuestionId}`;
    }
    const incomingEdge = edges?.find((e) => e.target === id);
    if (incomingEdge && nodes) {
      const srcNode = nodes.find((n) => n.id === incomingEdge.source);
      if (srcNode) {
        const qId = (srcNode.data as any)?.question_id;
        if (qId) return `Q#${qId}`;
        const label = (srcNode.data as any)?.question || (srcNode.data as any)?.label;
        if (label) return String(label).slice(0, 16);
      }
    }
    return nodeData.label && nodeData.label !== 'Condition Rule' && nodeData.label !== 'Decision Diamond'
      ? nodeData.label
      : 'Question';
  }, [id, nodeData.parentQuestionId, nodeData.label, edges, nodes]);

  const operatorText = useMemo(() => {
    return getOperatorLabel(nodeData.conditionType, nodeData.comparisonValue);
  }, [nodeData.conditionType, nodeData.comparisonValue]);

  const valueDisplay = useMemo(() => {
    if (
      nodeData.comparisonValue !== undefined &&
      nodeData.comparisonValue !== null &&
      String(nodeData.comparisonValue).trim() !== ''
    ) {
      return String(nodeData.comparisonValue);
    }
    return '...';
  }, [nodeData.comparisonValue]);

  return (
    <div className={`survey-node decision-node ${selected ? 'is-selected' : ''}`}>
      {/* Top Incoming Handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        className="node-handle target-handle decision-top-handle"
        title="Incoming Flow (Top)"
      />
      {/* Left Incoming Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="in-left"
        className="node-handle target-handle decision-left-handle"
        title="Incoming Flow (Left)"
      />

      <div className="decision-diamond-card">
        {/* Header with Split Icon */}
        <div className="decision-diamond">
          <Split size={16} className="decision-icon" />
          <span className="decision-title">Condition Check</span>
        </div>

        {/* Full Plain-Language Rule Sentence: IF Q#108 is greater than 50 */}
        <div
          className="decision-sentence"
          title={`IF ${subjectText} ${operatorText} ${valueDisplay}`}
        >
          <span className="decision-token-if">IF</span>
          <span className="decision-token-subject">{subjectText}</span>
          <span className="decision-token-operator">{operatorText}</span>
          <span className="decision-token-value">{valueDisplay}</span>
        </div>

        {/* Dedicated Branches: ✓ Yes and ✗ No */}
        <div className="decision-branches">
          {/* Yes Branch Row */}
          <div className="decision-branch-row branch-row-yes">
            <div className="branch-label-box">
              <Check size={12} className="branch-icon branch-icon-yes" strokeWidth={2.5} />
              <span className="branch-label-text branch-text-yes">Yes</span>
            </div>
            <Handle
              type="source"
              position={Position.Right}
              id="match"
              className="node-handle source-handle branch-handle handle-yes"
              title="Yes (Condition Satisfied)"
            />
          </div>

          {/* No Branch Row */}
          <div className="decision-branch-row branch-row-no">
            <div className="branch-label-box">
              <X size={12} className="branch-icon branch-icon-no" strokeWidth={2.5} />
              <span className="branch-label-text branch-text-no">No</span>
            </div>
            <Handle
              type="source"
              position={Position.Right}
              id="else"
              className="node-handle source-handle branch-handle handle-no"
              title="No (Otherwise)"
            />
          </div>
        </div>
      </div>

      {/* Optional Bottom Handle for alternate vertical flow */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default-next"
        className="node-handle source-handle decision-bottom-handle"
        title="Alternate Exit (Bottom)"
      />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
