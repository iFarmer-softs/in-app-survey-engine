import { useState, useCallback } from 'react';
import { addEdge, MarkerType } from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import type { WarningAlertData } from '../components/modals/WarningAlertModal';
import { isBinaryRedundantBranch, resolveNodeGroupId } from '../utils/flowValidator';

interface UseFlowCanvasConnectionsProps {
  nodes: Node[];
  edges: Edge[];
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
}

export function useFlowCanvasConnections({
  nodes,
  edges,
  setEdges,
}: UseFlowCanvasConnectionsProps) {
  const [warningAlertData, setWarningAlertData] = useState<WarningAlertData | null>(null);
  const [edgeRouting, setEdgeRouting] = useState<'smoothstep' | 'bezier' | 'straight'>('smoothstep');

  const onConnect = useCallback(
    (params: Connection) => {
      // Guard against connecting multiple opposing/different branches from the same source to the same target
      const existingEdge = edges.find(
        (e) => e.source === params.source && e.target === params.target
      );

      if (existingEdge) {
        // If connecting the exact same handle, do nothing
        if (existingEdge.sourceHandle === params.sourceHandle) {
          return;
        }

        const sourceNode = nodes.find((n) => n.id === params.source);
        const targetNode = nodes.find((n) => n.id === params.target);

        // Check if this connection forms an invalid binary redundancy (Yes/No, True/False, Match/Else)
        const existingEdgesForPair = edges.filter(
          (e) => e.source === params.source && e.target === params.target
        );
        const candidateEdges = [
          ...existingEdgesForPair,
          { sourceHandle: params.sourceHandle } as Edge,
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
          const newBranch = formatHandle(params.sourceHandle);

          const sourceLabel =
            sourceNode?.type === 'question'
              ? `Q#${(sourceNode.data as any)?.question_id || params.source}`
              : sourceNode?.type === 'decision'
              ? 'Decision Node'
              : params.source;

          const targetLabel =
            targetNode?.type === 'question'
              ? `Q#${(targetNode.data as any)?.question_id || params.target}`
              : targetNode?.type === 'end'
              ? 'End Node'
              : params.target;

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

      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      const sourceGroup = resolveNodeGroupId(sourceNode, nodes, 1);
      const targetGroup = resolveNodeGroupId(targetNode, nodes, 1);
      const isCrossGroup =
        sourceNode?.type !== 'groupJump' &&
        targetNode?.type !== 'groupJump' &&
        sourceGroup !== targetGroup;

      let edgeLabel: string | undefined = undefined;
      let strokeColor = isCrossGroup ? '#8b5cf6' : '#10b981';
      let triggerVal = '';

      if (params.sourceHandle && params.sourceHandle.startsWith('opt-')) {
        triggerVal = decodeURIComponent(params.sourceHandle.replace('opt-', ''));
        edgeLabel = `IF "${triggerVal}"`;
        if (!isCrossGroup) strokeColor = '#f59e0b';
      } else if (params.sourceHandle === 'match') {
        edgeLabel = 'MATCH';
        if (!isCrossGroup) strokeColor = '#f59e0b';
      } else if (params.sourceHandle === 'else') {
        edgeLabel = 'ELSE';
        if (!isCrossGroup) strokeColor = '#ec4899';
      }

      if (isCrossGroup) {
        edgeLabel = edgeLabel
          ? `[G${sourceGroup}➔G${targetGroup}] ${edgeLabel}`
          : `Cross-Group: G${sourceGroup} ➔ G${targetGroup}`;
      }

      setEdges((eds) =>
        addEdge(
          {
            ...params,
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
    [edges, nodes, setEdges, edgeRouting]
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

  return {
    warningAlertData,
    setWarningAlertData,
    edgeRouting,
    handleChangeEdgeRouting,
    onConnect,
  };
}

