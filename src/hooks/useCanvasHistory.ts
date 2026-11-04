import { useState, useRef, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { GroupMeta } from '../utils/schemaCompiler';

export interface CanvasHistorySnapshot {
  nodes: Node[];
  edges: Edge[];
  groupMeta: GroupMeta;
}

export class CanvasHistoryManager {
  private past: CanvasHistorySnapshot[] = [];
  private future: CanvasHistorySnapshot[] = [];
  private maxHistory: number;
  private dragStartSnapshot: CanvasHistorySnapshot | null = null;

  constructor(maxHistory = 30) {
    this.maxHistory = maxHistory;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get historyDepth(): number {
    return this.past.length;
  }

  get redoDepth(): number {
    return this.future.length;
  }

  static cloneSnapshot(
    nodes: Node[],
    edges: Edge[],
    groupMeta: GroupMeta
  ): CanvasHistorySnapshot {
    return {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      groupMeta: JSON.parse(JSON.stringify(groupMeta)),
    };
  }

  static isSnapshotEqual(
    a: CanvasHistorySnapshot,
    b: CanvasHistorySnapshot
  ): boolean {
    return (
      JSON.stringify(a.nodes) === JSON.stringify(b.nodes) &&
      JSON.stringify(a.edges) === JSON.stringify(b.edges) &&
      JSON.stringify(a.groupMeta) === JSON.stringify(b.groupMeta)
    );
  }

  recordSnapshot(nodes: Node[], edges: Edge[], groupMeta: GroupMeta): boolean {
    const snap = CanvasHistoryManager.cloneSnapshot(nodes, edges, groupMeta);

    // Prevent redundant duplicate entries in past stack
    if (this.past.length > 0) {
      const top = this.past[this.past.length - 1];
      if (CanvasHistoryManager.isSnapshotEqual(top, snap)) {
        return false;
      }
    }

    this.past.push(snap);

    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }

    this.future = [];
    return true;
  }

  undo(
    currentNodes: Node[],
    currentEdges: Edge[],
    currentMeta: GroupMeta
  ): CanvasHistorySnapshot | null {
    if (this.past.length === 0) return null;

    const currentSnap = CanvasHistoryManager.cloneSnapshot(
      currentNodes,
      currentEdges,
      currentMeta
    );
    let previous: CanvasHistorySnapshot | null = null;

    while (this.past.length > 0) {
      const candidate = this.past.pop()!;
      if (!CanvasHistoryManager.isSnapshotEqual(candidate, currentSnap)) {
        previous = candidate;
        break;
      }
    }

    if (!previous) {
      return null;
    }

    this.future.push(currentSnap);
    return previous;
  }

  redo(
    currentNodes: Node[],
    currentEdges: Edge[],
    currentMeta: GroupMeta
  ): CanvasHistorySnapshot | null {
    if (this.future.length === 0) return null;

    const currentSnap = CanvasHistoryManager.cloneSnapshot(
      currentNodes,
      currentEdges,
      currentMeta
    );
    let next: CanvasHistorySnapshot | null = null;

    while (this.future.length > 0) {
      const candidate = this.future.pop()!;
      if (!CanvasHistoryManager.isSnapshotEqual(candidate, currentSnap)) {
        next = candidate;
        break;
      }
    }

    if (!next) {
      return null;
    }

    this.past.push(currentSnap);
    return next;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.dragStartSnapshot = null;
  }

  onNodeDragStart(nodes: Node[], edges: Edge[], groupMeta: GroupMeta): void {
    this.dragStartSnapshot = CanvasHistoryManager.cloneSnapshot(nodes, edges, groupMeta);
  }

  onNodeDragStop(currentNodes: Node[]): boolean {
    if (!this.dragStartSnapshot) return false;

    const startNodes = this.dragStartSnapshot.nodes;
    let hasPositionChanged = false;

    for (const curr of currentNodes) {
      const start = startNodes.find((n) => n.id === curr.id);
      if (
        start &&
        (Math.abs(start.position.x - curr.position.x) > 1 ||
          Math.abs(start.position.y - curr.position.y) > 1)
      ) {
        hasPositionChanged = true;
        break;
      }
    }

    if (hasPositionChanged) {
      this.past.push(this.dragStartSnapshot);
      if (this.past.length > this.maxHistory) {
        this.past.shift();
      }
      this.future = [];
      this.dragStartSnapshot = null;
      return true;
    }

    this.dragStartSnapshot = null;
    return false;
  }
}

interface UseCanvasHistoryOptions {
  maxHistory?: number;
  onApplySnapshot?: (snapshot: CanvasHistorySnapshot) => void;
}

export function useCanvasHistory({
  maxHistory = 30,
  onApplySnapshot,
}: UseCanvasHistoryOptions = {}) {
  const managerRef = useRef<CanvasHistoryManager>(new CanvasHistoryManager(maxHistory));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateFlags = useCallback(() => {
    setCanUndo(managerRef.current.canUndo);
    setCanRedo(managerRef.current.canRedo);
  }, []);

  const recordSnapshot = useCallback(
    (nodes: Node[], edges: Edge[], groupMeta: GroupMeta) => {
      managerRef.current.recordSnapshot(nodes, edges, groupMeta);
      updateFlags();
    },
    [updateFlags]
  );

  const handleUndo = useCallback(
    (currentNodes: Node[], currentEdges: Edge[], currentMeta: GroupMeta) => {
      const previous = managerRef.current.undo(currentNodes, currentEdges, currentMeta);
      updateFlags();
      if (previous && onApplySnapshot) {
        onApplySnapshot(previous);
      }
      return previous;
    },
    [updateFlags, onApplySnapshot]
  );

  const handleRedo = useCallback(
    (currentNodes: Node[], currentEdges: Edge[], currentMeta: GroupMeta) => {
      const next = managerRef.current.redo(currentNodes, currentEdges, currentMeta);
      updateFlags();
      if (next && onApplySnapshot) {
        onApplySnapshot(next);
      }
      return next;
    },
    [updateFlags, onApplySnapshot]
  );

  const clearHistory = useCallback(() => {
    managerRef.current.clear();
    updateFlags();
  }, [updateFlags]);

  const onNodeDragStart = useCallback(
    (nodes: Node[], edges: Edge[], groupMeta: GroupMeta) => {
      managerRef.current.onNodeDragStart(nodes, edges, groupMeta);
    },
    []
  );

  const onNodeDragStop = useCallback(
    (currentNodes: Node[]) => {
      const recorded = managerRef.current.onNodeDragStop(currentNodes);
      if (recorded) {
        updateFlags();
      }
    },
    [updateFlags]
  );

  return {
    canUndo,
    canRedo,
    recordSnapshot,
    handleUndo,
    handleRedo,
    clearHistory,
    onNodeDragStart,
    onNodeDragStop,
    historyDepth: managerRef.current.historyDepth,
    redoDepth: managerRef.current.redoDepth,
  };
}
