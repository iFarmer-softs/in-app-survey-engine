import type { Node, Edge } from '@xyflow/react';

interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  startX?: number;
  startY?: number;
}

/**
 * Accurately calculates height and vertical offsets for child questions within a group,
 * accounting for dynamic heights from option branch ports (dropdown, select, radio).
 */
export function calculateGroupQuestionLayout(questions: any[]) {
  const TOP_OFFSET = 115;
  const GAP = 25;
  const offsets: number[] = [];
  let currentY = TOP_OFFSET;

  questions.forEach((q) => {
    offsets.push(currentY);
    const data = q?.data || q || {};
    const optionsStr = data.options || '';
    const optionsCount = optionsStr
      ? optionsStr.split(',').map((s: string) => s.trim()).filter(Boolean).length
      : 0;
    const cardHeight = optionsCount > 0 ? 135 + 35 + optionsCount * 32 : 135;
    currentY += cardHeight + GAP;
  });

  const totalExpandedHeight = Math.max(180, currentY + 25);
  return { offsets, totalExpandedHeight };
}

/**
 * Intelligent Hierarchical Tree / DAG Auto-Layout for Flowcharts.
 * - Respects topological dependencies (root -> questions -> decision branches -> sub-questions -> end).
 * - Distributes sibling branches horizontally so they do not overlap vertically.
 * - Places isolated/orphan nodes into a tidy side column for visibility.
 */
export function calculateHierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  if (nodes.length === 0) return [];

  const {
    horizontalSpacing = 380,
    verticalSpacing = 220,
    startX = 400,
    startY = 50,
  } = options;

  // 1. Map group containers and identify child questions
  const groupContainers = nodes.filter((n) => n.type === 'groupContainer');
  const childToContainer = new Map<string, string>();
  const containerChildren = new Map<string, string[]>();

  groupContainers.forEach((gc) => {
    const qIds: string[] = (gc.data as any)?.questionIds || [];
    containerChildren.set(gc.id, [...qIds]);
    qIds.forEach((qId) => childToContainer.set(qId, gc.id));
  });

  // Only link questions to containers that actually exist on canvas
  nodes.forEach((n) => {
    const cId = (n.data as any)?.containerId;
    if (cId && containerChildren.has(cId)) {
      if (!childToContainer.has(n.id)) {
        childToContainer.set(n.id, cId);
      }
      const existing = containerChildren.get(cId)!;
      if (!existing.includes(n.id)) {
        existing.push(n.id);
      }
    }
  });

  const nodeMap = new Map<string, Node>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Top-level nodes participating in DAG topological ranking (exclude nested children)
  const topLevelNodes = nodes.filter((n) => !childToContainer.has(n.id));
  const topLevelNodeMap = new Map<string, Node>();
  topLevelNodes.forEach((n) => topLevelNodeMap.set(n.id, n));

  // Build top-level adjacency list: re-route edges entering/leaving child questions to their container
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  topLevelNodes.forEach((n) => {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  });

  edges.forEach((e) => {
    const sourceId = childToContainer.get(e.source) || e.source;
    const targetId = childToContainer.get(e.target) || e.target;

    // Ignore edges that are completely internal to the same group container
    if (sourceId === targetId) return;

    if (outgoing.has(sourceId) && !outgoing.get(sourceId)!.includes(targetId)) {
      outgoing.get(sourceId)!.push(targetId);
    }
    if (incoming.has(targetId) && !incoming.get(targetId)!.includes(sourceId)) {
      incoming.get(targetId)!.push(sourceId);
    }
  });

  // Identify root nodes in the top-level graph
  const startNode = topLevelNodes.find((n) => n.type === 'start');
  const rootIds: string[] = [];

  if (startNode) {
    rootIds.push(startNode.id);
  }

  topLevelNodes.forEach((n) => {
    if (n.id !== startNode?.id && incoming.get(n.id)!.length === 0) {
      rootIds.push(n.id);
    }
  });

  if (rootIds.length === 0 && topLevelNodes.length > 0) {
    rootIds.push(topLevelNodes[0].id);
  }

  // Assign ranks using BFS
  const levels = new Map<string, number>();
  const visited = new Set<string>();
  const queue: { id: string; level: number }[] = rootIds.map((id) => ({
    id,
    level: 0,
  }));

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) {
      if (level > (levels.get(id) || 0)) {
        levels.set(id, level);
      }
      continue;
    }

    visited.add(id);
    levels.set(id, level);

    const children = outgoing.get(id) || [];
    children.forEach((childId) => {
      queue.push({ id: childId, level: level + 1 });
    });
  }

  // Orphan top-level nodes
  const orphanIds: string[] = [];
  topLevelNodes.forEach((n) => {
    if (!levels.has(n.id)) {
      orphanIds.push(n.id);
    }
  });

  // Group top-level nodes by level
  const nodesByLevel = new Map<number, string[]>();
  levels.forEach((lvl, id) => {
    if (!nodesByLevel.has(lvl)) {
      nodesByLevel.set(lvl, []);
    }
    nodesByLevel.get(lvl)!.push(id);
  });

  const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b);
  const newPositions = new Map<string, { x: number; y: number }>();

  // Calculate dynamic vertical height for each level (groups need more height if expanded)
  const levelHeight = new Map<number, number>();
  sortedLevels.forEach((lvl) => {
    const idsInLevel = nodesByLevel.get(lvl)!;
    let maxH = verticalSpacing;

    idsInLevel.forEach((id) => {
      const node = topLevelNodeMap.get(id);
      if (node && node.type === 'groupContainer') {
        const isCollapsed = Boolean((node.data as any)?.isCollapsed);
        if (!isCollapsed) {
          const children = containerChildren.get(id) || [];
          const childNodes = children.map((cId) => nodeMap.get(cId)).filter(Boolean);
          const { totalExpandedHeight } = calculateGroupQuestionLayout(childNodes);
          maxH = Math.max(maxH, totalExpandedHeight + 60);
        }
      }
    });

    levelHeight.set(lvl, maxH);
  });

  // Accumulate Y positions per level
  const levelYPos = new Map<number, number>();
  let currentY = startY;
  sortedLevels.forEach((lvl) => {
    levelYPos.set(lvl, currentY);
    currentY += levelHeight.get(lvl) || verticalSpacing;
  });

  // Position top-level nodes and position child questions directly inside their group container
  sortedLevels.forEach((lvl) => {
    const idsInLevel = nodesByLevel.get(lvl)!;
    const count = idsInLevel.length;
    const yPos = levelYPos.get(lvl) || startY + lvl * verticalSpacing;

    idsInLevel.forEach((id, index) => {
      const offsetMultiplier = index - (count - 1) / 2;
      const xPos = startX + offsetMultiplier * horizontalSpacing;
      const roundedX = Math.round(xPos);
      const roundedY = Math.round(yPos);

      newPositions.set(id, { x: roundedX, y: roundedY });

      // If this is a groupContainer, lock its child questions inside it
      if (containerChildren.has(id)) {
        const children = containerChildren.get(id)!;
        const childNodes = children.map((cId) => nodeMap.get(cId)).filter(Boolean);
        const { offsets } = calculateGroupQuestionLayout(childNodes);
        children.forEach((childId, cIdx) => {
          newPositions.set(childId, {
            x: roundedX + 30,
            y: roundedY + (offsets[cIdx] ?? (115 + cIdx * 200)),
          });
        });
      }
    });
  });

  // Layout true orphan top-level nodes in side column
  if (orphanIds.length > 0) {
    const orphanStartX = startX + (sortedLevels.length > 0 ? 550 : 0) + horizontalSpacing;
    let orphanY = startY;

    orphanIds.forEach((id) => {
      const roundedX = Math.round(orphanStartX);
      const roundedY = Math.round(orphanY);
      newPositions.set(id, { x: roundedX, y: roundedY });

      if (containerChildren.has(id)) {
        const children = containerChildren.get(id)!;
        const childNodes = children.map((cId) => nodeMap.get(cId)).filter(Boolean);
        const { offsets, totalExpandedHeight } = calculateGroupQuestionLayout(childNodes);
        children.forEach((childId, cIdx) => {
          newPositions.set(childId, {
            x: roundedX + 30,
            y: roundedY + (offsets[cIdx] ?? (115 + cIdx * 200)),
          });
        });
        const node = topLevelNodeMap.get(id);
        const isCollapsed = Boolean((node?.data as any)?.isCollapsed);
        orphanY += isCollapsed ? 140 : totalExpandedHeight + 40;
      } else {
        orphanY += 180;
      }
    });
  }

  // Return nodes with guaranteed containment positions
  return nodes.map((n) => {
    const pos = newPositions.get(n.id);
    if (pos) {
      return {
        ...n,
        position: pos,
      };
    }
    return n;
  });
}

/**
 * Aligns selected nodes (or all nodes) horizontally to their average Y coordinate.
 */
export function alignNodesHorizontal(nodes: Node[], selectedIds?: string[]): Node[] {
  const targetNodes = selectedIds && selectedIds.length > 1
    ? nodes.filter((n) => selectedIds.includes(n.id))
    : nodes;

  if (targetNodes.length <= 1) return nodes;

  const avgY = Math.round(
    targetNodes.reduce((acc, n) => acc + n.position.y, 0) / targetNodes.length
  );

  const targetSet = new Set(targetNodes.map((n) => n.id));

  return nodes.map((n) => {
    if (targetSet.has(n.id)) {
      return { ...n, position: { ...n.position, y: avgY } };
    }
    return n;
  });
}

/**
 * Aligns selected nodes (or all nodes) vertically to their average X coordinate.
 */
export function alignNodesVertical(nodes: Node[], selectedIds?: string[]): Node[] {
  const targetNodes = selectedIds && selectedIds.length > 1
    ? nodes.filter((n) => selectedIds.includes(n.id))
    : nodes;

  if (targetNodes.length <= 1) return nodes;

  const avgX = Math.round(
    targetNodes.reduce((acc, n) => acc + n.position.x, 0) / targetNodes.length
  );

  const targetSet = new Set(targetNodes.map((n) => n.id));

  return nodes.map((n) => {
    if (targetSet.has(n.id)) {
      return { ...n, position: { ...n.position, x: avgX } };
    }
    return n;
  });
}

/**
 * Distributes nodes evenly along the vertical axis.
 */
export function distributeNodesVertical(nodes: Node[]): Node[] {
  if (nodes.length <= 2) return nodes;

  const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
  const minY = sorted[0].position.y;
  const maxY = sorted[sorted.length - 1].position.y;
  const step = (maxY - minY) / (sorted.length - 1);

  const posMap = new Map<string, number>();
  sorted.forEach((n, idx) => {
    posMap.set(n.id, Math.round(minY + idx * step));
  });

  return nodes.map((n) => {
    const newY = posMap.get(n.id);
    if (newY !== undefined) {
      return { ...n, position: { ...n.position, y: newY } };
    }
    return n;
  });
}

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Checks whether two frames intersect, taking into account a minimum gutter/gap.
 */
export function checkFramesOverlap(
  rectA: FrameRect,
  rectB: FrameRect,
  gap: number = 24
): boolean {
  return (
    rectA.x < rectB.x + rectB.w + gap &&
    rectA.x + rectA.w + gap > rectB.x &&
    rectA.y < rectB.y + rectB.h + gap &&
    rectA.y + rectA.h + gap > rectB.y
  );
}

/**
 * Clamps a proposed frame position so it never collides or overlaps with any other frame on the canvas,
 * allowing smooth 1D sliding along free axes when bumping into adjacent frames.
 */
export function resolveFrameCollision(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  frameW: number,
  frameH: number,
  otherFrames: FrameRect[],
  gap: number = 24
): { x: number; y: number } {
  if (otherFrames.length === 0) {
    return { x: targetX, y: targetY };
  }

  let resolvedX = targetX;
  let resolvedY = targetY;

  const dx = targetX - currentX;
  const dy = targetY - currentY;

  // 1. Try moving along X while keeping Y at currentY
  for (const other of otherFrames) {
    if (checkFramesOverlap({ x: resolvedX, y: currentY, w: frameW, h: frameH }, other, gap)) {
      if (dx > 0) {
        resolvedX = Math.min(resolvedX, other.x - frameW - gap);
      } else if (dx < 0) {
        resolvedX = Math.max(resolvedX, other.x + other.w + gap);
      } else {
        resolvedX = currentX;
      }
    }
  }

  // 2. Try moving along Y with the resolved X position
  for (const other of otherFrames) {
    if (checkFramesOverlap({ x: resolvedX, y: resolvedY, w: frameW, h: frameH }, other, gap)) {
      if (dy > 0) {
        resolvedY = Math.min(resolvedY, other.y - frameH - gap);
      } else if (dy < 0) {
        resolvedY = Math.max(resolvedY, other.y + other.h + gap);
      } else {
        resolvedY = currentY;
      }
    }
  }

  // 3. Fallback collision safety check
  for (const other of otherFrames) {
    if (checkFramesOverlap({ x: resolvedX, y: resolvedY, w: frameW, h: frameH }, other, gap)) {
      return { x: currentX, y: currentY };
    }
  }

  return { x: resolvedX, y: resolvedY };
}

/**
 * Finds the nearest non-overlapping position for a frame when dropped on the canvas,
 * prioritizing the smallest displacement distance to the 4 sides of colliding frames.
 */
export function findNearestNonOverlappingPosition(
  droppedX: number,
  droppedY: number,
  frameW: number,
  frameH: number,
  otherFrames: FrameRect[],
  gap: number = 30
): { x: number; y: number } {
  const currentRect: FrameRect = { x: droppedX, y: droppedY, w: frameW, h: frameH };

  // 1. If no overlap with any other frame, it is safely in free space
  const overlappingFrames = otherFrames.filter((other) =>
    checkFramesOverlap(currentRect, other, gap)
  );
  if (overlappingFrames.length === 0) {
    return { x: droppedX, y: droppedY };
  }

  // 2. Generate candidate positions nudged around all 4 sides of colliding frames
  const candidates: Array<{ x: number; y: number }> = [];

  for (const other of overlappingFrames) {
    // Primary cardinal candidates
    candidates.push({ x: other.x + other.w + gap, y: droppedY }); // Right
    candidates.push({ x: other.x - frameW - gap, y: droppedY }); // Left
    candidates.push({ x: droppedX, y: other.y + other.h + gap }); // Below
    candidates.push({ x: droppedX, y: other.y - frameH - gap }); // Above

    // Corner aligned candidates
    candidates.push({ x: other.x + other.w + gap, y: other.y });
    candidates.push({ x: other.x - frameW - gap, y: other.y });
    candidates.push({ x: other.x, y: other.y + other.h + gap });
    candidates.push({ x: other.x, y: other.y - frameH - gap });
  }

  // 3. Filter candidates that do not collide with ANY other frame
  const validCandidates = candidates.filter((cand) => {
    // Avoid pushing into negative coordinates off-canvas
    if (cand.x < 30 || cand.y < 30) return false;
    const testRect: FrameRect = { x: cand.x, y: cand.y, w: frameW, h: frameH };
    return otherFrames.every((other) => !checkFramesOverlap(testRect, other, gap));
  });

  // 4. If valid candidates exist, pick the candidate with minimum Euclidean displacement
  if (validCandidates.length > 0) {
    validCandidates.sort((a, b) => {
      const distA = Math.hypot(a.x - droppedX, a.y - droppedY);
      const distB = Math.hypot(b.x - droppedX, b.y - droppedY);
      return distA - distB;
    });
    return validCandidates[0];
  }

  // 5. Fallback: Nudge to the right of the rightmost frame
  const maxRight = Math.max(...otherFrames.map((f) => f.x + f.w));
  return { x: maxRight + gap, y: Math.max(droppedY, 50) };
}
