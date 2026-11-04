import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  useReactFlow,
  Position,
} from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { X, GitBranch, Network, RotateCcw } from 'lucide-react';
import { resolveNodeGroupId } from '../../utils/flowValidator';

function getBend(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  size: number
) {
  const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y);
  const bendSize = Math.min(dist(a, b) / 2, dist(b, c) / 2, size);
  const { x, y } = b;
  if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) {
    return `L${x} ${y}`;
  }
  if (a.y === y) {
    const xDir = a.x < c.x ? -1 : 1;
    const yDir = a.y < c.y ? 1 : -1;
    return `L ${x + bendSize * xDir},${y}Q ${x},${y} ${x},${y + bendSize * yDir}`;
  }
  const xDir = a.x < c.x ? 1 : -1;
  const yDir = a.y < c.y ? -1 : 1;
  return `L ${x},${y + bendSize * yDir}Q ${x},${y} ${x + bendSize * xDir},${y}`;
}

function simplifyPoints(pts: Array<{ x: number; y: number }>) {
  if (pts.length <= 2) return pts;
  const res: Array<{ x: number; y: number }> = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = res[res.length - 1];
    const curr = pts[i];
    if (Math.abs(prev.x - curr.x) < 0.01 && Math.abs(prev.y - curr.y) < 0.01) continue;
    if (res.length >= 2) {
      const prevPrev = res[res.length - 2];
      const isCollinearX = Math.abs(prevPrev.x - prev.x) < 0.01 && Math.abs(prev.x - curr.x) < 0.01;
      const isCollinearY = Math.abs(prevPrev.y - prev.y) < 0.01 && Math.abs(prev.y - curr.y) < 0.01;
      if (isCollinearX || isCollinearY) {
        res[res.length - 1] = curr;
        continue;
      }
    }
    res.push(curr);
  }
  return res;
}

function buildSvgPath(rawPts: Array<{ x: number; y: number }>, borderRadius: number = 12): string {
  const pts = simplifyPoints(rawPts);
  if (pts.length < 2) return '';
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    d += getBend(pts[i - 1], pts[i], pts[i + 1], borderRadius);
  }
  d += `L${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

export function getOrthogonalPathWithDetour({
  sourceX,
  sourceY,
  sourcePosition = Position.Bottom,
  targetX,
  targetY,
  targetPosition = Position.Top,
  borderRadius = 12,
  centerX,
  centerY,
  offset = 20,
}: {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  borderRadius?: number;
  centerX?: number;
  centerY?: number;
  offset?: number;
}): [string, number, number] {
  const defaultCenterX = (sourceX + targetX) / 2;
  const defaultCenterY = (sourceY + targetY) / 2;
  const cx = centerX ?? defaultCenterX;
  const cy = centerY ?? defaultCenterY;

  const effectiveSourcePos = sourcePosition || Position.Bottom;
  const effectiveTargetPos = targetPosition || Position.Top;

  const isSourceHoriz = effectiveSourcePos === Position.Left || effectiveSourcePos === Position.Right;
  const isTargetHoriz = effectiveTargetPos === Position.Left || effectiveTargetPos === Position.Right;
  const isSourceVert = effectiveSourcePos === Position.Top || effectiveSourcePos === Position.Bottom;
  const isTargetVert = effectiveTargetPos === Position.Top || effectiveTargetPos === Position.Bottom;

  const isValidXOut = (x: number) =>
    effectiveSourcePos === Position.Right ? x >= sourceX + offset : x <= sourceX - offset;
  const isValidYOut = (y: number) =>
    effectiveSourcePos === Position.Bottom ? y >= sourceY + offset : y <= sourceY - offset;
  const isValidXIn = (x: number) =>
    effectiveTargetPos === Position.Right ? x >= targetX + offset : x <= targetX - offset;
  const isValidYIn = (y: number) =>
    effectiveTargetPos === Position.Bottom ? y >= targetY + offset : y <= targetY - offset;

  let pts: Array<{ x: number; y: number }> = [];
  let labelX = cx;
  let labelY = cy;

  // Case 1: Same Side Handles (e.g. Right->Right, Left->Left, Bottom->Bottom, Top->Top)
  if (effectiveSourcePos === effectiveTargetPos) {
    if (effectiveSourcePos === Position.Right) {
      const xMax = Math.max(sourceX + offset, targetX + offset, cx);
      pts = [
        { x: sourceX, y: sourceY },
        { x: xMax, y: sourceY },
        { x: xMax, y: targetY },
        { x: targetX, y: targetY },
      ];
      labelX = xMax;
      labelY = cy;
    } else if (effectiveSourcePos === Position.Left) {
      const xMin = Math.min(sourceX - offset, targetX - offset, cx);
      pts = [
        { x: sourceX, y: sourceY },
        { x: xMin, y: sourceY },
        { x: xMin, y: targetY },
        { x: targetX, y: targetY },
      ];
      labelX = xMin;
      labelY = cy;
    } else if (effectiveSourcePos === Position.Bottom) {
      const yMax = Math.max(sourceY + offset, targetY + offset, cy);
      pts = [
        { x: sourceX, y: sourceY },
        { x: sourceX, y: yMax },
        { x: targetX, y: yMax },
        { x: targetX, y: targetY },
      ];
      labelX = cx;
      labelY = yMax;
    } else {
      const yMin = Math.min(sourceY - offset, targetY - offset, cy);
      pts = [
        { x: sourceX, y: sourceY },
        { x: sourceX, y: yMin },
        { x: targetX, y: yMin },
        { x: targetX, y: targetY },
      ];
      labelX = cx;
      labelY = yMin;
    }
  }
  // Case 2: Perpendicular - Source Horizontal (Right/Left), Target Vertical (Top/Bottom)
  // (Standard for Option Handles to Questions, Group Jump to Questions, Group Frame side exits)
  else if (isSourceHoriz && isTargetVert) {
    const xExit = isValidXOut(cx) ? cx : effectiveSourcePos === Position.Right ? sourceX + offset : sourceX - offset;
    const yEntry = isValidYIn(cy) ? cy : effectiveTargetPos === Position.Bottom ? targetY + offset : targetY - offset;
    pts = [
      { x: sourceX, y: sourceY },
      { x: xExit, y: sourceY },
      { x: xExit, y: yEntry },
      { x: targetX, y: yEntry },
      { x: targetX, y: targetY },
    ];
    labelX = cx;
    labelY = cy;
  }
  // Case 3: Perpendicular - Source Vertical (Bottom/Top), Target Horizontal (Left/Right)
  // (Standard for Questions to Group Jump Left handle, or side entrances)
  else if (isSourceVert && isTargetHoriz) {
    const yExit = isValidYOut(cy) ? cy : effectiveSourcePos === Position.Bottom ? sourceY + offset : sourceY - offset;
    const xEntry = isValidXIn(cx) ? cx : effectiveTargetPos === Position.Right ? targetX + offset : targetX - offset;
    pts = [
      { x: sourceX, y: sourceY },
      { x: sourceX, y: yExit },
      { x: xEntry, y: yExit },
      { x: xEntry, y: targetY },
      { x: targetX, y: targetY },
    ];
    labelX = cx;
    labelY = cy;
  }
  // Case 4: Parallel Opposite Vertical (Bottom -> Top or Top -> Bottom)
  // (Standard flowchart vertical flow, Group Frame to Group Frame, Cross-Group stacked flow)
  else if (isSourceVert && isTargetVert) {
    const isForward =
      effectiveSourcePos === Position.Bottom
        ? targetY >= sourceY + 2 * offset
        : targetY <= sourceY - 2 * offset;

    if (isForward) {
      if (Math.abs(cx - defaultCenterX) > 5) {
        const y1 = effectiveSourcePos === Position.Bottom ? sourceY + offset : sourceY - offset;
        const y2 = effectiveTargetPos === Position.Top ? targetY - offset : targetY + offset;
        pts = [
          { x: sourceX, y: sourceY },
          { x: sourceX, y: y1 },
          { x: cx, y: y1 },
          { x: cx, y: y2 },
          { x: targetX, y: y2 },
          { x: targetX, y: targetY },
        ];
      } else {
        pts = [
          { x: sourceX, y: sourceY },
          { x: sourceX, y: cy },
          { x: targetX, y: cy },
          { x: targetX, y: targetY },
        ];
      }
    } else {
      // Backward / Reverse or side-by-side vertical (loops around)
      const yOut = effectiveSourcePos === Position.Bottom ? Math.max(sourceY + offset, cy) : Math.min(sourceY - offset, cy);
      const yIn = effectiveTargetPos === Position.Top ? Math.min(targetY - offset, cy) : Math.max(targetY + offset, cy);
      pts = [
        { x: sourceX, y: sourceY },
        { x: sourceX, y: yOut },
        { x: cx, y: yOut },
        { x: cx, y: yIn },
        { x: targetX, y: yIn },
        { x: targetX, y: targetY },
      ];
    }
    labelX = cx;
    labelY = cy;
  }
  // Case 5: Parallel Opposite Horizontal (Right -> Left or Left -> Right)
  // (Standard flowchart lateral flow, Jump Right to Question Left)
  else if (isSourceHoriz && isTargetHoriz) {
    const isForward =
      effectiveSourcePos === Position.Right
        ? targetX >= sourceX + 2 * offset
        : targetX <= sourceX - 2 * offset;

    if (isForward) {
      if (Math.abs(cy - defaultCenterY) > 5) {
        const x1 = effectiveSourcePos === Position.Right ? sourceX + offset : sourceX - offset;
        const x2 = effectiveTargetPos === Position.Left ? targetX - offset : targetX + offset;
        pts = [
          { x: sourceX, y: sourceY },
          { x: x1, y: sourceY },
          { x: x1, y: cy },
          { x: x2, y: cy },
          { x: x2, y: targetY },
          { x: targetX, y: targetY },
        ];
      } else {
        pts = [
          { x: sourceX, y: sourceY },
          { x: cx, y: sourceY },
          { x: cx, y: targetY },
          { x: targetX, y: targetY },
        ];
      }
    } else {
      // Backward / Reverse horizontal (loops around)
      const xOut = effectiveSourcePos === Position.Right ? Math.max(sourceX + offset, cx) : Math.min(sourceX - offset, cx);
      const xIn = effectiveTargetPos === Position.Left ? Math.min(targetX - offset, cx) : Math.max(targetX + offset, cx);
      pts = [
        { x: sourceX, y: sourceY },
        { x: xOut, y: sourceY },
        { x: xOut, y: cy },
        { x: xIn, y: cy },
        { x: xIn, y: targetY },
        { x: targetX, y: targetY },
      ];
    }
    labelX = cx;
    labelY = cy;
  } else {
    // Fallback safe straight step
    pts = [
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
    ];
  }

  const edgePath = buildSvgPath(pts, borderRadius);
  return [edgePath, labelX, labelY];
}

export interface CustomEdgeData {
  validationType?: 'match' | 'greater' | 'less';
  triggerValue?: string | number;
  routingType?: 'smoothstep' | 'bezier' | 'straight';
  label?: string;
  isError?: boolean;
  isCrossGroup?: boolean;
  sourceGroup?: number;
  targetGroup?: number;
  traceRole?: 'upstream' | 'downstream' | 'dimmed' | 'normal';
  centerX?: number;
  centerY?: number;
  offset?: number;
  curvature?: number;
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
  const { setEdges, getNode, getNodes, getZoom } = useReactFlow();
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
      curvature: edgeData.curvature ?? 0.25,
    });
  } else if (routing === 'straight') {
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
  } else {
    // Default: smoothstep with 2D detour support (both side-to-side and up/down movement)
    [edgePath, labelX, labelY] = getOrthogonalPathWithDetour({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 12,
      centerX: edgeData.centerX,
      centerY: edgeData.centerY,
      offset: edgeData.offset,
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
  const traceRole = edgeData.traceRole;

  if (traceRole === 'upstream') {
    strokeColor = '#06b6d4'; // Cyan for upstream ancestors
  } else if (traceRole === 'downstream') {
    strokeColor = '#f59e0b'; // Amber for downstream dependents
  } else if (traceRole === 'dimmed') {
    strokeColor = 'rgba(100, 116, 139, 0.22)';
  } else if (edgeData.isError) {
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

  const isTraced = traceRole === 'upstream' || traceRole === 'downstream';
  const isDimmed = traceRole === 'dimmed';

  const edgeStyle: React.CSSProperties = {
    ...style,
    stroke: strokeColor,
    strokeWidth: isTraced ? 3 : selected ? 2.5 : style.strokeWidth || 2,
    strokeDasharray: isTraced ? '6 4' : isCrossGroup || isConditional || isDecisionElse ? '5 5' : style.strokeDasharray,
    opacity: isDimmed ? 0.15 : style.opacity ?? 1,
    transition: 'stroke 0.25s, stroke-width 0.25s, opacity 0.25s',
  };

  let effectiveMarkerEnd = markerEnd;
  if (isTraced && markerEnd && typeof markerEnd === 'object') {
    effectiveMarkerEnd = {
      ...(markerEnd as any),
      color: strokeColor,
    };
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEdges((eds) => eds.filter((edge) => edge.id !== id));
    window.dispatchEvent(
      new CustomEvent('canvas-edge-delete', {
        detail: { edgeId: id },
      })
    );
  };

  // Bidirectional resize cursor for free 2D line corridor reshaping
  const resizeCursor = routing === 'bezier' ? 'grab' : 'move';

  // State for interactive dragging and hover
  const [isDragging, setIsDragging] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [dragInfo, setDragInfo] = React.useState<string | null>(null);

  // Direct On-Canvas Line Dragging (Figma / Miro style)
  const handleLinePointerDown = (e: React.PointerEvent<SVGElement | HTMLDivElement> | React.MouseEvent) => {
    if (e.button !== 0) return; // Left mouse button only
    e.stopPropagation();
    e.preventDefault();

    // Select this edge on canvas
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        selected: edge.id === id,
      }))
    );

    const zoom = getZoom();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;

    const initialCenterX = edgeData.centerX ?? labelX;
    const initialCenterY = edgeData.centerY ?? labelY;
    const initialCurvature = edgeData.curvature ?? 0.25;

    let currentX = initialCenterX;
    let currentY = initialCenterY;
    let hasMoved = false;

    setIsDragging(true);

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = resizeCursor;
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: PointerEvent | MouseEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      const dx = (moveEvent.clientX - startMouseX) / zoom;
      const dy = (moveEvent.clientY - startMouseY) / zoom;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        hasMoved = true;
      }

      currentX = Math.round(initialCenterX + dx);
      currentY = Math.round(initialCenterY + dy);

      if (routing === 'bezier') {
        const deltaCurv = (dx + dy) / 300;
        const nextCurv = Math.max(0.05, Math.min(0.9, initialCurvature + deltaCurv));
        setEdges((eds) =>
          eds.map((edge) =>
            edge.id === id
              ? {
                  ...edge,
                  data: {
                    ...(edge.data || {}),
                    curvature: nextCurv,
                  },
                }
              : edge
          )
        );
        setDragInfo(`Curve: ${Math.round(nextCurv * 100)}%`);
        window.dispatchEvent(
          new CustomEvent('canvas-edge-live-drag', {
            detail: { edgeId: id, curvature: nextCurv },
          })
        );
      } else {
        setEdges((eds) =>
          eds.map((edge) =>
            edge.id === id
              ? {
                  ...edge,
                  data: {
                    ...(edge.data || {}),
                    centerX: currentX,
                    centerY: currentY,
                  },
                }
              : edge
          )
        );

        const deltaX = Math.abs(currentX - initialCenterX);
        const deltaY = Math.abs(currentY - initialCenterY);
        if (deltaX > 4 && deltaY > 4) {
          setDragInfo(`↔ X: ${currentX}px, ↕ Y: ${currentY}px`);
        } else if (deltaX > 4) {
          setDragInfo(`↔ X: ${currentX}px`);
        } else {
          setDragInfo(`↕ Y: ${currentY}px`);
        }

        window.dispatchEvent(
          new CustomEvent('canvas-edge-live-drag', {
            detail: { edgeId: id, centerX: currentX, centerY: currentY },
          })
        );
      }
    };

    const handlePointerUp = (upEvent: PointerEvent | MouseEvent) => {
      upEvent.preventDefault();
      upEvent.stopPropagation();
      setIsDragging(false);
      setDragInfo(null);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;

      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
      window.removeEventListener('mousemove', handlePointerMove, true);
      window.removeEventListener('mouseup', handlePointerUp, true);

      if (hasMoved) {
        window.dispatchEvent(
          new CustomEvent('canvas-edge-bend-changed', {
            detail: {
              edgeId: id,
              centerX: currentX,
              centerY: currentY,
            },
          })
        );
      }
    };

    // Use capturing listeners so drag handlers receive events before React Flow container
    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerUp, true);
    window.addEventListener('mousemove', handlePointerMove, true);
    window.addEventListener('mouseup', handlePointerUp, true);
  };

  const handleResetLine = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === id) {
          const { centerX, centerY, offset, curvature, ...restData } = (edge.data || {}) as any;
          return {
            ...edge,
            data: restData,
          };
        }
        return edge;
      })
    );
    window.dispatchEvent(
      new CustomEvent('canvas-edge-bend-changed', {
        detail: { edgeId: id, reset: true },
      })
    );
  };

  const hasCustomBend =
    edgeData.centerX !== undefined ||
    edgeData.centerY !== undefined ||
    edgeData.curvature !== undefined;

  return (
    <>
      {/* Base Visible Flowchart Edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={effectiveMarkerEnd}
        style={edgeStyle}
        className={`custom-flowchart-base-edge ${selected ? 'is-selected' : ''} ${isTraced ? 'is-traced' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
      />

      {/* Visual Guide / Corridor Highlight when hovered, selected, or dragging */}
      {(isHovered || isDragging || selected) && !isDimmed && (
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={selected ? 5 : 4}
          strokeOpacity={isDragging ? 0.5 : selected ? 0.3 : 0.2}
          strokeLinecap="round"
          className="custom-edge-drag-guide"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Interactive Hit Path: Grabbing the line directly resizes / reshapes it */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(0, 0, 0, 0.001)"
        strokeWidth={24}
        strokeLinecap="round"
        className={`custom-edge-interactive-hit-path nodrag nopan ${isDragging ? 'is-dragging' : ''}`}
        onPointerDown={handleLinePointerDown}
        onMouseDown={handleLinePointerDown}
        onDoubleClick={handleResetLine}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          cursor: isDragging ? (resizeCursor === 'grab' ? 'grabbing' : resizeCursor) : resizeCursor,
          pointerEvents: isDimmed ? 'none' : 'stroke',
        }}
      >
        <title>Click and drag line directly to resize / reposition corridor (Double-click to reset)</title>
      </path>

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: isDimmed ? 'none' : 'all',
          }}
          className={`custom-edge-badge-container nodrag nopan ${selected ? 'is-selected' : ''} ${
            hasCustomBend ? 'is-customized-path' : ''
          } ${isCrossGroup ? 'is-cross-group' : isConditional ? 'is-conditional' : ''} ${
            isTraced ? 'is-traced' : ''
          } ${isDimmed ? 'is-dimmed' : ''}`}
        >
          {/* Live Dragging Tooltip directly above line */}
          {isDragging && dragInfo && (
            <div className="edge-resizing-tooltip nodrag nopan">
              <span>{dragInfo}</span>
            </div>
          )}

          {isCrossGroup ? (
            <div
              className={`custom-edge-pill pill-cross-group nodrag nopan ${edgeData.isError ? 'pill-error' : ''}`}
              onPointerDown={handleLinePointerDown}
              onMouseDown={handleLinePointerDown}
              title={`Cross-Group Dependency: Group ${effectiveSourceGroup ?? '?'} ➔ Group ${effectiveTargetGroup ?? '?'}`}
              style={{ cursor: resizeCursor }}
            >
              <Network size={11} className="edge-pill-icon" />
              {effectiveSourceGroup !== undefined && effectiveTargetGroup !== undefined && (
                <span className="edge-cross-group-badge">
                  G{effectiveSourceGroup}➔G{effectiveTargetGroup}
                </span>
              )}
              <span className="edge-pill-text">{conditionText || 'Cross-Group'}</span>
              {hasCustomBend && (
                <button
                  type="button"
                  className="edge-reset-bend-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetLine(e);
                  }}
                  title="Reset path to auto route (or double-click line)"
                >
                  <RotateCcw size={10} />
                </button>
              )}
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
              className={`custom-edge-pill nodrag nopan ${
                edgeData.isError ? 'pill-error' : isDecisionElse ? 'pill-else' : 'pill-condition'
              }`}
              onPointerDown={handleLinePointerDown}
              onMouseDown={handleLinePointerDown}
              title="Conditional Branch (Drag to reposition corridor)"
              style={{ cursor: resizeCursor }}
            >
              <GitBranch size={11} className="edge-pill-icon" />
              <span className="edge-pill-text">{conditionText}</span>
              {hasCustomBend && (
                <button
                  type="button"
                  className="edge-reset-bend-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetLine(e);
                  }}
                  title="Reset path to auto route (or double-click line)"
                >
                  <RotateCcw size={10} />
                </button>
              )}
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
            selected && (
              <div className="custom-edge-default-handle nodrag nopan">
                {hasCustomBend && (
                  <button
                    type="button"
                    className="edge-reset-bend-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetLine(e);
                    }}
                    title="Reset path to auto route (or double-click line)"
                  >
                    <RotateCcw size={11} />
                  </button>
                )}
                <button
                  type="button"
                  className="edge-quick-delete-btn"
                  onClick={handleDelete}
                  title="Delete Connection"
                >
                  <X size={11} />
                </button>
              </div>
            )
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
