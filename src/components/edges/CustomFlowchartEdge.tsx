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

  let cx = centerX ?? defaultCenterX;
  let cy = centerY ?? defaultCenterY;

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
  userShiftedY?: boolean
): Array<{ x: number; y: number }> {
  function pathValid(pts: Array<{ x: number; y: number }>) {
    for (let i = 0; i < pts.length - 1; i++) {
      for (const obs of obstacles) {
        if (segmentIntersectsRect(pts[i], pts[i + 1], obs)) return false;
      }
    }
    return true;
  }

  const validObstacles = obstacles.filter(Boolean);
  if (validObstacles.length === 0) {
    return [exitPoint, { x: entryPoint.x, y: exitPoint.y }, entryPoint];
  }

  const allMinX = Math.min(...validObstacles.map((o) => o.minX));
  const allMaxX = Math.max(...validObstacles.map((o) => o.maxX));
  const allMinY = Math.min(...validObstacles.map((o) => o.minY));
  const allMaxY = Math.max(...validObstacles.map((o) => o.maxY));

  const xCandidates = [
    prefX,
    (exitPoint.x + entryPoint.x) / 2,
    exitPoint.x,
    entryPoint.x,
    allMinX - 35,
    allMaxX + 35,
  ].filter((x): x is number => x !== undefined && !isNaN(x));

  const yCandidates = [
    prefY,
    (exitPoint.y + entryPoint.y) / 2,
    exitPoint.y,
    entryPoint.y,
    allMinY - 35,
    allMaxY + 35,
  ].filter((y): y is number => y !== undefined && !isNaN(y));

  const isHorizFlow = Math.abs(entryPoint.x - exitPoint.x) >= Math.abs(entryPoint.y - exitPoint.y);
  const hasVertDiff = Math.abs(entryPoint.y - exitPoint.y) > 1;
  const hasHorizDiff = Math.abs(entryPoint.x - exitPoint.x) > 1;

  // Prioritize user-preferred coordinates (prefX / prefY) when provided by interactive line dragging
  if (prefX !== undefined && prefY !== undefined) {
    if (isHorizFlow && hasVertDiff && !userShiftedY) {
      // 2-bend step whose vertical spine moves side-by-side with prefX
      let p = [exitPoint, { x: prefX, y: exitPoint.y }, { x: prefX, y: entryPoint.y }, entryPoint];
      if (pathValid(p)) return p;
    } else if (!isHorizFlow && hasHorizDiff && !userShiftedX) {
      // 2-bend step whose horizontal spine moves up-and-down with prefY
      let p = [exitPoint, { x: exitPoint.x, y: prefY }, { x: entryPoint.x, y: prefY }, entryPoint];
      if (pathValid(p)) return p;
    }

    let p = [exitPoint, { x: prefX, y: exitPoint.y }, { x: prefX, y: prefY }, { x: entryPoint.x, y: prefY }, entryPoint];
    if (pathValid(p)) return p;
    p = [exitPoint, { x: exitPoint.x, y: prefY }, { x: prefX, y: prefY }, { x: prefX, y: entryPoint.y }, entryPoint];
    if (pathValid(p)) return p;
    p = [exitPoint, { x: prefX, y: exitPoint.y }, { x: prefX, y: entryPoint.y }, entryPoint];
    if (pathValid(p)) return p;
    p = [exitPoint, { x: exitPoint.x, y: prefY }, { x: entryPoint.x, y: prefY }, entryPoint];
    if (pathValid(p)) return p;
  } else if (prefX !== undefined) {
    let p = [exitPoint, { x: prefX, y: exitPoint.y }, { x: prefX, y: entryPoint.y }, entryPoint];
    if (pathValid(p)) return p;
    for (const y of yCandidates) {
      p = [exitPoint, { x: prefX, y: exitPoint.y }, { x: prefX, y }, { x: entryPoint.x, y }, entryPoint];
      if (pathValid(p)) return p;
      p = [exitPoint, { x: exitPoint.x, y }, { x: prefX, y }, { x: prefX, y: entryPoint.y }, entryPoint];
      if (pathValid(p)) return p;
    }
  } else if (prefY !== undefined) {
    let p = [exitPoint, { x: exitPoint.x, y: prefY }, { x: entryPoint.x, y: prefY }, entryPoint];
    if (pathValid(p)) return p;
    for (const x of xCandidates) {
      p = [exitPoint, { x, y: exitPoint.y }, { x, y: prefY }, { x: entryPoint.x, y: prefY }, entryPoint];
      if (pathValid(p)) return p;
      p = [exitPoint, { x: exitPoint.x, y: prefY }, { x, y: prefY }, { x, y: entryPoint.y }, entryPoint];
      if (pathValid(p)) return p;
    }
  }

  // 1. Try 1-bend (2-segment)
  let p = [exitPoint, { x: entryPoint.x, y: exitPoint.y }, entryPoint];
  if (pathValid(p)) return p;
  p = [exitPoint, { x: exitPoint.x, y: entryPoint.y }, entryPoint];
  if (pathValid(p)) return p;

  // 2. Try 2-bend (3-segment) via xCandidate
  for (const x of xCandidates) {
    p = [exitPoint, { x, y: exitPoint.y }, { x, y: entryPoint.y }, entryPoint];
    if (pathValid(p)) return p;
  }

  // 3. Try 2-bend (3-segment) via yCandidate
  for (const y of yCandidates) {
    p = [exitPoint, { x: exitPoint.x, y }, { x: entryPoint.x, y }, entryPoint];
    if (pathValid(p)) return p;
  }

  // 4. Try 3-bend (4-segment) via (x, y)
  for (const x of xCandidates) {
    for (const y of yCandidates) {
      p = [exitPoint, { x, y: exitPoint.y }, { x, y }, { x: entryPoint.x, y }, entryPoint];
      if (pathValid(p)) return p;
      p = [exitPoint, { x: exitPoint.x, y }, { x, y }, { x, y: entryPoint.y }, entryPoint];
      if (pathValid(p)) return p;
    }
  }

  // Fallback: mid-corridor orthogonal path
  return [
    exitPoint,
    { x: (exitPoint.x + entryPoint.x) / 2, y: exitPoint.y },
    { x: (exitPoint.x + entryPoint.x) / 2, y: entryPoint.y },
    entryPoint,
  ];
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

  let prefX = centerX ?? defaultPrefX;
  let prefY = centerY ?? defaultPrefY;

  // Clamping within corridor bounds when inside vertical/horizontal spans to avoid group border overlap
  if (sc && tc && (sc.maxX < tc.minX || tc.maxX < sc.minX)) {
    const isOutsideY =
      prefY < Math.min(sc.minY, tc.minY) - 10 ||
      prefY > Math.max(sc.maxY, tc.maxY) + 10;
    if (!isOutsideY && corridorMinX <= corridorMaxX) {
      prefX = Math.max(corridorMinX, Math.min(prefX, corridorMaxX));
    }
  }

  if (sc && tc && (sc.maxY < tc.minY || tc.maxY < sc.minY)) {
    const isOutsideX =
      prefX < Math.min(sc.minX, tc.minX) - 10 ||
      prefX > Math.max(sc.maxX, tc.maxX) + 10;
    if (!isOutsideX && corridorMinY <= corridorMaxY) {
      prefY = Math.max(corridorMinY, Math.min(prefY, corridorMaxY));
    }
  }

  const userShiftedX = centerX !== undefined && Math.abs(centerX - defaultPrefX) > 0.5;
  const userShiftedY = centerY !== undefined && Math.abs(centerY - defaultPrefY) > 0.5;

  const obstacles = [sc, tc, ...otherContainers].filter(Boolean) as ContainerRect[];
  const middlePts = findClearOrthogonalRoute(
    exitPoint,
    entryPoint,
    obstacles,
    prefX,
    prefY,
    userShiftedX,
    userShiftedY
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
  offset?: number;
  curvature?: number;
  targetEntrySide?: 'auto' | 'left' | 'top' | 'right' | 'bottom';
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

  const isDifferentGroup = Boolean(
    sourceNode &&
    targetNode &&
    sourceNode.type !== 'groupJump' &&
    targetNode.type !== 'groupJump' &&
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
  }, [sourceNode, targetNode, isCrossGroupConnection, sourceContainerNode, targetContainerNode]);

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
  }, [isCrossGroupConnection, sourceContainerNode, targetContainerNode, containers]);

  // Flexible target port resolution for cross-group question connectors
  const edgeTargetHandle = (edgeData as any).targetHandle;
  let effectiveTargetPos = targetPosition;
  let effectiveTargetX = targetX;
  let effectiveTargetY = targetY;

  if (isCrossGroupConnection && targetNode) {
    const explicitEntry = edgeData.targetEntrySide;
    const isAutoOrDef = !explicitEntry || explicitEntry === 'auto';
    const isDefaultHandle = !edgeTargetHandle || edgeTargetHandle === 'in';

    let resolvedSide: 'left' | 'right' | 'top' | 'bottom' | null = null;
    if (explicitEntry && explicitEntry !== 'auto') {
      resolvedSide = explicitEntry;
    } else if (edgeTargetHandle === 'in-left') {
      resolvedSide = 'left';
    } else if (edgeTargetHandle === 'in-right') {
      resolvedSide = 'right';
    } else if (edgeTargetHandle === 'in-bottom' || edgeTargetHandle === 'in-bl' || edgeTargetHandle === 'in-br') {
      resolvedSide = 'bottom';
    } else if (edgeTargetHandle === 'in' && !isCrossGroup) {
      resolvedSide = 'top';
    } else if (isAutoOrDef && isDefaultHandle) {
      // Natural flexible alignment based on source and target container positions
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
    // AND fully respects user drag coordinates (centerX, centerY) for free 2D line movement!
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
      offset: edgeData.offset ?? 24,
      sourceContainer: crossGroupContainers.sourceContainer,
      targetContainer: crossGroupContainers.targetContainer,
      otherContainers: crossGroupContainers.otherContainers,
    });
  } else {
    // Default or user-dragged corridor: smoothstep with full 2D bidirectional movement (centerX, centerY) as before!
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
      offset: edgeData.offset,
      bounds: intraGroupBounds,
      sourceContainer: crossGroupContainers?.sourceContainer,
      targetContainer: crossGroupContainers?.targetContainer,
    });
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

      if (intraGroupBounds) {
        currentX = Math.max(intraGroupBounds.minX, Math.min(currentX, intraGroupBounds.maxX));
        currentY = Math.max(intraGroupBounds.minY, Math.min(currentY, intraGroupBounds.maxY));
      }

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
