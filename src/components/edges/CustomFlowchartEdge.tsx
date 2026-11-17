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
import { resolveNodeGroupId, isNodeInContainer, getContainerBounds } from '../../utils/flowValidator';

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
  corridorOffsetX,
  corridorOffsetY,
  offset = 20,
  bounds,
  sourceContainer,
  targetContainer,
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
  corridorOffsetX?: number;
  corridorOffsetY?: number;
  offset?: number;
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
  sourceContainer?: ContainerRect;
  targetContainer?: ContainerRect;
}): [string, number, number] {
  let defaultCenterX = (sourceX + targetX) / 2;
  let defaultCenterY = (sourceY + targetY) / 2;

  // If source and target are in different group frames, default the corridor to the open space between them
  if (sourceContainer && targetContainer && sourceContainer !== targetContainer) {
    if (sourceContainer.maxX < targetContainer.minX) {
      defaultCenterX = (sourceContainer.maxX + targetContainer.minX) / 2;
    } else if (targetContainer.maxX < sourceContainer.minX) {
      defaultCenterX = (targetContainer.maxX + sourceContainer.minX) / 2;
    }
    if (sourceContainer.maxY < targetContainer.minY) {
      defaultCenterY = (sourceContainer.maxY + targetContainer.minY) / 2;
    } else if (targetContainer.maxY < sourceContainer.minY) {
      defaultCenterY = (targetContainer.maxY + sourceContainer.minY) / 2;
    }
  }

  let cx = corridorOffsetX !== undefined ? defaultCenterX + corridorOffsetX : (centerX ?? defaultCenterX);
  let cy = corridorOffsetY !== undefined ? defaultCenterY + corridorOffsetY : (centerY ?? defaultCenterY);

  if (bounds) {
    cx = Math.max(bounds.minX, Math.min(cx, bounds.maxX));
    cy = Math.max(bounds.minY, Math.min(cy, bounds.maxY));
  }

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
      if (Math.abs(cx - defaultCenterX) > 0.5) {
        const y2 = effectiveTargetPos === Position.Top ? targetY - offset : targetY + offset;
        const y1 = Math.abs(cy - defaultCenterY) > 0.5
          ? cy
          : (effectiveSourcePos === Position.Bottom ? sourceY + offset : sourceY - offset);
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
      if (Math.abs(cy - defaultCenterY) > 0.5) {
        const x2 = effectiveTargetPos === Position.Left ? targetX - offset : targetX + offset;
        pts = [
          { x: sourceX, y: sourceY },
          { x: cx, y: sourceY },
          { x: cx, y: cy },
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

  if (bounds) {
    pts = pts.map((pt) => ({
      x: Math.max(bounds.minX, Math.min(pt.x, bounds.maxX)),
      y: Math.max(bounds.minY, Math.min(pt.y, bounds.maxY)),
    }));
    labelX = Math.max(bounds.minX, Math.min(labelX, bounds.maxX));
    labelY = Math.max(bounds.minY, Math.min(labelY, bounds.maxY));
  }

  const edgePath = buildSvgPath(pts, borderRadius);
  return [edgePath, labelX, labelY];
}

export interface ContainerRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function segmentIntersectsRect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  r?: ContainerRect,
  inset: number = 4
): boolean {
  if (!r) return false;
  const minX = r.minX + inset;
  const maxX = r.maxX - inset;
  const minY = r.minY + inset;
  const maxY = r.maxY - inset;
  if (Math.abs(p1.y - p2.y) < 0.001) {
    const y = p1.y;
    if (y <= minY || y >= maxY) return false;
    const sMinX = Math.min(p1.x, p2.x);
    const sMaxX = Math.max(p1.x, p2.x);
    return Math.max(sMinX, minX) < Math.min(sMaxX, maxX);
  } else if (Math.abs(p1.x - p2.x) < 0.001) {
    const x = p1.x;
    if (x <= minX || x >= maxX) return false;
    const sMinY = Math.min(p1.y, p2.y);
    const sMaxY = Math.max(p1.y, p2.y);
    return Math.max(sMinY, minY) < Math.min(sMaxY, maxY);
  }
  return true;
}

export function findClearOrthogonalRoute(
  exitPoint: { x: number; y: number },
  entryPoint: { x: number; y: number },
  obstacles: ContainerRect[],
  prefX?: number,
  prefY?: number,
  userShiftedX?: boolean,
  userShiftedY?: boolean,
  isHorizFlow?: boolean
): Array<{ x: number; y: number }> {
  function pathValid(pts: Array<{ x: number; y: number }>) {
    for (let i = 0; i < pts.length - 1; i++) {
      for (const obs of obstacles) {
        if (segmentIntersectsRect(pts[i], pts[i + 1], obs)) return false;
      }
    }
    return true;
  }

  const effectiveIsHoriz =
    isHorizFlow !== undefined
      ? isHorizFlow
      : Math.abs(entryPoint.x - exitPoint.x) >= Math.abs(entryPoint.y - exitPoint.y);

  const validObstacles = obstacles.filter(Boolean);
  const midX = prefX !== undefined ? prefX : (exitPoint.x + entryPoint.x) / 2;
  const midY = prefY !== undefined ? prefY : (exitPoint.y + entryPoint.y) / 2;

  if (validObstacles.length === 0) {
    if (effectiveIsHoriz) {
      return [exitPoint, { x: midX, y: exitPoint.y }, { x: midX, y: entryPoint.y }, entryPoint];
    } else {
      return [exitPoint, { x: exitPoint.x, y: midY }, { x: entryPoint.x, y: midY }, entryPoint];
    }
  }

  const allMinX = Math.min(...validObstacles.map((o) => o.minX));
  const allMaxX = Math.max(...validObstacles.map((o) => o.maxX));
  const allMinY = Math.min(...validObstacles.map((o) => o.minY));
  const allMaxY = Math.max(...validObstacles.map((o) => o.maxY));

  const xCandidates = [
    prefX,
    midX,
    allMinX - 35,
    allMaxX + 35,
    (exitPoint.x + midX) / 2,
    (midX + entryPoint.x) / 2,
  ].filter((x): x is number => x !== undefined && !isNaN(x));

  const yCandidates = [
    prefY,
    midY,
    allMinY - 35,
    allMaxY + 35,
    (exitPoint.y + midY) / 2,
    (midY + entryPoint.y) / 2,
  ].filter((y): y is number => y !== undefined && !isNaN(y));

  let p: Array<{ x: number; y: number }>;

  if (effectiveIsHoriz) {
    // -------------------------------------------------------------------------
    // HORIZONTAL FLOW (e.g. Group 1 on Left -> Group 2 on Right):
    // The corridor is vertical between Group 1 and Group 2.
    // Invariant: The connector MUST enter entryPoint HORIZONTALLY at entryPoint.y.
    // The connector MUST exit exitPoint HORIZONTALLY at exitPoint.y.
    // The vertical spine MUST be at midX (or an unobstructed corridor X).
    // NO VERTICAL SEGMENT MAY EVER BE PINNED TO entryPoint.x OR exitPoint.x!
    // -------------------------------------------------------------------------

    // 1. Direct 2-bend step whose vertical spine sits freely in the corridor at midX
    if (!userShiftedY) {
      p = [exitPoint, { x: midX, y: exitPoint.y }, { x: midX, y: entryPoint.y }, entryPoint];
      if (pathValid(p)) return p;
    }

    // 2. If user shifted Y (corridorOffsetY), or detour needed via prefY:
    // Route through prefY with transitions occurring inside the open corridor, never at entryPoint.x!
    if (prefY !== undefined) {
      const spanMin = Math.min(exitPoint.x, entryPoint.x);
      const spanMax = Math.max(exitPoint.x, entryPoint.x);
      const x1 = Math.max(spanMin + 12, Math.min(spanMax - 12, exitPoint.x + (midX - exitPoint.x) * 0.5));
      const x2 = Math.max(spanMin + 12, Math.min(spanMax - 12, midX + (entryPoint.x - midX) * 0.5));

      p = [
        exitPoint,
        { x: x1, y: exitPoint.y },
        { x: x1, y: prefY },
        { x: x2, y: prefY },
        { x: x2, y: entryPoint.y },
        entryPoint,
      ];
      if (pathValid(p)) return p;
    }

    // 3. Try unobstructed vertical spine in corridor from xCandidates
    for (const x of xCandidates) {
      if (Math.abs(x - entryPoint.x) > 4 && Math.abs(x - exitPoint.x) > 4) {
        p = [exitPoint, { x, y: exitPoint.y }, { x, y: entryPoint.y }, entryPoint];
        if (pathValid(p)) return p;
      }
    }

    // 4. Detour around obstacles via (x, y) outside obstacle bounds
    for (const y of yCandidates) {
      for (const x of xCandidates) {
        if (Math.abs(x - entryPoint.x) > 4 && Math.abs(x - exitPoint.x) > 4) {
          const stepX = (exitPoint.x + x) / 2;
          p = [
            exitPoint,
            { x: stepX, y: exitPoint.y },
            { x: stepX, y },
            { x, y },
            { x, y: entryPoint.y },
            entryPoint,
          ];
          if (pathValid(p)) return p;
        }
      }
    }

    // Fallback: clean 2-bend step in corridor
    return [exitPoint, { x: midX, y: exitPoint.y }, { x: midX, y: entryPoint.y }, entryPoint];
  } else {
    // -------------------------------------------------------------------------
    // VERTICAL FLOW (e.g. Group 1 on Top -> Group 2 on Bottom):
    // The corridor is horizontal between Group 1 and Group 2.
    // Invariant: The connector MUST enter entryPoint VERTICALLY at entryPoint.x.
    // The connector MUST exit exitPoint VERTICALLY at exitPoint.x.
    // The horizontal spine MUST be at midY (or an unobstructed corridor Y).
    // NO HORIZONTAL SEGMENT MAY EVER BE PINNED TO entryPoint.y OR exitPoint.y!
    // -------------------------------------------------------------------------

    // 1. Direct 2-bend step whose horizontal spine sits freely in the corridor at midY
    if (!userShiftedX) {
      p = [exitPoint, { x: exitPoint.x, y: midY }, { x: entryPoint.x, y: midY }, entryPoint];
      if (pathValid(p)) return p;
    }

    // 2. If user shifted X (corridorOffsetX), or detour needed via prefX:
    if (prefX !== undefined) {
      const spanMin = Math.min(exitPoint.y, entryPoint.y);
      const spanMax = Math.max(exitPoint.y, entryPoint.y);
      const y1 = Math.max(spanMin + 12, Math.min(spanMax - 12, exitPoint.y + (midY - exitPoint.y) * 0.5));
      const y2 = Math.max(spanMin + 12, Math.min(spanMax - 12, midY + (entryPoint.y - midY) * 0.5));

      p = [
        exitPoint,
        { x: exitPoint.x, y: y1 },
        { x: prefX, y: y1 },
        { x: prefX, y: y2 },
        { x: entryPoint.x, y: y2 },
        entryPoint,
      ];
      if (pathValid(p)) return p;
    }

    // 3. Try unobstructed horizontal spine in corridor from yCandidates
    for (const y of yCandidates) {
      if (Math.abs(y - entryPoint.y) > 4 && Math.abs(y - exitPoint.y) > 4) {
        p = [exitPoint, { x: exitPoint.x, y }, { x: entryPoint.x, y }, entryPoint];
        if (pathValid(p)) return p;
      }
    }

    // 4. Detour around obstacles via (x, y) outside obstacle bounds
    for (const x of xCandidates) {
      for (const y of yCandidates) {
        if (Math.abs(y - entryPoint.y) > 4 && Math.abs(y - exitPoint.y) > 4) {
          const stepY = (exitPoint.y + y) / 2;
          p = [
            exitPoint,
            { x: exitPoint.x, y: stepY },
            { x, y: stepY },
            { x, y },
            { x: entryPoint.x, y },
            entryPoint,
          ];
          if (pathValid(p)) return p;
        }
      }
    }

    // Fallback: clean 2-bend step in corridor
    return [exitPoint, { x: exitPoint.x, y: midY }, { x: entryPoint.x, y: midY }, entryPoint];
  }
}

export function getCrossGroupOrthogonalPath({
  sourceX,
  sourceY,
  sourcePosition = Position.Bottom,
  targetX,
  targetY,
  targetPosition = Position.Top,
  borderRadius = 12,
  centerX,
  centerY,
  corridorOffsetX,
  corridorOffsetY,
  offset = 24,
  sourceContainer,
  targetContainer,
  otherContainers = [],
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
  corridorOffsetX?: number;
  corridorOffsetY?: number;
  offset?: number;
  sourceContainer?: ContainerRect;
  targetContainer?: ContainerRect;
  otherContainers?: ContainerRect[];
}): [string, number, number] {
  const sc = sourceContainer;
  const tc = targetContainer;

  // Calculate available gap between containers to safely size exit/entry clearance
  // Safe clearance takes border corner rounding radius (12px) into account so curves never overlap frames
  let gapX = 60;
  let gapY = 60;
  if (sc && tc) {
    if (sc.maxX < tc.minX) gapX = tc.minX - sc.maxX;
    else if (tc.maxX < sc.minX) gapX = sc.minX - tc.maxX;
    if (sc.maxY < tc.minY) gapY = tc.minY - sc.maxY;
    else if (tc.maxY < sc.minY) gapY = sc.minY - tc.maxY;
  }
  const safeMargin = Math.min(offset, Math.max(6, Math.min(borderRadius + 2, Math.floor(Math.min(gapX, gapY) / 3))));

  // 1. Calculate clear exit point outside source container
  let exitX = sourceX;
  let exitY = sourceY;
  if (sc) {
    if (sourcePosition === Position.Right) {
      exitX = Math.max(sourceX + safeMargin, sc.maxX + safeMargin);
    } else if (sourcePosition === Position.Left) {
      exitX = Math.min(sourceX - safeMargin, sc.minX - safeMargin);
    } else if (sourcePosition === Position.Bottom) {
      exitY = Math.max(sourceY + safeMargin, sc.maxY + safeMargin);
    } else if (sourcePosition === Position.Top) {
      exitY = Math.min(sourceY - safeMargin, sc.minY - safeMargin);
    }
  }

  // 2. Calculate clear entry point outside target container
  let entryX = targetX;
  let entryY = targetY;
  if (tc) {
    if (targetPosition === Position.Top) {
      entryY = Math.min(targetY - safeMargin, tc.minY - safeMargin);
    } else if (targetPosition === Position.Bottom) {
      entryY = Math.max(targetY + safeMargin, tc.maxY + safeMargin);
    } else if (targetPosition === Position.Left) {
      entryX = Math.min(targetX - safeMargin, tc.minX - safeMargin);
    } else if (targetPosition === Position.Right) {
      entryX = Math.max(targetX + safeMargin, tc.maxX + safeMargin);
    }
  }

  const exitPoint = { x: exitX, y: exitY };
  const entryPoint = { x: entryX, y: entryY };

  // Determine preferred corridor coordinates between containers
  let defaultPrefX = (exitPoint.x + entryPoint.x) / 2;
  let defaultPrefY = (exitPoint.y + entryPoint.y) / 2;

  let corridorMinX = -Infinity;
  let corridorMaxX = Infinity;
  let corridorMinY = -Infinity;
  let corridorMaxY = Infinity;

  if (sc && tc) {
    if (sc.maxX < tc.minX) {
      corridorMinX = sc.maxX + safeMargin;
      corridorMaxX = tc.minX - safeMargin;
      defaultPrefX = (sc.maxX + tc.minX) / 2;
    } else if (tc.maxX < sc.minX) {
      corridorMinX = tc.maxX + safeMargin;
      corridorMaxX = sc.minX - safeMargin;
      defaultPrefX = (tc.maxX + sc.minX) / 2;
    }
    if (sc.maxY < tc.minY) {
      corridorMinY = sc.maxY + safeMargin;
      corridorMaxY = tc.minY - safeMargin;
      defaultPrefY = (sc.maxY + tc.minY) / 2;
    } else if (tc.maxY < sc.minY) {
      corridorMinY = tc.maxY + safeMargin;
      corridorMaxY = sc.minY - safeMargin;
      defaultPrefY = (tc.maxY + sc.minY) / 2;
    }
  }

  let prefX = corridorOffsetX !== undefined ? defaultPrefX + corridorOffsetX : (centerX ?? defaultPrefX);
  let prefY = corridorOffsetY !== undefined ? defaultPrefY + corridorOffsetY : (centerY ?? defaultPrefY);

  // Clamping within corridor bounds when inside vertical/horizontal spans to avoid group border overlap
  if (sc && tc && (sc.maxX < tc.minX || tc.maxX < sc.minX)) {
    const isOutsideY =
      prefY < Math.min(sc.minY, tc.minY) - 10 ||
      prefY > Math.max(sc.maxY, tc.maxY) + 10;
    if (!isOutsideY && corridorMinX <= corridorMaxX) {
      const minGroupX = Math.min(sc.minX, tc.minX);
      const maxGroupX = Math.max(sc.maxX, tc.maxX);
      if (prefX >= minGroupX && prefX <= maxGroupX) {
        prefX = Math.max(corridorMinX, Math.min(prefX, corridorMaxX));
      }
    }
  }

  if (sc && tc && (sc.maxY < tc.minY || tc.maxY < sc.minY)) {
    const isOutsideX =
      prefX < Math.min(sc.minX, tc.minX) - 10 ||
      prefX > Math.max(sc.maxX, tc.maxX) + 10;
    if (!isOutsideX && corridorMinY <= corridorMaxY) {
      const minGroupY = Math.min(sc.minY, tc.minY);
      const maxGroupY = Math.max(sc.maxY, tc.maxY);
      if (prefY >= minGroupY && prefY <= maxGroupY) {
        prefY = Math.max(corridorMinY, Math.min(prefY, corridorMaxY));
      }
    }
  }

  const isSideBySide = Boolean(sc && tc && (sc.maxX <= tc.minX || tc.maxX <= sc.minX));
  const isStacked = Boolean(sc && tc && (sc.maxY <= tc.minY || tc.maxY <= sc.minY));
  const isHorizontalHandles =
    sourcePosition === Position.Right ||
    sourcePosition === Position.Left ||
    targetPosition === Position.Right ||
    targetPosition === Position.Left;
  const isVerticalHandles =
    (sourcePosition === Position.Bottom || sourcePosition === Position.Top) &&
    (targetPosition === Position.Top || targetPosition === Position.Bottom);

  let isHorizFlow = true;
  if (isSideBySide) {
    isHorizFlow = true;
  } else if (isStacked) {
    isHorizFlow = false;
  } else if (isHorizontalHandles) {
    isHorizFlow = true;
  } else if (isVerticalHandles) {
    isHorizFlow = false;
  } else {
    isHorizFlow = Math.abs(entryPoint.x - exitPoint.x) >= Math.abs(entryPoint.y - exitPoint.y);
  }

  const userShiftedX =
    (corridorOffsetX !== undefined && Math.abs(corridorOffsetX) > 0.5) ||
    (centerX !== undefined && Math.abs(centerX - defaultPrefX) > 0.5);
  const userShiftedY =
    (corridorOffsetY !== undefined && Math.abs(corridorOffsetY) > 0.5) ||
    (centerY !== undefined && Math.abs(centerY - defaultPrefY) > 0.5);

  const obstacles = [sc, tc, ...otherContainers].filter(Boolean) as ContainerRect[];
  const middlePts = findClearOrthogonalRoute(
    exitPoint,
    entryPoint,
    obstacles,
    prefX,
    prefY,
    userShiftedX,
    userShiftedY,
    isHorizFlow
  );

  const rawPts: Array<{ x: number; y: number }> = [
    { x: sourceX, y: sourceY },
    ...middlePts,
    { x: targetX, y: targetY },
  ];

  const simplified = simplifyPoints(rawPts);

  // Label position directly follows user-dragged corridor coordinates (centerX, centerY)
  // or defaults to the center of the inter-group corridor, NEVER inside the source/target container!
  const labelX = prefX;
  const labelY = prefY;

  const edgePath = buildSvgPath(simplified, borderRadius);
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
  labelOffsetX?: number;
  labelOffsetY?: number;
  corridorOffsetX?: number;
  corridorOffsetY?: number;
  _groupTransformTick?: number;
  offset?: number;
  curvature?: number;
  targetEntrySide?: 'auto' | 'left' | 'top' | 'right' | 'bottom';
}

/**
 * Converts screen/pointer coordinates into canvas world coordinates consistently
 * applying (screenPos - pan) / zoom.
 */
export function screenToWorldCoord(
  screenPos: { x: number; y: number },
  pan: { x: number; y: number } = { x: 0, y: 0 },
  zoom: number = 1
): { x: number; y: number } {
  const effectiveZoom = zoom > 0 ? zoom : 1;
  return {
    x: (screenPos.x - pan.x) / effectiveZoom,
    y: (screenPos.y - pan.y) / effectiveZoom,
  };
}

/**
 * Computes derived midpoint in world coordinates between source port and target port.
 * If offset is provided, computes midpoint + offset.
 */
export function computeDerivedEdgeMidpoint(
  sourcePort: { x: number; y: number },
  targetPort: { x: number; y: number },
  offset?: { x?: number; y?: number }
): { x: number; y: number } {
  const midX = (sourcePort.x + targetPort.x) / 2;
  const midY = (sourcePort.y + targetPort.y) / 2;
  return {
    x: midX + (offset?.x ?? 0),
    y: midY + (offset?.y ?? 0),
  };
}

/**
 * Computes derived pill position for cross-group connectors in world coordinates,
 * ensuring the pill sits in the clear corridor between source and target containers
 * and strictly prevents overlapping container borders, member nodes, or peer pills.
 */
export function computeDerivedCrossGroupPillPosition({
  sourceX,
  sourceY,
  targetX,
  targetY,
  corridorX,
  corridorY,
  sourceContainer,
  targetContainer,
  otherContainers = [],
  offset,
  pillWidth = 170,
  pillHeight = 32,
  pad = 10,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  corridorX?: number;
  corridorY?: number;
  sourceContainer?: ContainerRect;
  targetContainer?: ContainerRect;
  otherContainers?: ContainerRect[];
  offset?: { x?: number; y?: number };
  pillWidth?: number;
  pillHeight?: number;
  pad?: number;
}): { x: number; y: number } {
  const sc = sourceContainer;
  const tc = targetContainer;
  const halfW = pillWidth / 2;
  const halfH = pillHeight / 2;

  let baseX = corridorX !== undefined ? corridorX : (sourceX + targetX) / 2;
  let baseY = corridorY !== undefined ? corridorY : (sourceY + targetY) / 2;

  if (sc && tc) {
    // 1. Side-by-side containers: Source is to the Left, Target is to the Right
    if (sc.maxX <= tc.minX) {
      const gapX = tc.minX - sc.maxX;
      const minSafeX = sc.maxX + halfW + pad;
      const maxSafeX = tc.minX - halfW - pad;

      if (gapX >= 2 * halfW + 2 * pad) {
        // Sufficient corridor width: safely clamp horizontally between the two group borders
        const prefX = corridorX !== undefined ? corridorX : (sc.maxX + tc.minX) / 2;
        baseX = Math.max(minSafeX, Math.min(prefX, maxSafeX));
        baseY = corridorY !== undefined ? corridorY : (sourceY + targetY) / 2;
      } else {
        // Narrow corridor: centering horizontally inside the gap will overlap the group borders.
        // Shift vertically into open canvas above or below the group containers.
        baseX = (sc.maxX + tc.minX) / 2;
        const midContainersY = (Math.min(sc.minY, tc.minY) + Math.max(sc.maxY, tc.maxY)) / 2;
        const prefY = corridorY !== undefined ? corridorY : (sourceY + targetY) / 2;
        if (prefY <= midContainersY) {
          baseY = Math.min(sc.minY, tc.minY) - halfH - pad;
        } else {
          baseY = Math.max(sc.maxY, tc.maxY) + halfH + pad;
        }
      }
    }
    // 2. Reverse Side-by-side containers: Target is to the Left, Source is to the Right
    else if (tc.maxX <= sc.minX) {
      const gapX = sc.minX - tc.maxX;
      const minSafeX = tc.maxX + halfW + pad;
      const maxSafeX = sc.minX - halfW - pad;

      if (gapX >= 2 * halfW + 2 * pad) {
        const prefX = corridorX !== undefined ? corridorX : (tc.maxX + sc.minX) / 2;
        baseX = Math.max(minSafeX, Math.min(prefX, maxSafeX));
        baseY = corridorY !== undefined ? corridorY : (sourceY + targetY) / 2;
      } else {
        baseX = (tc.maxX + sc.minX) / 2;
        const midContainersY = (Math.min(sc.minY, tc.minY) + Math.max(sc.maxY, tc.maxY)) / 2;
        const prefY = corridorY !== undefined ? corridorY : (sourceY + targetY) / 2;
        if (prefY <= midContainersY) {
          baseY = Math.min(sc.minY, tc.minY) - halfH - pad;
        } else {
          baseY = Math.max(sc.maxY, tc.maxY) + halfH + pad;
        }
      }
    }
    // 3. Stacked containers: Source on Top, Target on Bottom
    else if (sc.maxY <= tc.minY) {
      const gapY = tc.minY - sc.maxY;
      const minSafeY = sc.maxY + halfH + pad;
      const maxSafeY = tc.minY - halfH - pad;

      if (gapY >= 2 * halfH + 2 * pad) {
        const prefY = corridorY !== undefined ? corridorY : (sc.maxY + tc.minY) / 2;
        baseY = Math.max(minSafeY, Math.min(prefY, maxSafeY));
        baseX = corridorX !== undefined ? corridorX : (sourceX + targetX) / 2;
      } else {
        baseY = (sc.maxY + tc.minY) / 2;
        const midContainersX = (Math.min(sc.minX, tc.minX) + Math.max(sc.maxX, tc.maxX)) / 2;
        const prefX = corridorX !== undefined ? corridorX : (sourceX + targetX) / 2;
        if (prefX <= midContainersX) {
          baseX = Math.min(sc.minX, tc.minX) - halfW - pad;
        } else {
          baseX = Math.max(sc.maxX, tc.maxX) + halfW + pad;
        }
      }
    }
    // 4. Reverse Stacked containers: Target on Top, Source on Bottom
    else if (tc.maxY <= sc.minY) {
      const gapY = sc.minY - tc.maxY;
      const minSafeY = tc.maxY + halfH + pad;
      const maxSafeY = sc.minY - halfH - pad;

      if (gapY >= 2 * halfH + 2 * pad) {
        const prefY = corridorY !== undefined ? corridorY : (tc.maxY + sc.minY) / 2;
        baseY = Math.max(minSafeY, Math.min(prefY, maxSafeY));
        baseX = corridorX !== undefined ? corridorX : (sourceX + targetX) / 2;
      } else {
        baseY = (tc.maxY + sc.minY) / 2;
        const midContainersX = (Math.min(sc.minX, tc.minX) + Math.max(sc.maxX, tc.maxX)) / 2;
        const prefX = corridorX !== undefined ? corridorX : (sourceX + targetX) / 2;
        if (prefX <= midContainersX) {
          baseX = Math.min(sc.minX, tc.minX) - halfW - pad;
        } else {
          baseX = Math.max(sc.maxX, tc.maxX) + halfW + pad;
        }
      }
    }
  }

  // Apply manual drag offsets
  let finalX = baseX + (offset?.x ?? 0);
  let finalY = baseY + (offset?.y ?? 0);

  // Clamp again against source and target container boundaries
  if (sc && tc) {
    if (sc.maxX <= tc.minX) {
      const minSafeX = sc.maxX + halfW + pad;
      const maxSafeX = tc.minX - halfW - pad;
      if (minSafeX <= maxSafeX) {
        finalX = Math.max(minSafeX, Math.min(finalX, maxSafeX));
      }
    } else if (tc.maxX <= sc.minX) {
      const minSafeX = tc.maxX + halfW + pad;
      const maxSafeX = sc.minX - halfW - pad;
      if (minSafeX <= maxSafeX) {
        finalX = Math.max(minSafeX, Math.min(finalX, maxSafeX));
      }
    }

    if (sc.maxY <= tc.minY) {
      const minSafeY = sc.maxY + halfH + pad;
      const maxSafeY = tc.minY - halfH - pad;
      if (minSafeY <= maxSafeY) {
        finalY = Math.max(minSafeY, Math.min(finalY, maxSafeY));
      }
    } else if (tc.maxY <= sc.minY) {
      const minSafeY = tc.maxY + halfH + pad;
      const maxSafeY = sc.minY - halfH - pad;
      if (minSafeY <= maxSafeY) {
        finalY = Math.max(minSafeY, Math.min(finalY, maxSafeY));
      }
    }
  }

  // Strict multi-obstacle collision resolution against ALL containers
  const allObstacles = [sc, tc, ...otherContainers].filter(Boolean) as ContainerRect[];
  for (let iter = 0; iter < 4; iter++) {
    let resolvedAny = false;
    for (const obs of allObstacles) {
      const overlapsX = finalX + halfW + pad > obs.minX && finalX - halfW - pad < obs.maxX;
      const overlapsY = finalY + halfH + pad > obs.minY && finalY - halfH - pad < obs.maxY;

      if (overlapsX && overlapsY) {
        resolvedAny = true;
        const pushLeft = (finalX + halfW + pad) - obs.minX;
        const pushRight = obs.maxX - (finalX - halfW - pad);
        const pushUp = (finalY + halfH + pad) - obs.minY;
        const pushDown = obs.maxY - (finalY - halfH - pad);

        const minPush = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (minPush === pushUp) {
          finalY = obs.minY - halfH - pad;
        } else if (minPush === pushDown) {
          finalY = obs.maxY + halfH + pad;
        } else if (minPush === pushLeft) {
          finalX = obs.minX - halfW - pad;
        } else {
          finalX = obs.maxX + halfW + pad;
        }
      }
    }
    if (!resolvedAny) break;
  }

  return { x: finalX, y: finalY };
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
  const { setEdges, getNode, getNodes, getEdges, getZoom, getViewport, screenToFlowPosition } = useReactFlow();
  const edgeData = (data as CustomEdgeData) || {};

  // Dynamically resolve source and target node groups to ensure 100% accurate live cross-group detection
  const allNodes = getNodes();
  const sourceNode = source ? getNode(source) : undefined;
  const targetNode = target ? getNode(target) : undefined;

  const dynamicSourceGroup = sourceNode ? resolveNodeGroupId(sourceNode, allNodes) : edgeData.sourceGroup;
  const dynamicTargetGroup = targetNode ? resolveNodeGroupId(targetNode, allNodes) : edgeData.targetGroup;

  const isDifferentGroup = Boolean(
    sourceNode &&
    targetNode &&
    dynamicSourceGroup !== dynamicTargetGroup
  );

  const isCrossGroup =
    Boolean(edgeData.isCrossGroup && isDifferentGroup) ||
    isDifferentGroup;

  const effectiveSourceGroup = dynamicSourceGroup ?? edgeData.sourceGroup;
  const effectiveTargetGroup = dynamicTargetGroup ?? edgeData.targetGroup;

  // Group container resolution for intra-group containment and cross-group non-overlapping routing
  const containers = React.useMemo(() => {
    return allNodes.filter(
      (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
    );
  }, [allNodes]);

  const sourceContainerNode = React.useMemo(() => {
    if (!sourceNode) return undefined;
    if (sourceNode.type === 'groupFrame' || sourceNode.type === 'groupContainer') return sourceNode;
    return containers.find(
      (c) =>
        c.id === (sourceNode.data as any)?.containerId ||
        (sourceNode.data as any)?.group === (c.data as any)?.numericGroupId ||
        isNodeInContainer(sourceNode, c, allNodes)
    );
  }, [sourceNode, containers, allNodes]);

  const targetContainerNode = React.useMemo(() => {
    if (!targetNode) return undefined;
    if (targetNode.type === 'groupFrame' || targetNode.type === 'groupContainer') return targetNode;
    return containers.find(
      (c) =>
        c.id === (targetNode.data as any)?.containerId ||
        (targetNode.data as any)?.group === (c.data as any)?.numericGroupId ||
        isNodeInContainer(targetNode, c, allNodes)
    );
  }, [targetNode, containers, allNodes]);

  // React to canvas-update-edges events for all child ports
  const [, forceEdgeUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    const handleUpdateEdges = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (
        detail &&
        (detail.groupId === sourceContainerNode?.id ||
          detail.groupId === targetContainerNode?.id ||
          detail.childIds?.includes(source) ||
          detail.childIds?.includes(target))
      ) {
        forceEdgeUpdate();
      }
    };
    window.addEventListener('canvas-update-edges', handleUpdateEdges);
    return () => window.removeEventListener('canvas-update-edges', handleUpdateEdges);
  }, [source, target, sourceContainerNode?.id, targetContainerNode?.id]);

  const isCrossGroupConnection = Boolean(
    isCrossGroup ||
    (sourceContainerNode && targetContainerNode && sourceContainerNode.id !== targetContainerNode.id) ||
    (sourceContainerNode && !targetContainerNode && targetNode && targetNode.type !== 'groupFrame') ||
    (!sourceContainerNode && targetContainerNode && sourceNode && sourceNode.type !== 'groupFrame')
  );

  // Intra-group boundary containment: intra-group connectors must stay strictly inside group border
  const intraGroupBounds = React.useMemo(() => {
    if (!sourceNode || !targetNode) return undefined;
    if (isCrossGroupConnection) return undefined;
    const container = sourceContainerNode || targetContainerNode;
    if (!container) return undefined;

    const { fX, fY, fW, fH } = getContainerBounds(container);

    return {
      minX: fX + 12,
      maxX: fX + fW - 12,
      minY: fY + 44,
      maxY: fY + fH - 12,
    };
  }, [
    sourceNode,
    targetNode,
    isCrossGroupConnection,
    sourceContainerNode,
    targetContainerNode,
    sourceContainerNode?.position.x,
    sourceContainerNode?.position.y,
    targetContainerNode?.position.x,
    targetContainerNode?.position.y,
    edgeData._groupTransformTick,
  ]);

  // Cross-group container boundaries: ensures cross-group connectors NEVER overlap group frames
  const crossGroupContainers = React.useMemo(() => {
    if (!isCrossGroupConnection) return undefined;

    const sBounds = sourceContainerNode ? getContainerBounds(sourceContainerNode) : undefined;
    const tBounds = targetContainerNode ? getContainerBounds(targetContainerNode) : undefined;

    return {
      sourceContainer: sBounds
        ? {
          minX: sBounds.fX,
          maxX: sBounds.fX + sBounds.fW,
          minY: sBounds.fY,
          maxY: sBounds.fY + sBounds.fH,
        }
        : undefined,
      targetContainer: tBounds
        ? {
          minX: tBounds.fX,
          maxX: tBounds.fX + tBounds.fW,
          minY: tBounds.fY,
          maxY: tBounds.fY + tBounds.fH,
        }
        : undefined,
      otherContainers: containers
        .filter((c) => c.id !== sourceContainerNode?.id && c.id !== targetContainerNode?.id)
        .map((c) => {
          const b = getContainerBounds(c);
          return {
            minX: b.fX,
            maxX: b.fX + b.fW,
            minY: b.fY,
            maxY: b.fY + b.fH,
          };
        }),
    };
  }, [
    isCrossGroupConnection,
    sourceContainerNode,
    targetContainerNode,
    containers,
    sourceContainerNode?.position.x,
    sourceContainerNode?.position.y,
    targetContainerNode?.position.x,
    targetContainerNode?.position.y,
    edgeData._groupTransformTick,
  ]);

  // Flexible target port resolution for cross-group question connectors
  const edgeTargetHandle = (edgeData as any).targetHandle;
  let effectiveTargetPos = targetPosition;
  let effectiveTargetX = targetX;
  let effectiveTargetY = targetY;

  if (isCrossGroupConnection && targetNode) {
    const explicitEntry = edgeData.targetEntrySide;
    const isAutoOrDef = !explicitEntry || explicitEntry === 'auto';

    let resolvedSide: 'left' | 'right' | 'top' | 'bottom' | null = null;
    if (explicitEntry && explicitEntry !== 'auto') {
      resolvedSide = explicitEntry;
    } else if (edgeTargetHandle === 'in-left') {
      resolvedSide = 'left';
    } else if (edgeTargetHandle === 'in-right') {
      resolvedSide = 'right';
    } else if (edgeTargetHandle === 'in-bottom') {
      resolvedSide = 'bottom';
    } else if (edgeTargetHandle === 'in' || edgeTargetHandle === 'in-top') {
      resolvedSide = 'top';
    } else if (edgeTargetHandle === 'in-tl' || edgeTargetHandle === 'in-tr') {
      effectiveTargetPos = Position.Top;
    } else if (edgeTargetHandle === 'in-bl' || edgeTargetHandle === 'in-br') {
      effectiveTargetPos = Position.Bottom;
    } else if (isAutoOrDef && !edgeTargetHandle) {
      // Natural flexible alignment based on source and target container positions when no handle is targeted
      if (sourceContainerNode && targetContainerNode && sourceContainerNode.id !== targetContainerNode.id) {
        const sB = getContainerBounds(sourceContainerNode);
        const tB = getContainerBounds(targetContainerNode);
        if (sB.fX + sB.fW <= tB.fX + 80) {
          resolvedSide = 'left';
        } else if (sB.fX >= tB.fX + tB.fW - 80) {
          resolvedSide = 'right';
        } else if (sB.fY + sB.fH <= tB.fY + 80) {
          resolvedSide = 'top';
        } else if (sB.fY >= tB.fY + tB.fH - 80) {
          resolvedSide = 'bottom';
        }
      } else if (sourceNode) {
        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;
        if (Math.abs(dx) >= Math.abs(dy)) {
          resolvedSide = dx > 0 ? 'left' : 'right';
        } else {
          resolvedSide = dy > 0 ? 'top' : 'bottom';
        }
      }
    }

    if (resolvedSide) {
      const nodeWidth = (targetNode.measured?.width as number) || (targetNode.width as number) || 260;
      const nodeHeight = (targetNode.measured?.height as number) || (targetNode.height as number) || 120;
      const topCenterX = targetPosition === Position.Top ? targetX : targetNode.position.x + nodeWidth / 2;
      const topCenterY = targetPosition === Position.Top ? targetY : targetNode.position.y;

      if (resolvedSide === 'left') {
        effectiveTargetPos = Position.Left;
        effectiveTargetX = topCenterX - nodeWidth / 2;
        effectiveTargetY = topCenterY + nodeHeight / 2;
      } else if (resolvedSide === 'right') {
        effectiveTargetPos = Position.Right;
        effectiveTargetX = topCenterX + nodeWidth / 2;
        effectiveTargetY = topCenterY + nodeHeight / 2;
      } else if (resolvedSide === 'bottom') {
        effectiveTargetPos = Position.Bottom;
        effectiveTargetX = topCenterX;
        effectiveTargetY = topCenterY + nodeHeight;
      } else if (resolvedSide === 'top') {
        effectiveTargetPos = Position.Top;
        effectiveTargetX = topCenterX;
        effectiveTargetY = topCenterY;
      }
    }
  }

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
      targetX: effectiveTargetX,
      targetY: effectiveTargetY,
      targetPosition: effectiveTargetPos,
      curvature: edgeData.curvature ?? 0.25,
    });
  } else if (routing === 'straight') {
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX: effectiveTargetX,
      targetY: effectiveTargetY,
    });
  } else if (
    isCrossGroupConnection &&
    (crossGroupContainers?.sourceContainer || crossGroupContainers?.targetContainer)
  ) {
    // Cross-group question connector: stays strictly outside group bodies without overlapping,
    // AND dynamically recomputes corridor from live containers or respects relative offsets / centerX
    [edgePath, labelX, labelY] = getCrossGroupOrthogonalPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX: effectiveTargetX,
      targetY: effectiveTargetY,
      targetPosition: effectiveTargetPos,
      borderRadius: 12,
      centerX: edgeData.centerX,
      centerY: edgeData.centerY,
      corridorOffsetX: edgeData.corridorOffsetX,
      corridorOffsetY: edgeData.corridorOffsetY,
      offset: edgeData.offset ?? 24,
      sourceContainer: crossGroupContainers.sourceContainer,
      targetContainer: crossGroupContainers.targetContainer,
      otherContainers: crossGroupContainers.otherContainers,
    });
  } else {
    // Default or user-dragged corridor: smoothstep with dynamic corridor recomputation and relative offsets
    [edgePath, labelX, labelY] = getOrthogonalPathWithDetour({
      sourceX,
      sourceY,
      sourcePosition,
      targetX: effectiveTargetX,
      targetY: effectiveTargetY,
      targetPosition: effectiveTargetPos,
      borderRadius: 12,
      centerX: edgeData.centerX,
      centerY: edgeData.centerY,
      corridorOffsetX: edgeData.corridorOffsetX,
      corridorOffsetY: edgeData.corridorOffsetY,
      offset: edgeData.offset,
      bounds: intraGroupBounds,
      sourceContainer: crossGroupContainers?.sourceContainer,
      targetContainer: crossGroupContainers?.targetContainer,
    });
  }

  // Derive pill's position in world coordinates on every frame:
  // For cross-group connectors: must sit in the clear corridor between containers,
  // strictly outside source and target group bodies so it NEVER overlaps containers or nodes!
  // For intra-group edges: derived midpoint between source and target ports clamped within group bounds.
  const derivedMidX = (sourceX + effectiveTargetX) / 2;
  const derivedMidY = (sourceY + effectiveTargetY) / 2;

  let pillX = derivedMidX;
  let pillY = derivedMidY;

  if (isCrossGroupConnection && (crossGroupContainers?.sourceContainer || crossGroupContainers?.targetContainer)) {
    const crossGroupPos = computeDerivedCrossGroupPillPosition({
      sourceX,
      sourceY,
      targetX: effectiveTargetX,
      targetY: effectiveTargetY,
      corridorX: labelX,
      corridorY: labelY,
      sourceContainer: crossGroupContainers?.sourceContainer,
      targetContainer: crossGroupContainers?.targetContainer,
      otherContainers: crossGroupContainers?.otherContainers,
      offset: {
        x: edgeData.labelOffsetX,
        y: edgeData.labelOffsetY,
      },
    });
    pillX = crossGroupPos.x;
    pillY = crossGroupPos.y;
  } else {
    pillX = edgeData.labelOffsetX !== undefined ? derivedMidX + edgeData.labelOffsetX : derivedMidX;
    pillY = edgeData.labelOffsetY !== undefined ? derivedMidY + edgeData.labelOffsetY : derivedMidY;
    if (intraGroupBounds) {
      pillX = Math.max(intraGroupBounds.minX, Math.min(pillX, intraGroupBounds.maxX));
      pillY = Math.max(intraGroupBounds.minY, Math.min(pillY, intraGroupBounds.maxY));
    }
  }

  // Anti-collision staggering for peer cross-group pills
  const allEdges = getEdges ? getEdges() : [];
  const peerCrossGroupEdges = React.useMemo(() => {
    if (!isCrossGroupConnection || !effectiveSourceGroup || !effectiveTargetGroup) return [];
    return allEdges.filter((e) => {
      if (e.id === id) return false;
      const eData = (e.data as CustomEdgeData) || {};
      const sGroup = eData.sourceGroup;
      const tGroup = eData.targetGroup;
      return (
        (sGroup === effectiveSourceGroup && tGroup === effectiveTargetGroup) ||
        (sGroup === effectiveTargetGroup && tGroup === effectiveSourceGroup)
      );
    });
  }, [allEdges, id, isCrossGroupConnection, effectiveSourceGroup, effectiveTargetGroup]);

  if (isCrossGroupConnection && peerCrossGroupEdges.length > 0 && edgeData.labelOffsetY === undefined) {
    const peerIds = [id, ...peerCrossGroupEdges.map((e) => e.id)].sort();
    const peerIndex = peerIds.indexOf(id);
    if (peerIndex > 0) {
      const staggerY = (peerIndex % 2 === 1 ? 1 : -1) * Math.ceil(peerIndex / 2) * 36;
      if (crossGroupContainers?.sourceContainer || crossGroupContainers?.targetContainer) {
        const staggeredPos = computeDerivedCrossGroupPillPosition({
          sourceX,
          sourceY,
          targetX: effectiveTargetX,
          targetY: effectiveTargetY,
          corridorX: pillX,
          corridorY: pillY + staggerY,
          sourceContainer: crossGroupContainers?.sourceContainer,
          targetContainer: crossGroupContainers?.targetContainer,
          otherContainers: crossGroupContainers?.otherContainers,
        });
        pillX = staggeredPos.x;
        pillY = staggeredPos.y;
      } else {
        pillY += staggerY;
      }
    }
  }

  // Handle label display
  let conditionText = '';
  const isOptionHandle = Boolean(sourceHandleId && sourceHandleId.startsWith('opt-'));

  if (label && typeof label === 'string' && label.trim().length > 0) {
    conditionText = isCrossGroup ? label : label.replace(/^\[G\d+➔G\d+\]\s*/, '');
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

  let displayCrossGroupText = conditionText || 'Cross-Group';
  if (isCrossGroup) {
    displayCrossGroupText = displayCrossGroupText
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^Cross-Group\s*:\s*.*$/i, 'Cross-Group')
      .trim();
    if (!displayCrossGroupText || displayCrossGroupText === 'Cross-Group') {
      displayCrossGroupText = 'Cross-Group';
    }
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

    const zoom = getZoom ? getZoom() : 1;
    const viewport = getViewport ? getViewport() : { x: 0, y: 0, zoom };
    const toWorld = (clientX: number, clientY: number) => {
      if (screenToFlowPosition) {
        try {
          return screenToFlowPosition({ x: clientX, y: clientY });
        } catch {
          // fallback to manual world transform
        }
      }
      return screenToWorldCoord({ x: clientX, y: clientY }, { x: viewport.x, y: viewport.y }, viewport.zoom);
    };

    const startWorld = toWorld(e.clientX, e.clientY);

    const basePill = isCrossGroupConnection && (crossGroupContainers?.sourceContainer || crossGroupContainers?.targetContainer)
      ? computeDerivedCrossGroupPillPosition({
        sourceX,
        sourceY,
        targetX: effectiveTargetX,
        targetY: effectiveTargetY,
        corridorX: labelX,
        corridorY: labelY,
        sourceContainer: crossGroupContainers?.sourceContainer,
        targetContainer: crossGroupContainers?.targetContainer,
        otherContainers: crossGroupContainers?.otherContainers,
      })
      : { x: derivedMidX, y: derivedMidY };

    // Initial offsets relative to derived midpoints / dynamic corridors
    const initialLabelOffsetX = edgeData.labelOffsetX ?? (edgeData.centerX !== undefined ? edgeData.centerX - basePill.x : 0);
    const initialLabelOffsetY = edgeData.labelOffsetY ?? (edgeData.centerY !== undefined ? edgeData.centerY - basePill.y : 0);
    const initialCorridorOffsetX = edgeData.corridorOffsetX ?? (edgeData.centerX !== undefined ? edgeData.centerX - labelX : 0);
    const initialCorridorOffsetY = edgeData.corridorOffsetY ?? (edgeData.centerY !== undefined ? edgeData.centerY - labelY : 0);
    const initialCurvature = edgeData.curvature ?? 0.25;

    let currentLabelOffsetX = initialLabelOffsetX;
    let currentLabelOffsetY = initialLabelOffsetY;
    let currentCorridorOffsetX = initialCorridorOffsetX;
    let currentCorridorOffsetY = initialCorridorOffsetY;
    let currentWorldX = startWorld.x;
    let currentWorldY = startWorld.y;
    let hasMoved = false;

    setIsDragging(true);

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = resizeCursor;
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: PointerEvent | MouseEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();

      const currentWorldPos = toWorld(moveEvent.clientX, moveEvent.clientY);
      const dx = currentWorldPos.x - startWorld.x;
      const dy = currentWorldPos.y - startWorld.y;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        hasMoved = true;
      }

      currentLabelOffsetX = Math.round(initialLabelOffsetX + dx);
      currentLabelOffsetY = Math.round(initialLabelOffsetY + dy);
      currentCorridorOffsetX = Math.round(initialCorridorOffsetX + dx);
      currentCorridorOffsetY = Math.round(initialCorridorOffsetY + dy);

      let targetPillX = basePill.x + currentLabelOffsetX;
      let targetPillY = basePill.y + currentLabelOffsetY;

      if (intraGroupBounds) {
        targetPillX = Math.max(intraGroupBounds.minX, Math.min(targetPillX, intraGroupBounds.maxX));
        targetPillY = Math.max(intraGroupBounds.minY, Math.min(targetPillY, intraGroupBounds.maxY));
        currentLabelOffsetX = targetPillX - basePill.x;
        currentLabelOffsetY = targetPillY - basePill.y;
      } else if (isCrossGroupConnection && (crossGroupContainers?.sourceContainer || crossGroupContainers?.targetContainer)) {
        const clamped = computeDerivedCrossGroupPillPosition({
          sourceX,
          sourceY,
          targetX: effectiveTargetX,
          targetY: effectiveTargetY,
          corridorX: labelX,
          corridorY: labelY,
          sourceContainer: crossGroupContainers?.sourceContainer,
          targetContainer: crossGroupContainers?.targetContainer,
          otherContainers: crossGroupContainers?.otherContainers,
          offset: { x: currentLabelOffsetX, y: currentLabelOffsetY },
        });
        targetPillX = clamped.x;
        targetPillY = clamped.y;
        currentLabelOffsetX = targetPillX - basePill.x;
        currentLabelOffsetY = targetPillY - basePill.y;
      }

      currentWorldX = targetPillX;
      currentWorldY = targetPillY;

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
                  labelOffsetX: currentLabelOffsetX,
                  labelOffsetY: currentLabelOffsetY,
                  corridorOffsetX: currentCorridorOffsetX,
                  corridorOffsetY: currentCorridorOffsetY,
                  // Do not cache absolute points
                  centerX: undefined,
                  centerY: undefined,
                },
              }
              : edge
          )
        );

        const deltaX = Math.abs(dx);
        const deltaY = Math.abs(dy);
        if (deltaX > 4 && deltaY > 4) {
          setDragInfo(`↔ ΔX: ${currentLabelOffsetX > 0 ? '+' : ''}${currentLabelOffsetX}px, ↕ ΔY: ${currentLabelOffsetY > 0 ? '+' : ''}${currentLabelOffsetY}px`);
        } else if (deltaX > 4) {
          setDragInfo(`↔ ΔX: ${currentLabelOffsetX > 0 ? '+' : ''}${currentLabelOffsetX}px`);
        } else {
          setDragInfo(`↕ ΔY: ${currentLabelOffsetY > 0 ? '+' : ''}${currentLabelOffsetY}px`);
        }

        window.dispatchEvent(
          new CustomEvent('canvas-edge-live-drag', {
            detail: {
              edgeId: id,
              labelOffsetX: currentLabelOffsetX,
              labelOffsetY: currentLabelOffsetY,
              corridorOffsetX: currentCorridorOffsetX,
              corridorOffsetY: currentCorridorOffsetY,
              centerX: currentWorldX,
              centerY: currentWorldY,
            },
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
              labelOffsetX: currentLabelOffsetX,
              labelOffsetY: currentLabelOffsetY,
              corridorOffsetX: currentCorridorOffsetX,
              corridorOffsetY: currentCorridorOffsetY,
              centerX: currentWorldX,
              centerY: currentWorldY,
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
          const {
            centerX,
            centerY,
            labelOffsetX,
            labelOffsetY,
            corridorOffsetX,
            corridorOffsetY,
            offset,
            curvature,
            ...restData
          } = (edge.data || {}) as any;
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
    edgeData.labelOffsetX !== undefined ||
    edgeData.labelOffsetY !== undefined ||
    edgeData.corridorOffsetX !== undefined ||
    edgeData.corridorOffsetY !== undefined ||
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
            transform: `translate(-50%, -50%) translate(${pillX}px,${pillY}px)`,
            pointerEvents: isDimmed ? 'none' : 'all',
          }}
          className={`custom-edge-badge-container nodrag nopan ${selected ? 'is-selected' : ''} ${hasCustomBend ? 'is-customized-path' : ''
            } ${isCrossGroup ? 'is-cross-group' : isConditional ? 'is-conditional' : ''} ${isTraced ? 'is-traced' : ''
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
              <span className="edge-pill-text">{displayCrossGroupText}</span>
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
              className={`custom-edge-pill nodrag nopan ${edgeData.isError ? 'pill-error' : isDecisionElse ? 'pill-else' : 'pill-condition'
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
