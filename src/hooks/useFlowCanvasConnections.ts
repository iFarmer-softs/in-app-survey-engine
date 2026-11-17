import { useState, useCallback } from 'react';
import { addEdge, reconnectEdge, MarkerType } from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import type { WarningAlertData } from '../components/modals/WarningAlertModal';
import { isBinaryRedundantBranch, resolveNodeGroupId } from '../utils/flowValidator';

interface UseFlowCanvasConnectionsProps {
  nodes: Node[];
  edges: Edge[];
  setNodes?: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  onContainmentWarning?: (msg: string) => void;
}

export function useFlowCanvasConnections({
  nodes,
  edges,
  setNodes,
  setEdges,
  onContainmentWarning,
}: UseFlowCanvasConnectionsProps) {
  const [warningAlertData, setWarningAlertData] = useState<WarningAlertData | null>(null);
  const [edgeRouting, setEdgeRouting] = useState<'smoothstep' | 'bezier' | 'straight'>('smoothstep');

  const onConnect = useCallback(
    (params: Connection) => {
      let actualSource = params.source;
      let actualTarget = params.target;
      let actualSourceHandle = params.sourceHandle;
      let actualTargetHandle = params.targetHandle;

      let sourceNode = nodes.find((n) => n.id === actualSource);
      let targetNode = nodes.find((n) => n.id === actualTarget);
      let sourceGroup = resolveNodeGroupId(sourceNode, nodes, 1);
      let targetGroup = resolveNodeGroupId(targetNode, nodes, 1);

      // Detect and auto-correct reverse connections:
      // 1. Dragged from input port ('in*') to output port ('out*', 'opt-*', 'default-next')
      // 2. Intra-group: dragged from groupJump to question (flow must always be Question ➔ GroupJump)
      // 3. Cross-group: dragged from question to groupJump (GroupJump in source group ➔ Question in target group)
      const isReverseHandle =
        Boolean(actualSourceHandle?.startsWith('in')) &&
        Boolean(
          actualTargetHandle?.startsWith('out') ||
          actualTargetHandle?.startsWith('opt-') ||
          actualTargetHandle === 'default-next'
        );

      const isReverseGroupJumpIntra =
        sourceNode?.type === 'groupJump' &&
        targetNode?.type === 'question' &&
        sourceGroup === targetGroup;

      const isReverseGroupJumpCross =
        sourceNode?.type === 'question' &&
        targetNode?.type === 'groupJump' &&
        sourceGroup !== targetGroup;

      if (isReverseHandle || isReverseGroupJumpIntra || isReverseGroupJumpCross) {
        actualSource = params.target;
        actualTarget = params.source;
        actualSourceHandle = params.targetHandle;
        actualTargetHandle = params.sourceHandle;
        sourceNode = nodes.find((n) => n.id === actualSource);
        targetNode = nodes.find((n) => n.id === actualTarget);
        sourceGroup = resolveNodeGroupId(sourceNode, nodes, 1);
        targetGroup = resolveNodeGroupId(targetNode, nodes, 1);
      }

      // Guard against connecting multiple opposing/different branches from the same source to the same target
      const existingEdge = edges.find(
        (e) => e.source === actualSource && e.target === actualTarget
      );

      if (existingEdge) {
        // If connecting the exact same handle, do nothing
        if (existingEdge.sourceHandle === actualSourceHandle) {
          return;
        }

        // Check if this connection forms an invalid binary redundancy (Yes/No, True/False, Match/Else)
        const existingEdgesForPair = edges.filter(
          (e) => e.source === actualSource && e.target === actualTarget
        );
        const candidateEdges = [
          ...existingEdgesForPair,
          { sourceHandle: actualSourceHandle } as Edge,
        ];

        const { isRedundant, reason } = isBinaryRedundantBranch(sourceNode, candidateEdges);

        if (isRedundant) {
          const formatHandle = (handleId: string | null | undefined) => {
            if (!handleId || handleId === 'default-next') return 'Default Next';
            if (handleId.startsWith('opt-')) {
              return `"${decodeURIComponent(handleId.replace('opt-', ''))}"`;
            }
            if (handleId === 'match') return '"Match / True"';
            if (handleId === 'else') return '"Else / False"';
            return `"${handleId}"`;
          };

          const existingBranch = formatHandle(existingEdge.sourceHandle);
          const newBranch = formatHandle(actualSourceHandle);

          const sourceLabel =
            sourceNode?.type === 'question'
              ? `Q#${(sourceNode.data as any)?.question_id || actualSource}`
              : sourceNode?.type === 'decision'
                ? 'Decision Node'
                : actualSource;

          const targetLabel =
            targetNode?.type === 'question'
              ? `Q#${(targetNode.data as any)?.question_id || actualTarget}`
              : targetNode?.type === 'end'
                ? 'End Node'
                : actualTarget;

          setWarningAlertData({
            title: 'Binary Opposing Branches Cannot Point to Same Flow',
            sourceLabel,
            targetLabel,
            existingBranch,
            newBranch,
            message: reason,
          });
          return;
        }
      }

      const isCrossGroup = sourceGroup !== targetGroup;

      const isQuestionToQuestion =
        sourceNode?.type === 'question' && targetNode?.type === 'question';
      const isGroupJump =
        sourceNode?.type === 'groupJump' || targetNode?.type === 'groupJump';
      const isDecision =
        sourceNode?.type === 'decision' || targetNode?.type === 'decision';

      // Internal connectors cannot cross group border, but question connectors, decision branches, and Group Connectors can cross border
      if (isCrossGroup && !isQuestionToQuestion && !isGroupJump && !isDecision) {
        if (onContainmentWarning) {
          onContainmentWarning('Only question connectors, decision branches, and Group Connectors can cross group borders.');
        }
        const sourceLabel =
          sourceNode?.type === 'question'
            ? `Q#${(sourceNode.data as any)?.question_id || actualSource}`
            : (sourceNode?.data as any)?.label || sourceNode?.type || actualSource;
        const targetLabel =
          targetNode?.type === 'question'
            ? `Q#${(targetNode.data as any)?.question_id || actualTarget}`
            : (targetNode?.data as any)?.label || targetNode?.type || actualTarget;

        setWarningAlertData({
          title: 'Connectors Cannot Cross Group Border',
          sourceLabel,
          targetLabel,
          existingBranch: `Group #${sourceGroup}`,
          newBranch: `Group #${targetGroup}`,
          message:
            'Internal connectors cannot cross the group border. Only question connectors, decision branches, and Group Connectors are allowed to connect across group borders.',
        });
        return;
      }

      let edgeLabel: string | undefined = undefined;
      let strokeColor = isCrossGroup ? '#8b5cf6' : '#10b981';
      let triggerVal = '';

      if (actualSourceHandle && actualSourceHandle.startsWith('opt-')) {
        triggerVal = decodeURIComponent(actualSourceHandle.replace('opt-', ''));
        edgeLabel = `IF "${triggerVal}"`;
        if (!isCrossGroup) strokeColor = '#f59e0b';
      } else if (actualSourceHandle === 'match') {
        edgeLabel = 'MATCH';
        if (!isCrossGroup) strokeColor = '#f59e0b';
      } else if (actualSourceHandle === 'else') {
        edgeLabel = 'ELSE';
        if (!isCrossGroup) strokeColor = '#ec4899';
      }

      if (isCrossGroup) {
        edgeLabel = edgeLabel
          ? `[G${sourceGroup}➔G${targetGroup}] ${edgeLabel}`
          : `Cross-Group: G${sourceGroup} ➔ G${targetGroup}`;
      }

      // Flexible port auto-resolution for cross-group connections
      let resolvedSourceHandle = actualSourceHandle;
      let resolvedTargetHandle = actualTargetHandle;

      if (isCrossGroup && sourceNode && targetNode) {
        const sX = sourceNode.position.x;
        const sY = sourceNode.position.y;
        const tX = targetNode.position.x;
        const tY = targetNode.position.y;
        const dx = tX - sX;
        const dy = tY - sY;

        // Auto-resolve GroupJump exit port if not explicitly chosen
        if (sourceNode.type === 'groupJump' && (!resolvedSourceHandle || resolvedSourceHandle === 'default-next')) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            resolvedSourceHandle = dx > 0 ? 'out-right' : 'out-left';
          } else {
            resolvedSourceHandle = dy > 0 ? 'default-next' : 'out-top';
          }
        }

        // Auto-resolve target port if not explicitly chosen or is default 'in'
        if (!resolvedTargetHandle || resolvedTargetHandle === 'in') {
          if (Math.abs(dx) >= Math.abs(dy)) {
            resolvedTargetHandle = dx > 0 ? 'in-left' : 'in-right';
          } else {
            resolvedTargetHandle = dy > 0 ? 'in' : 'in-bottom';
          }
        }
      }

      // Auto-bind target group on GroupJumpNode when connecting outward
      if (sourceNode?.type === 'groupJump' && setNodes) {
        const targetFrame = nodes.find(
          (n) =>
            (n.type === 'groupFrame' || n.type === 'groupContainer') &&
            ((n.data as any)?.numericGroupId === targetGroup || (n.data as any)?.groupId === String(targetGroup))
        );
        const targetGroupTitle = targetFrame
          ? ((targetFrame.data as any)?.titleBn || (targetFrame.data as any)?.title || `Group ${targetGroup}`)
          : `Group ${targetGroup}`;
        const targetQuestionId = targetNode?.type === 'question' ? (targetNode.data as any)?.question_id : undefined;

        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === sourceNode.id) {
              const currentData = (n.data as any) || {};
              return {
                ...n,
                data: {
                  ...currentData,
                  targetGroupId: targetGroup,
                  targetGroupTitle,
                  ...(targetQuestionId !== undefined ? { targetQuestionId } : {}),
                },
              };
            }
            return n;
          })
        );
      }

      setEdges((eds) =>
        addEdge(
          {
            source: actualSource,
            target: actualTarget,
            sourceHandle: resolvedSourceHandle,
            targetHandle: resolvedTargetHandle,
            type: 'surveyEdge',
            animated: true,
            label: edgeLabel,
            style: {
              stroke: strokeColor,
              strokeWidth: 2,
              strokeDasharray: isCrossGroup || strokeColor === '#f59e0b' ? '5 5' : undefined,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color: strokeColor,
            },
            data: {
              validationType: 'match',
              triggerValue: triggerVal,
              routingType: edgeRouting,
              isCrossGroup,
              sourceGroup: isCrossGroup ? sourceGroup : undefined,
              targetGroup: isCrossGroup ? targetGroup : undefined,
            },
          },
          eds
        )
      );
    },
    [edges, nodes, setEdges, setNodes, edgeRouting, onContainmentWarning]
  );

  const handleChangeEdgeRouting = useCallback(
    (routing: 'smoothstep' | 'bezier' | 'straight') => {
      setEdgeRouting(routing);
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          data: {
            ...e.data,
            routingType: routing,
          },
        }))
      );
    },
    [setEdges]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target) return;

      let actualSource = newConnection.source;
      let actualTarget = newConnection.target;
      let actualSourceHandle = newConnection.sourceHandle;
      let actualTargetHandle = newConnection.targetHandle;

      let sourceNode = nodes.find((n) => n.id === actualSource);
      let targetNode = nodes.find((n) => n.id === actualTarget);
      let sourceGroup = resolveNodeGroupId(sourceNode, nodes, 1);
      let targetGroup = resolveNodeGroupId(targetNode, nodes, 1);

      // Detect and auto-correct reverse connections on reconnect
      const isReverseHandle =
        Boolean(actualSourceHandle?.startsWith('in')) &&
        Boolean(
          actualTargetHandle?.startsWith('out') ||
          actualTargetHandle?.startsWith('opt-') ||
          actualTargetHandle === 'default-next'
        );

      const isReverseGroupJumpIntra =
        sourceNode?.type === 'groupJump' &&
        targetNode?.type === 'question' &&
        sourceGroup === targetGroup;

      const isReverseGroupJumpCross =
        sourceNode?.type === 'question' &&
        targetNode?.type === 'groupJump' &&
        sourceGroup !== targetGroup;

      if (isReverseHandle || isReverseGroupJumpIntra || isReverseGroupJumpCross) {
        actualSource = newConnection.target;
        actualTarget = newConnection.source;
        actualSourceHandle = newConnection.targetHandle;
        actualTargetHandle = newConnection.sourceHandle;
        sourceNode = nodes.find((n) => n.id === actualSource);
        targetNode = nodes.find((n) => n.id === actualTarget);
        sourceGroup = resolveNodeGroupId(sourceNode, nodes, 1);
        targetGroup = resolveNodeGroupId(targetNode, nodes, 1);
      }

      const isCrossGroup = sourceGroup !== targetGroup;

      const isQuestionToQuestion =
        sourceNode?.type === 'question' && targetNode?.type === 'question';
      const isGroupJump =
        sourceNode?.type === 'groupJump' || targetNode?.type === 'groupJump';
      const isDecision =
        sourceNode?.type === 'decision' || targetNode?.type === 'decision';

      // Internal connectors cannot cross group border, but question connectors, decision branches, and Group Connectors can cross border
      if (isCrossGroup && !isQuestionToQuestion && !isGroupJump && !isDecision) {
        if (onContainmentWarning) {
          onContainmentWarning('Only question connectors, decision branches, and Group Connectors can cross group borders.');
        }
        const sourceLabel =
          sourceNode?.type === 'question'
            ? `Q#${(sourceNode.data as any)?.question_id || actualSource}`
            : (sourceNode?.data as any)?.label || sourceNode?.type || actualSource;
        const targetLabel =
          targetNode?.type === 'question'
            ? `Q#${(targetNode.data as any)?.question_id || actualTarget}`
            : (targetNode?.data as any)?.label || targetNode?.type || actualTarget;

        setWarningAlertData({
          title: 'Connectors Cannot Cross Group Border',
          sourceLabel,
          targetLabel,
          existingBranch: `Group #${sourceGroup}`,
          newBranch: `Group #${targetGroup}`,
          message:
            'Internal connectors cannot cross the group border. Only question connectors, decision branches, and Group Connectors are allowed to connect across group borders.',
        });
        return;
      }

      let strokeColor = isCrossGroup ? '#8b5cf6' : '#10b981';
      let edgeLabel = oldEdge.label as string | undefined;

      if (actualSourceHandle && actualSourceHandle.startsWith('opt-')) {
        const triggerVal = decodeURIComponent(actualSourceHandle.replace('opt-', ''));
        edgeLabel = `IF "${triggerVal}"`;
        if (!isCrossGroup) strokeColor = '#f59e0b';
      } else if (actualSourceHandle === 'match') {
        edgeLabel = 'MATCH';
        if (!isCrossGroup) strokeColor = '#f59e0b';
      } else if (actualSourceHandle === 'else') {
        edgeLabel = 'ELSE';
        if (!isCrossGroup) strokeColor = '#ec4899';
      }

      if (isCrossGroup) {
        edgeLabel = edgeLabel
          ? `[G${sourceGroup}➔G${targetGroup}] ${edgeLabel}`
          : `Cross-Group: G${sourceGroup} ➔ G${targetGroup}`;
      }

      // Flexible target handle resolution for cross-group reconnected edge
      let resolvedSourceHandle = actualSourceHandle;
      let resolvedTargetHandle = actualTargetHandle;

      if (isCrossGroup && sourceNode && targetNode) {
        const sX = sourceNode.position.x;
        const sY = sourceNode.position.y;
        const tX = targetNode.position.x;
        const tY = targetNode.position.y;
        const dx = tX - sX;
        const dy = tY - sY;

        if (sourceNode.type === 'groupJump' && (!resolvedSourceHandle || resolvedSourceHandle === 'default-next')) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            resolvedSourceHandle = dx > 0 ? 'out-right' : 'out-left';
          } else {
            resolvedSourceHandle = dy > 0 ? 'default-next' : 'out-top';
          }
        }

        if (!resolvedTargetHandle || resolvedTargetHandle === 'in') {
          if (Math.abs(dx) >= Math.abs(dy)) {
            resolvedTargetHandle = dx > 0 ? 'in-left' : 'in-right';
          } else {
            resolvedTargetHandle = dy > 0 ? 'in' : 'in-bottom';
          }
        }
      }

      // Auto-bind target group on GroupJumpNode when reconnected
      if (sourceNode?.type === 'groupJump' && setNodes) {
        const targetFrame = nodes.find(
          (n) =>
            (n.type === 'groupFrame' || n.type === 'groupContainer') &&
            ((n.data as any)?.numericGroupId === targetGroup || (n.data as any)?.groupId === String(targetGroup))
        );
        const targetGroupTitle = targetFrame
          ? ((targetFrame.data as any)?.titleBn || (targetFrame.data as any)?.title || `Group ${targetGroup}`)
          : `Group ${targetGroup}`;
        const targetQuestionId = targetNode?.type === 'question' ? (targetNode.data as any)?.question_id : undefined;

        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === sourceNode.id) {
              const currentData = (n.data as any) || {};
              return {
                ...n,
                data: {
                  ...currentData,
                  targetGroupId: targetGroup,
                  targetGroupTitle,
                  ...(targetQuestionId !== undefined ? { targetQuestionId } : {}),
                },
              };
            }
            return n;
          })
        );
      }

      setEdges((eds) =>
        reconnectEdge(
          oldEdge,
          {
            source: actualSource,
            target: actualTarget,
            sourceHandle: resolvedSourceHandle,
            targetHandle: resolvedTargetHandle,
          },
          eds,
          { shouldReplaceId: false }
        ).map((e) => {
          if (e.id === oldEdge.id) {
            return {
              ...e,
              label: edgeLabel,
              style: {
                ...(e.style || {}),
                stroke: strokeColor,
                strokeDasharray: isCrossGroup || strokeColor === '#f59e0b' ? '5 5' : undefined,
              },
              markerEnd: {
                ...(typeof e.markerEnd === 'object' && e.markerEnd !== null
                  ? e.markerEnd
                  : { type: MarkerType.ArrowClosed, width: 16, height: 16 }),
                color: strokeColor,
              },
              data: {
                ...(e.data || {}),
                isCrossGroup,
                sourceGroup: isCrossGroup ? sourceGroup : undefined,
                targetGroup: isCrossGroup ? targetGroup : undefined,
                // Reset custom bend coordinates when reconnected so the new path starts clean
                centerX: undefined,
                centerY: undefined,
              },
            };
          }
          return e;
        })
      );
    },
    [nodes, setEdges, setNodes, onContainmentWarning]
  );

  return {
    warningAlertData,
    setWarningAlertData,
    edgeRouting,
    handleChangeEdgeRouting,
    onConnect,
    onReconnect,
  };
}

