import type { Node, Edge } from '@xyflow/react';
import type { QuestionNodeData, AnswerType } from '../types/survey';

export interface FlowDiagnostic {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  nodeId?: string;
  edgeId?: string;
  questionId?: number;
}

const OPTION_BASED_TYPES: AnswerType[] = [
  'dropdown',
  'select_one',
  'select_multiple',
  'radio',
  'single_radio',
];

/**
 * Authoritatively determines if a child symbol belongs to a group container or frame.
 * Checks (in priority order):
 * 1. Direct containerId match (matches container.id or container.data.groupId)
 * 2. Inclusion in container.data.questionIds array
 * 3. Protected foreign ownership: If child explicitly belongs to another container on canvas, do not steal it.
 * 4. Spatial containment check: symbol is positioned inside container boundary.
 * 5. Group number match (when container numericGroupId matches child's group).
 */
export function isNodeInContainer(
  childNode: Node,
  containerNode: Node,
  allNodes: Node[] = []
): boolean {
  if (!childNode || !containerNode || childNode.id === containerNode.id) return false;
  if (childNode.type === 'groupFrame' || childNode.type === 'groupContainer') return false;

  const cData = containerNode.data as any;
  const nData = childNode.data as any;

  // 1. Direct containerId match
  if (nData?.containerId) {
    if (nData.containerId === containerNode.id) return true;
    if (cData?.groupId && nData.containerId === cData.groupId) return true;
  }

  // 2. Explicit questionIds list
  const qIds: string[] = cData?.questionIds || [];
  if (qIds.includes(childNode.id)) {
    return true;
  }

  // If child is explicitly bound to a DIFFERENT active container on canvas, protect that container's ownership
  if (nData?.containerId) {
    const boundToOther = allNodes.some(
      (other) =>
        (other.type === 'groupFrame' || other.type === 'groupContainer') &&
        other.id !== containerNode.id &&
        (other.id === nData.containerId || (other.data as any)?.groupId === nData.containerId)
    );
    if (boundToOther) {
      return false;
    }
  }

  // 3. Spatial containment check: symbol is positioned inside container boundary
  if (childNode.position && containerNode.position) {
    const fX = containerNode.position.x;
    const fY = containerNode.position.y;
    const fW =
      (containerNode.style?.width ? parseInt(String(containerNode.style.width), 10) : 0) ||
      (typeof containerNode.width === 'number' && containerNode.width > 0 ? containerNode.width : 0) ||
      containerNode.measured?.width ||
      cData?.width ||
      (containerNode.type === 'groupContainer' ? 350 : 440);
    const fH =
      (containerNode.style?.height ? parseInt(String(containerNode.style.height), 10) : 0) ||
      (typeof containerNode.height === 'number' && containerNode.height > 0 ? containerNode.height : 0) ||
      containerNode.measured?.height ||
      cData?.expandedHeight ||
      cData?.height ||
      (containerNode.type === 'groupContainer' ? 400 : 480);

    const nW = childNode.measured?.width || (childNode.type === 'question' ? 270 : 180);
    const nH = childNode.measured?.height || (childNode.type === 'question' ? 200 : 100);
    const nCenterX = childNode.position.x + nW / 2;
    const nCenterY = childNode.position.y + nH / 2;

    const isInside =
      (childNode.position.x >= fX - 15 &&
        childNode.position.x + Math.min(nW, 50) <= fX + fW + 15 &&
        childNode.position.y >= fY - 15 &&
        childNode.position.y + Math.min(nH, 50) <= fY + fH + 15) ||
      (nCenterX >= fX && nCenterX <= fX + fW && nCenterY >= fY && nCenterY <= fH);

    if (isInside) {
      return true;
    }
  }

  // 4. Group number match (when numericGroupId matches child's group)
  const cNum =
    typeof cData?.numericGroupId === 'number' && cData.numericGroupId > 0
      ? cData.numericGroupId
      : parseInt(String(cData?.title || cData?.titleBn || cData?.groupId || '').replace(/\D+/g, ''), 10);

  const nGrp =
    typeof nData?.group === 'number' && nData.group > 0
      ? nData.group
      : undefined;

  if (typeof cNum === 'number' && !isNaN(cNum) && cNum > 0 && nGrp === cNum) {
    return true;
  }

  return false;
}

/**
 * Resolves the numeric group ID of any given node (question or container).
 */
export function resolveNodeGroupId(
  node: Node | undefined,
  allNodes: Node[] = [],
  fallbackGroup: number = 1
): number {
  if (!node || !node.data) return fallbackGroup;
  const d = node.data as any;

  // 1. If the node itself is a group container or frame
  if (node.type === 'groupContainer' || node.type === 'groupFrame') {
    if (typeof d.numericGroupId === 'number' && !isNaN(d.numericGroupId) && d.numericGroupId > 0) {
      return d.numericGroupId;
    }
    if (d.title || d.titleBn) {
      const titleNum = parseInt(String(d.title || d.titleBn).replace(/\D+/g, ''), 10);
      if (!isNaN(titleNum) && titleNum > 0) return titleNum;
    }
    if (d.groupId && !String(d.groupId).startsWith('grp-frame-')) {
      const parsed = parseInt(String(d.groupId).replace(/\D+/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  // 2. Authoritative: If node has a containerId pointing to a container or frame
  if (d.containerId) {
    const container = allNodes.find((n) => n.id === d.containerId);
    if (container) {
      const cd = container.data as any;
      if (typeof cd?.numericGroupId === 'number' && !isNaN(cd.numericGroupId) && cd.numericGroupId > 0) {
        return cd.numericGroupId;
      }
      if (cd?.title || cd?.titleBn) {
        const titleNum = parseInt(String(cd.title || cd.titleBn).replace(/\D+/g, ''), 10);
        if (!isNaN(titleNum) && titleNum > 0) return titleNum;
      }
      if (cd?.groupId && !String(cd.groupId).startsWith('grp-frame-')) {
        const parsed = parseInt(String(cd.groupId).replace(/\D+/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  }

  // 3. Spatial containment check: is this node inside any groupFrame or groupContainer?
  if (node.position && allNodes.length > 0) {
    const nx = node.position.x;
    const ny = node.position.y;
    const enclosing = allNodes.find((n) => {
      if (n.id === node.id) return false;
      if (n.type !== 'groupFrame' && n.type !== 'groupContainer') return false;
      let w = 440;
      let h = 480;
      if (typeof n.width === 'number' && n.width > 0) w = n.width;
      else if (n.measured?.width && n.measured.width > 0) w = n.measured.width;
      else if (n.style?.width) {
        const p = parseInt(String(n.style.width), 10);
        if (!isNaN(p) && p > 0) w = p;
      }
      if (typeof n.height === 'number' && n.height > 0) h = n.height;
      else if (n.measured?.height && n.measured.height > 0) h = n.measured.height;
      else if (n.style?.height) {
        const p = parseInt(String(n.style.height), 10);
        if (!isNaN(p) && p > 0) h = p;
      }
      return nx >= n.position.x && nx <= n.position.x + w && ny >= n.position.y && ny <= n.position.y + h;
    });

    if (enclosing) {
      const ed = enclosing.data as any;
      if (typeof ed?.numericGroupId === 'number' && !isNaN(ed.numericGroupId) && ed.numericGroupId > 0) {
        return ed.numericGroupId;
      }
      if (ed?.groupId) {
        const parsed = parseInt(String(ed.groupId).replace(/\D+/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  }

  // 4. Direct property on the question node
  if (typeof d.group === 'number' && !isNaN(d.group) && d.group > 0) {
    return d.group;
  }
  if (typeof d.numericGroupId === 'number' && !isNaN(d.numericGroupId) && d.numericGroupId > 0) {
    return d.numericGroupId;
  }

  return fallbackGroup;
}

/**
 * Checks whether an edge connects nodes belonging to two different survey groups.
 */
export function isCrossGroupEdge(
  edge: Edge,
  allNodes: Node[],
  fallbackGroup: number = 1
): boolean {
  const sourceNode = allNodes.find((n) => n.id === edge.source);
  const targetNode = allNodes.find((n) => n.id === edge.target);
  if (!sourceNode || !targetNode) return false;
  if (sourceNode.type === 'groupJump' || targetNode.type === 'groupJump') return false;
  const sourceGroup = resolveNodeGroupId(sourceNode, allNodes, fallbackGroup);
  const targetGroup = resolveNodeGroupId(targetNode, allNodes, fallbackGroup);
  return sourceGroup !== targetGroup;
}

/**
 * Determines if a set of branches from a source node to a target node represents
 * an invalid binary contradiction or 100% full-set redundancy (e.g. Yes AND No, True AND False,
 * Match AND Else, or all available options pointing to the same child).
 *
 * NOTE: For multi-conditional questions (3+ options, like Rice, Corn, Potato), connecting a subset
 * of options (e.g. Rice and Corn) to the same target is a VALID OR-condition and is permitted.
 */
export function isBinaryRedundantBranch(
  sourceNode: Node | undefined,
  pairEdges: Edge[]
): { isRedundant: boolean; reason?: string } {
  if (!sourceNode || pairEdges.length <= 1) {
    return { isRedundant: false };
  }

  const handles = pairEdges.map((e) => e.sourceHandle).filter(Boolean) as string[];

  // 1. Unconditional default progression mixed with a conditional branch to the same target
  const hasDefault = handles.includes('default-next');
  const hasOption = handles.some((h) => h.startsWith('opt-') || h === 'match' || h === 'else');
  if (hasDefault && hasOption) {
    return {
      isRedundant: true,
      reason: 'An unconditional default progression is mixed with a conditional branch to the same question.',
    };
  }

  // 2. Decision node (Match / Else)
  if (sourceNode.type === 'decision') {
    if (handles.includes('match') && handles.includes('else')) {
      return {
        isRedundant: true,
        reason: 'Decision Node has both "Match (True)" and "Else (False)" pointing to the same target node, making the condition redundant.',
      };
    }
  }

  // 3. Question node with binary options or full set of options
  if (sourceNode.type === 'question') {
    const qData = sourceNode.data as unknown as QuestionNodeData;
    const rawOptions = qData.options || '';
    const allOptions = rawOptions
      .split(',')
      .map((o) => o.trim().toLowerCase())
      .filter(Boolean);

    // Connected option values
    const connectedOptions = handles
      .filter((h) => h.startsWith('opt-'))
      .map((h) => decodeURIComponent(h.replace('opt-', '')).trim().toLowerCase());

    // Binary question check (2 options total where both are connected to the same child)
    if (allOptions.length === 2 && connectedOptions.length >= 2) {
      const isYesNo =
        allOptions.some((o) => o.includes('yes') || o.includes('হ্যাঁ')) &&
        allOptions.some((o) => o.includes('no') || o.includes('না'));
      const isTrueFalse =
        allOptions.some((o) => o.includes('true') || o.includes('সত্য')) &&
        allOptions.some((o) => o.includes('false') || o.includes('মিথ্যা'));

      const typeLabel = isYesNo ? 'Yes/No' : isTrueFalse ? 'True/False' : 'binary';
      return {
        isRedundant: true,
        reason: `Opposing branches for both options of this ${typeLabel} question point to the same target, making the condition redundant.`,
      };
    }

    // For questions with 3+ options (multiconditional), only flag if ALL options point to the same target
    if (allOptions.length > 2 && connectedOptions.length >= allOptions.length) {
      const allConnected = allOptions.every((opt) => connectedOptions.includes(opt));
      if (allConnected) {
        return {
          isRedundant: true,
          reason: 'All available options of this question point to the same target, making the condition redundant.',
        };
      }
    }
  }

  return { isRedundant: false };
}

/**
 * Validates a survey flowchart graph for completeness, logic loops, and schema integrity.
 */
export function validateSurveyFlow(nodes: Node[], edges: Edge[]): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];

  if (nodes.length === 0) {
    diagnostics.push({
      id: 'empty-flow',
      type: 'info',
      title: 'Empty Flowchart Canvas',
      description: 'Add a Start node and your first question from the left sidebar to begin building.',
    });
    return diagnostics;
  }

  // 1. Check for Start Node
  const startNode = nodes.find((n) => n.type === 'start');
  if (!startNode) {
    diagnostics.push({
      id: 'missing-start',
      type: 'warning',
      title: 'Missing Start Terminator',
      description: 'Add a Start node (Oval) to define the clear entry point for this survey group.',
    });
  }

  // Build incoming & outgoing connectivity maps
  const incomingMap = new Map<string, Edge[]>();
  const outgoingMap = new Map<string, Edge[]>();

  nodes.forEach((n) => {
    incomingMap.set(n.id, []);
    outgoingMap.set(n.id, []);
  });

  edges.forEach((e) => {
    if (incomingMap.has(e.target)) {
      incomingMap.get(e.target)!.push(e);
    }
    if (outgoingMap.has(e.source)) {
      outgoingMap.get(e.source)!.push(e);
    }
  });

  // 2. Validate individual Question Nodes
  nodes.forEach((node) => {
    if (node.type === 'question') {
      const qData = node.data as unknown as QuestionNodeData;
      const qId = qData.question_id;

      // Check text content
      const hasBn = Boolean(qData.question_bn && qData.question_bn.trim().length > 0);
      const hasEn = Boolean(qData.question && qData.question.trim().length > 0);

      if (!hasBn && !hasEn) {
        diagnostics.push({
          id: `missing-text-${node.id}`,
          type: 'error',
          title: `Question Q#${qId} has no question text`,
          description: 'Provide at least a Bangla title or English title for facilitators to read.',
          nodeId: node.id,
          questionId: qId,
        });
      }

      // Check option-based types
      if (OPTION_BASED_TYPES.includes(qData.answer_type)) {
        const hasOptions = Boolean(qData.options && qData.options.trim().length > 0);
        if (!hasOptions) {
          diagnostics.push({
            id: `missing-options-${node.id}`,
            type: 'error',
            title: `Q#${qId} (${qData.answer_type}) is missing options`,
            description: 'Dropdowns and radio choices require comma-separated option items (e.g. "Yes, No").',
            nodeId: node.id,
            questionId: qId,
          });
        }
      }

      // Check orphan status (no incoming connections, and not connected from start)
      const incoming = incomingMap.get(node.id) || [];
      const outgoing = outgoingMap.get(node.id) || [];

      if (incoming.length === 0 && outgoing.length === 0) {
        diagnostics.push({
          id: `orphan-isolated-${node.id}`,
          type: 'warning',
          title: `Q#${qId} is completely isolated`,
          description: 'This question has no incoming or outgoing connections and will not trigger in the app.',
          nodeId: node.id,
          questionId: qId,
        });
      } else if (incoming.length === 0) {
        diagnostics.push({
          id: `orphan-no-input-${node.id}`,
          type: 'info',
          title: `Q#${qId} has no incoming flow connection`,
          description: 'Connect this question from a Start node, prior question, or condition branch.',
          nodeId: node.id,
          questionId: qId,
        });
      }
    }
  });

  // 3. Validate Edge Conditions & Option References
  edges.forEach((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) return;

    if (sourceNode.type === 'question') {
      const parentData = sourceNode.data as unknown as QuestionNodeData;
      if (OPTION_BASED_TYPES.includes(parentData.answer_type) && parentData.options) {
        const validOptions = parentData.options
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

        // Check if edge was created from an option handle
        if (edge.sourceHandle && edge.sourceHandle.startsWith('opt-')) {
          const optVal = decodeURIComponent(edge.sourceHandle.replace('opt-', '')).trim().toLowerCase();
          if (!validOptions.includes(optVal)) {
            diagnostics.push({
              id: `stale-option-${edge.id}`,
              type: 'warning',
              title: 'Branch references removed option',
              description: `Connection triggers on "${optVal}", but this option no longer exists on parent Q#${parentData.question_id}.`,
              nodeId: sourceNode.id,
              edgeId: edge.id,
            });
          }
        }
      }
    }
  });

  // 4. Detect Conflicting / Redundant Binary Branches
  const edgePairMap = new Map<string, Edge[]>();
  edges.forEach((edge) => {
    const pairKey = `${edge.source}->${edge.target}`;
    if (!edgePairMap.has(pairKey)) {
      edgePairMap.set(pairKey, []);
    }
    edgePairMap.get(pairKey)!.push(edge);
  });

  edgePairMap.forEach((pairEdges, pairKey) => {
    if (pairEdges.length > 1) {
      const [sourceId, targetId] = pairKey.split('->');
      const sourceNode = nodes.find((n) => n.id === sourceId);
      const targetNode = nodes.find((n) => n.id === targetId);

      const { isRedundant, reason } = isBinaryRedundantBranch(sourceNode, pairEdges);

      if (isRedundant) {
        const sourceLabel =
          sourceNode?.type === 'question'
            ? `Q#${(sourceNode.data as unknown as QuestionNodeData)?.question_id || sourceId}`
            : sourceNode?.type === 'decision'
            ? 'Decision Node'
            : sourceId;

        const targetLabel =
          targetNode?.type === 'question'
            ? `Q#${(targetNode.data as unknown as QuestionNodeData)?.question_id || targetId}`
            : targetNode?.type === 'end'
            ? 'End Node'
            : targetId;

        // Extract branch descriptors
        const branchLabels = pairEdges.map((e) => {
          if (e.sourceHandle?.startsWith('opt-')) {
            return `"${decodeURIComponent(e.sourceHandle.replace('opt-', ''))}"`;
          }
          if (e.sourceHandle === 'match') return '"Match / True"';
          if (e.sourceHandle === 'else') return '"Else / False"';
          if (e.sourceHandle === 'default-next') return '"Default Next"';
          return e.label ? `"${e.label}"` : 'Branch';
        });

        diagnostics.push({
          id: `conflicting-branches-${pairKey}`,
          type: 'error',
          title: `Redundant binary branches: ${sourceLabel} → ${targetLabel}`,
          description:
            reason ||
            `Opposing options (${branchLabels.join(' and ')}) from ${sourceLabel} both point to ${targetLabel}. If this question should always appear regardless of the answer, remove the conditional branch and use a single unconditional progression instead.`,
          nodeId: sourceId,
          edgeId: pairEdges[0].id,
        });
      }
    }
  });

  // 5. Detect Circular Dependencies (DFS cycle detection)
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  let hasCycle = false;
  const cycleNodes: string[] = [];

  function detectCycle(currentId: string) {
    visited.add(currentId);
    recursionStack.add(currentId);

    const neighbors = outgoingMap.get(currentId) || [];
    for (const edge of neighbors) {
      const nextId = edge.target;
      if (!visited.has(nextId)) {
        detectCycle(nextId);
      } else if (recursionStack.has(nextId)) {
        hasCycle = true;
        cycleNodes.push(currentId, nextId);
      }
    }

    recursionStack.delete(currentId);
  }

  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      detectCycle(n.id);
    }
  });

  if (hasCycle) {
    diagnostics.push({
      id: 'cycle-detected',
      type: 'error',
      title: 'Circular Logic Loop Detected',
      description: 'A loop exists where questions depend on each other cyclically. This will freeze survey rendering.',
      nodeId: cycleNodes[0],
    });
  }

  return diagnostics;
}
