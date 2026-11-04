import type { Node, Edge } from '@xyflow/react';

export interface DependencyTraceResult {
  selectedNodeId: string;
  ancestorNodeIds: Set<string>;
  ancestorEdgeIds: Set<string>;
  descendantNodeIds: Set<string>;
  descendantEdgeIds: Set<string>;
  predecessorNodes: Node[];
  successorNodes: Node[];
}

export type TraceNodeRole = 'selected' | 'ancestor' | 'descendant' | 'dimmed' | 'normal';
export type TraceEdgeRole = 'upstream' | 'downstream' | 'dimmed' | 'normal';

/**
 * Calculates upstream (ancestor/predecessor) and downstream (descendant/successor)
 * nodes and edges starting from a selected target node.
 * Uses BFS graph traversal with cycle prevention.
 */
export function calculateDependencyTrace(
  nodes: Node[],
  edges: Edge[],
  selectedNodeId: string | null
): DependencyTraceResult | null {
  if (!selectedNodeId) return null;

  const targetNode = nodes.find((n) => n.id === selectedNodeId);
  if (!targetNode) return null;

  // Build reverse adjacency: target -> incoming edges
  const incomingEdgeMap = new Map<string, Edge[]>();
  // Build forward adjacency: source -> outgoing edges
  const outgoingEdgeMap = new Map<string, Edge[]>();

  edges.forEach((edge) => {
    // Incoming
    const inList = incomingEdgeMap.get(edge.target) || [];
    inList.push(edge);
    incomingEdgeMap.set(edge.target, inList);

    // Outgoing
    const outList = outgoingEdgeMap.get(edge.source) || [];
    outList.push(edge);
    outgoingEdgeMap.set(edge.source, outList);
  });

  // 1. Traverse Upstream (Predecessors / Ancestors)
  const ancestorNodeIds = new Set<string>();
  const ancestorEdgeIds = new Set<string>();
  const upstreamQueue: string[] = [selectedNodeId];
  const visitedUpstream = new Set<string>([selectedNodeId]);

  while (upstreamQueue.length > 0) {
    const currId = upstreamQueue.shift()!;
    const incomingEdges = incomingEdgeMap.get(currId) || [];
    for (const edge of incomingEdges) {
      ancestorEdgeIds.add(edge.id);
      if (!visitedUpstream.has(edge.source)) {
        visitedUpstream.add(edge.source);
        ancestorNodeIds.add(edge.source);
        upstreamQueue.push(edge.source);
      }
    }
  }

  // 2. Traverse Downstream (Successors / Descendants)
  const descendantNodeIds = new Set<string>();
  const descendantEdgeIds = new Set<string>();
  const downstreamQueue: string[] = [selectedNodeId];
  const visitedDownstream = new Set<string>([selectedNodeId]);

  while (downstreamQueue.length > 0) {
    const currId = downstreamQueue.shift()!;
    const outgoingEdges = outgoingEdgeMap.get(currId) || [];
    for (const edge of outgoingEdges) {
      descendantEdgeIds.add(edge.id);
      if (!visitedDownstream.has(edge.target)) {
        visitedDownstream.add(edge.target);
        descendantNodeIds.add(edge.target);
        downstreamQueue.push(edge.target);
      }
    }
  }

  // Order nodes logically: predecessors in reverse topological / DAG order, successors in forward order
  const predecessorNodes = nodes
    .filter((n) => ancestorNodeIds.has(n.id))
    .sort((a, b) => a.position.y - b.position.y);

  const successorNodes = nodes
    .filter((n) => descendantNodeIds.has(n.id))
    .sort((a, b) => a.position.y - b.position.y);

  return {
    selectedNodeId,
    ancestorNodeIds,
    ancestorEdgeIds,
    descendantNodeIds,
    descendantEdgeIds,
    predecessorNodes,
    successorNodes,
  };
}

/**
 * Returns the trace role of a node given the active trace.
 */
export function getTraceNodeRole(
  nodeId: string,
  nodeType: string | undefined,
  trace: DependencyTraceResult | null
): TraceNodeRole {
  if (!trace) return 'normal';
  if (nodeType === 'groupFrame' || nodeType === 'groupContainer') {
    // Container frames remain visible as structural context
    return 'normal';
  }
  if (nodeId === trace.selectedNodeId) return 'selected';
  if (trace.ancestorNodeIds.has(nodeId)) return 'ancestor';
  if (trace.descendantNodeIds.has(nodeId)) return 'descendant';
  return 'dimmed';
}

/**
 * Returns the trace role of an edge given the active trace.
 */
export function getTraceEdgeRole(
  edgeId: string,
  trace: DependencyTraceResult | null
): TraceEdgeRole {
  if (!trace) return 'normal';
  if (trace.ancestorEdgeIds.has(edgeId)) return 'upstream';
  if (trace.descendantEdgeIds.has(edgeId)) return 'downstream';
  return 'dimmed';
}

/**
 * Extracts a friendly human-readable title for a node in trace lists.
 */
export function getNodeTraceLabel(node: Node): string {
  const data = node.data as any;
  if (node.type === 'question') {
    const qId = data?.question_id ? `Q#${data.question_id}` : '';
    const title = data?.question || data?.question_bn || 'Untitled Question';
    return qId ? `${qId}: ${title}` : title;
  }
  if (node.type === 'decision') {
    return data?.label ? `Condition: ${data.label}` : 'Decision Check';
  }
  if (node.type === 'groupJump') {
    return `Jump to Group ${data?.targetGroupId || ''}`;
  }
  if (node.type === 'start') return 'Start Terminator';
  if (node.type === 'end') return 'End Terminator';
  if (node.type === 'process') return data?.label || 'Process Step';
  if (node.type === 'document') return data?.label || 'Document Node';
  return data?.label || node.id;
}

