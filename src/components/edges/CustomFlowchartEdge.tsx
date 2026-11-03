import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
  useReactFlow,
} from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { X, GitBranch, Network } from 'lucide-react';
import { resolveNodeGroupId } from '../../utils/flowValidator';

export interface CustomEdgeData {
  validationType?: 'match' | 'greater' | 'less';
  triggerValue?: string | number;
  routingType?: 'smoothstep' | 'bezier' | 'straight';
  label?: string;
  isError?: boolean;
  isCrossGroup?: boolean;
  sourceGroup?: number;
  targetGroup?: number;
}

export const CustomFlowchartEdge: React.FC<EdgeProps> = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
  label,
  sourceHandleId,
}) => {
  const { setEdges, getNode, getNodes } = useReactFlow();
  const edgeData = (data as CustomEdgeData) || {};

  // Dynamically resolve source and target node groups to ensure 100% accurate live cross-group detection
  const allNodes = getNodes();
  const sourceNode = source ? getNode(source) : undefined;
  const targetNode = target ? getNode(target) : undefined;

  const dynamicSourceGroup = sourceNode ? resolveNodeGroupId(sourceNode, allNodes) : edgeData.sourceGroup;
  const dynamicTargetGroup = targetNode ? resolveNodeGroupId(targetNode, allNodes) : edgeData.targetGroup;

  const isCrossGroup =
    Boolean(edgeData.isCrossGroup) ||
    Boolean(
      sourceNode &&
      targetNode &&
      sourceNode.type !== 'groupJump' &&
      targetNode.type !== 'groupJump' &&
      dynamicSourceGroup !== dynamicTargetGroup
    );

  const effectiveSourceGroup = edgeData.sourceGroup ?? dynamicSourceGroup;
  const effectiveTargetGroup = edgeData.targetGroup ?? dynamicTargetGroup;

  // Determine routing geometry
  const routing = edgeData.routingType || 'smoothstep';

  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  if (routing === 'bezier') {
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  } else if (routing === 'straight') {
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
  } else {
    // Default: smoothstep (orthogonal flowchart routing)
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 12,
    });
  }

  // Handle label display
  let conditionText = '';
  const isOptionHandle = Boolean(sourceHandleId && sourceHandleId.startsWith('opt-'));

  if (label && typeof label === 'string' && label.trim().length > 0) {
    conditionText = label;
  } else if (edgeData.triggerValue !== undefined && String(edgeData.triggerValue).length > 0) {
    if (edgeData.validationType === 'greater') {
      conditionText = `> ${edgeData.triggerValue}`;
    } else if (edgeData.validationType === 'less') {
      conditionText = `< ${edgeData.triggerValue}`;
    } else {
      conditionText = `IF "${edgeData.triggerValue}"`;
    }
  } else if (isOptionHandle) {
    const rawVal = decodeURIComponent(sourceHandleId!.replace('opt-', ''));
    conditionText = `IF "${rawVal}"`;
  }

  const isConditional = Boolean(conditionText);
  const isDecisionElse = sourceHandleId === 'else';
  const isDecisionMatch = sourceHandleId === 'match';

  // Compute theme color
  let strokeColor = '#3b82f6'; // default blue
  if (edgeData.isError) {
    strokeColor = '#ef4444';
  } else if (isCrossGroup) {
    strokeColor = '#8b5cf6'; // vibrant purple for cross-group foreign dependency
  } else if (isConditional || isDecisionMatch) {
    strokeColor = '#f59e0b'; // amber
  } else if (isDecisionElse) {
    strokeColor = '#ec4899'; // pink
  } else if (style.stroke) {
    strokeColor = String(style.stroke);
  }

  const edgeStyle: React.CSSProperties = {
    ...style,
    stroke: strokeColor,
    strokeWidth: selected ? 2.5 : style.strokeWidth || 2,
    strokeDasharray: isCrossGroup || isConditional || isDecisionElse ? '5 5' : style.strokeDasharray,
    transition: 'stroke 0.2s, stroke-width 0.2s',
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((eds) => eds.filter((edge) => edge.id !== id));
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={edgeStyle}
        className={`custom-flowchart-base-edge ${selected ? 'is-selected' : ''}`}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`custom-edge-badge-container ${selected ? 'is-selected' : ''} ${
            isCrossGroup ? 'is-cross-group' : isConditional ? 'is-conditional' : ''
          }`}
        >
          {isCrossGroup ? (
            <div
              className={`custom-edge-pill pill-cross-group ${edgeData.isError ? 'pill-error' : ''}`}
              title={`Cross-Group Dependency: Group ${effectiveSourceGroup ?? '?'} ➔ Group ${effectiveTargetGroup ?? '?'}`}
            >
              <Network size={11} className="edge-pill-icon" />
              {effectiveSourceGroup !== undefined && effectiveTargetGroup !== undefined && (
                <span className="edge-cross-group-badge">
                  G{effectiveSourceGroup}➔G{effectiveTargetGroup}
                </span>
              )}
              <span className="edge-pill-text">{conditionText || 'Cross-Group'}</span>
              <button
                type="button"
                className="edge-delete-btn"
                onClick={handleDelete}
                title="Delete Cross-Group Connection"
              >
                <X size={10} />
              </button>
            </div>
          ) : isConditional ? (
            <div
              className={`custom-edge-pill ${
                edgeData.isError ? 'pill-error' : isDecisionElse ? 'pill-else' : 'pill-condition'
              }`}
              title="Conditional Branch"
            >
              <GitBranch size={11} className="edge-pill-icon" />
              <span className="edge-pill-text">{conditionText}</span>
              <button
                type="button"
                className="edge-delete-btn"
                onClick={handleDelete}
                title="Delete Connection"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <div className="custom-edge-default-handle">
              <button
                type="button"
                className="edge-quick-delete-btn"
                onClick={handleDelete}
                title="Delete Connection"
              >
                <X size={11} />
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
