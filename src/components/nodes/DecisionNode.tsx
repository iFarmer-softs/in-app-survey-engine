import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { DecisionNodeData } from '../../types/survey';

export const DecisionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as DecisionNodeData;

  return (
    <div className={`survey-node decision-node ${selected ? 'is-selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="node-handle target-handle"
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

      {/* True / Match branch at bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="match"
        className="node-handle source-handle match-handle"
      />

      {/* False / Else branch at right */}
      <Handle
        type="source"
        position={Position.Right}
        id="else"
        className="node-handle source-handle else-handle"
      />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
