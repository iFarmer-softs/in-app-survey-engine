import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { DecisionNodeData } from '../../types/survey';
import { EightWayHandles } from './EightWayHandles';

export const DecisionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as DecisionNodeData;

  return (
    <div className={`survey-node decision-node ${selected ? 'is-selected' : ''}`}>
      {/* 8-Way Connection Anchors with Match (bottom) and Else (right) */}
      <EightWayHandles
        bottomCenterId="match"
        rightId="else"
      />

      <div className="decision-diamond">
        <GitBranch size={16} className="decision-icon" />
        <div className="decision-content">
          <div className="decision-label">{nodeData.label || 'Condition Rule'}</div>
          <div className="decision-rule">
            <span className="rule-type">{nodeData.conditionType?.toUpperCase()}:</span>{' '}
            <span className="rule-val">{String(nodeData.comparisonValue || '')}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
