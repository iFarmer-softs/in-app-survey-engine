import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { FastForward, Play, CheckCircle2, Cpu, FileText } from 'lucide-react';
import type { GroupJumpNodeData } from '../../types/survey';

export const GroupJumpNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as GroupJumpNodeData;

  return (
    <div className={`survey-node group-jump-node ${selected ? 'is-selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="node-handle target-handle"
      />
      <div className="jump-inner">
        <FastForward size={16} className="jump-icon" />
        <div className="jump-text">
          <span className="jump-title">Connector / Group Jump</span>
          <span className="jump-name">
            {nodeData.targetGroupTitle || `Group ${nodeData.targetGroupId}`}
          </span>
        </div>
      </div>
    </div>
  );
});

GroupJumpNode.displayName = 'GroupJumpNode';

export const StartNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div className={`survey-node start-node ${selected ? 'is-selected' : ''}`}>
      <div className="pill-node-inner">
        <Play size={14} className="pill-icon" />
        <span>{(data?.label as string) || 'Group Start'}</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="node-handle source-handle"
      />
    </div>
  );
});

StartNode.displayName = 'StartNode';

export const EndNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div className={`survey-node end-node ${selected ? 'is-selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="node-handle target-handle"
      />
      <div className="pill-node-inner">
        <CheckCircle2 size={14} className="pill-icon" />
        <span>{(data?.label as string) || 'Next Group / Submit'}</span>
      </div>
    </div>
  );
});

EndNode.displayName = 'EndNode';

export const ProcessNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div className={`survey-node process-node ${selected ? 'is-selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="node-handle target-handle"
      />
      <div className="process-inner">
        <Cpu size={14} className="process-icon" />
        <div className="process-info">
          <span className="process-tag">Process Step</span>
          <span className="process-name">{(data?.label as string) || (data?.name as string) || 'Auto Computation'}</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="node-handle source-handle"
      />
    </div>
  );
});

ProcessNode.displayName = 'ProcessNode';

export const DocumentNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div className={`survey-node document-node ${selected ? 'is-selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="node-handle target-handle"
      />
      <div className="document-inner">
        <FileText size={14} className="document-icon" />
        <div className="document-info">
          <span className="document-tag">Document / Consent</span>
          <span className="document-name">{(data?.label as string) || (data?.name as string) || 'Farmer Agreement'}</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="node-handle source-handle"
      />
    </div>
  );
});

DocumentNode.displayName = 'DocumentNode';
