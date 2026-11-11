import { useCallback } from 'react';
import { MarkerType } from '@xyflow/react';
import type { Node, Edge, NodeChange } from '@xyflow/react';
import type { ReusableQuestionGroup } from '../types/group';
import {
  calculateGroupQuestionLayout,
  findNearestNonOverlappingPosition,
  type FrameRect,
} from '../utils/flowLayout';
import { isNodeInContainer } from '../utils/flowValidator';
import type { GroupMeta } from '../utils/schemaCompiler';

interface UseGroupContainersProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setActiveView: (view: 'editor' | 'list' | 'groups') => void;
  setCenter: (x: number, y: number, options?: { zoom?: number; duration?: number }) => void;
  setGroupMeta?: (meta: GroupMeta | ((m: GroupMeta) => GroupMeta)) => void;
}

export function useGroupContainers({
  nodes,
  edges,
  setNodes,
  setEdges,
  onNodesChange,
  setSelectedNodeId,
  setActiveView,
  setCenter,
  setGroupMeta,
}: UseGroupContainersProps) {
  // Synchronized node dragging & cascading deletion: moving/deleting a group container cascades to all child questions
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const extraChanges: NodeChange[] = [];
      const removedChildIds = new Set<string>();
      const removedGroupIds = new Set<string>();

      changes.forEach((change) => {
        if (change.type === 'remove') {
          const node = nodes.find((n) => n.id === change.id);
          if (node && (node.type === 'groupContainer' || node.type === 'groupFrame')) {
            removedGroupIds.add(node.id);
            nodes.forEach((n) => {
              if (isNodeInContainer(n, node, nodes)) {
                removedChildIds.add(n.id);
              }
            });

            removedChildIds.forEach((childId) => {
              extraChanges.push({
                type: 'remove',
                id: childId,
              });
            });
          }
        } else if (change.type === 'position' && change.position) {
          const node = nodes.find((n) => n.id === change.id);
          if (node && (node.type === 'groupContainer' || node.type === 'groupFrame')) {
            // Free movement during drag with lockstep child synchronisation (non-overlap resolved on release)
            const childIdSet = new Set<string>();
            nodes.forEach((n) => {
              if (isNodeInContainer(n, node, nodes)) {
                childIdSet.add(n.id);
              }
            });

            if (childIdSet.size > 0) {
              const dx = change.position.x - node.position.x;
              const dy = change.position.y - node.position.y;
              if (dx !== 0 || dy !== 0) {
                childIdSet.forEach((childId) => {
                  // Guard against double-shifting if this child position was already in the changes array
                  if (changes.some((c) => 'id' in c && c.id === childId && c.type === 'position')) return;
                  const childNode = nodes.find((n) => n.id === childId);
                  if (childNode) {
                    extraChanges.push({
                      type: 'position',
                      id: childId,
                      position: {
                        x: childNode.position.x + dx,
                        y: childNode.position.y + dy,
                      },
                      dragging: change.dragging,
                    });
                  }
                });
              }
            }
          }
        }
      });

      if (removedChildIds.size > 0 || removedGroupIds.size > 0) {
        setEdges((currentEdges) =>
          currentEdges.filter(
            (e) =>
              !removedChildIds.has(e.source) &&
              !removedChildIds.has(e.target) &&
              !removedGroupIds.has(e.source) &&
              !removedGroupIds.has(e.target) &&
              !removedGroupIds.has((e.data as any)?.containerId)
          )
        );
      }

      onNodesChange(extraChanges.length > 0 ? [...changes, ...extraChanges] : changes);
    },
    [nodes, onNodesChange, setEdges]
  );

  // Group Container Handlers: Collapse / Expand, Ungroup, Delete
  const handleToggleGroupCollapse = useCallback(
    (containerNodeId: string) => {
      let willCollapse = false;
      let targetChildIds: string[] = [];

      setNodes((currentNodes) => {
        const containerNode = currentNodes.find((n) => n.id === containerNodeId);
        if (!containerNode || containerNode.type !== 'groupContainer') {
          return currentNodes;
        }

        const isCurrentlyCollapsed = Boolean((containerNode.data as any).isCollapsed);
        willCollapse = !isCurrentlyCollapsed;
        const containerY = containerNode.position.y;
        const containerX = containerNode.position.x;

        // 1. Resolve child nodes for this group container
        const thisGroupChildren = currentNodes.filter(
          (n) => isNodeInContainer(n, containerNode, currentNodes)
        );
        targetChildIds = thisGroupChildren.map((n) => n.id);

        // 2. Compute dynamic layout offsets and expanded height
        const { offsets, totalExpandedHeight } = calculateGroupQuestionLayout(thisGroupChildren);

        // Difference between expanded frame height and collapsed milestone card height (~105px)
        const heightDiff = Math.max(0, totalExpandedHeight - 105);
        const shiftAmount = willCollapse ? -heightDiff : heightDiff;

        // 3. Map ALL group containers and their child questions across canvas
        const childToContainerMap = new Map<string, string>();
        const containerToChildrenMap = new Map<string, string[]>();

        currentNodes.forEach((node) => {
          if (node.type === 'groupContainer') {
            const qIds: string[] = (node.data as any)?.questionIds || [];
            containerToChildrenMap.set(node.id, [...qIds]);
            qIds.forEach((qId) => childToContainerMap.set(qId, node.id));
          }
        });

        currentNodes.forEach((node) => {
          const cId = (node.data as any)?.containerId;
          if (cId) {
            childToContainerMap.set(node.id, cId);
            if (containerToChildrenMap.has(cId)) {
              const list = containerToChildrenMap.get(cId)!;
              if (!list.includes(node.id)) {
                list.push(node.id);
              }
            }
          }
        });

        // 4. Identify downstream top-level nodes (in same vertical column or reachable via edges)
        const downstreamTopLevelIds = new Set<string>();

        // (a) Topological BFS along edges starting from containerNodeId and its child questions
        const edgeVisited = new Set<string>();
        const queue: string[] = [containerNodeId, ...targetChildIds];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          if (edgeVisited.has(curr)) continue;
          edgeVisited.add(curr);

          edges.forEach((edge) => {
            if (edge.source === curr) {
              const targetNode = currentNodes.find((n) => n.id === edge.target);
              if (targetNode) {
                const targetContainerId = childToContainerMap.get(targetNode.id);
                if (targetContainerId && targetContainerId !== containerNodeId) {
                  downstreamTopLevelIds.add(targetContainerId);
                  queue.push(targetContainerId);
                } else if (!targetContainerId && targetNode.id !== containerNodeId) {
                  downstreamTopLevelIds.add(targetNode.id);
                  queue.push(targetNode.id);
                }
              }
            }
          });
        }

        // (b) Also include top-level nodes located directly downstream in the same vertical column
        currentNodes.forEach((n) => {
          if (childToContainerMap.has(n.id)) return;
          if (n.id === containerNodeId) return;

          const isSameColumn = Math.abs(n.position.x - containerX) < 220;
          const isBelow = n.position.y > containerY + 60;
          if (isSameColumn && isBelow) {
            downstreamTopLevelIds.add(n.id);
          }
        });

        // (c) Children belonging to downstream group containers
        const downstreamChildIds = new Set<string>();
        downstreamTopLevelIds.forEach((tlId) => {
          const children = containerToChildrenMap.get(tlId) || [];
          children.forEach((cId) => downstreamChildIds.add(cId));
        });

        // 5. Update nodes immutably
        return currentNodes.map((node) => {
          if (node.id === containerNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                isCollapsed: willCollapse,
                expandedHeight: totalExpandedHeight,
                childOffsets: offsets,
              },
            };
          }

          if (targetChildIds.includes(node.id)) {
            const idx = targetChildIds.indexOf(node.id);
            return {
              ...node,
              hidden: willCollapse,
              position: !willCollapse
                ? {
                  x: containerX + 30,
                  y: containerY + (offsets[idx] ?? (115 + idx * 200)),
                }
                : node.position,
            };
          }

          if (downstreamTopLevelIds.has(node.id)) {
            return {
              ...node,
              position: {
                ...node.position,
                y: node.position.y + shiftAmount,
              },
            };
          }

          if (downstreamChildIds.has(node.id)) {
            return {
              ...node,
              position: {
                ...node.position,
                y: node.position.y + shiftAmount,
              },
            };
          }

          return node;
        });
      });

      setEdges((currentEdges) => {
        return currentEdges.map((edge) => {
          if (
            (edge.data as any)?.containerId === containerNodeId ||
            (targetChildIds.includes(edge.source) && targetChildIds.includes(edge.target))
          ) {
            return {
              ...edge,
              hidden: willCollapse,
            };
          }
          return edge;
        });
      });
    },
    [setNodes, setEdges, edges]
  );

  const handleUngroup = useCallback(
    (containerNodeId: string) => {
      setNodes((currentNodes) => {
        const containerNode = currentNodes.find((n) => n.id === containerNodeId);
        if (!containerNode) return currentNodes;
        const childIds = new Set(
          currentNodes
            .filter((n) => isNodeInContainer(n, containerNode, currentNodes))
            .map((n) => n.id)
        );

        return currentNodes
          .filter((n) => n.id !== containerNodeId)
          .map((n) => {
            if (childIds.has(n.id) || (n.data as any)?.containerId === containerNodeId) {
              return {
                ...n,
                hidden: false,
                data: {
                  ...n.data,
                  containerId: undefined,
                },
              };
            }
            return n;
          });
      });

      setEdges((currentEdges) => {
        return currentEdges.map((e) => {
          if ((e.data as any)?.containerId === containerNodeId) {
            return {
              ...e,
              hidden: false,
              data: {
                ...e.data,
                containerId: undefined,
              },
            };
          }
          return e;
        });
      });
    },
    [setNodes, setEdges]
  );

  const handleDeleteGroupContainer = useCallback(
    (containerNodeId: string) => {
      const deletedNodeIds = new Set<string>([containerNodeId]);

      setNodes((currentNodes) => {
        const containerNode = currentNodes.find((n) => n.id === containerNodeId);
        if (!containerNode) return currentNodes;

        currentNodes.forEach((n) => {
          if (isNodeInContainer(n, containerNode, currentNodes)) {
            deletedNodeIds.add(n.id);
          }
        });

        const remainingNodes = currentNodes.filter((n) => !deletedNodeIds.has(n.id));

        const remainingFrames = remainingNodes.filter(
          (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
        );
        const remainingQuestionGroups = new Set(
          remainingNodes
            .filter((n) => n.type === 'question')
            .map((n) => Number((n.data as any)?.group))
            .filter((g) => !isNaN(g) && g > 0)
        );

        let newTotal = 1;
        if (remainingFrames.length > 0) {
          newTotal = remainingFrames.length;
        } else if (remainingQuestionGroups.size > 1) {
          newTotal = remainingQuestionGroups.size;
        }

        setGroupMeta?.((prev) => ({
          ...prev,
          totalGroups: newTotal,
          hasNextGroup: newTotal > (prev.groupNumber || 1),
        }));

        return remainingNodes;
      });

      setEdges((currentEdges) => {
        return currentEdges.filter(
          (e) =>
            !deletedNodeIds.has(e.source) &&
            !deletedNodeIds.has(e.target) &&
            (e.data as any)?.containerId !== containerNodeId
        );
      });

      setSelectedNodeId(null);
    },
    [setNodes, setEdges, setSelectedNodeId, setGroupMeta]
  );

  // Insert Question Group into canvas wrapped in a modern Figma-style GroupFrameNode
  const handleInsertGroupIntoCanvas = useCallback(
    (
      group: ReusableQuestionGroup,
      targetPos?: { x: number; y: number },
      startCollapsed: boolean = false
    ) => {
      const currentHighestId = nodes.reduce((max, n) => {
        if (n.type === 'question' && (n.data as any)?.question_id) {
          return Math.max(max, Number((n.data as any).question_id) || 0);
        }
        return max;
      }, 100);

      // 1. Identify all existing group frames & avoid numeric group ID collisions
      const existingFrames = nodes.filter(
        (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
      );
      const existingGroupIds = new Set(
        existingFrames
          .map((f) => (f.data as any)?.numericGroupId || parseInt((f.data as any)?.groupId))
          .filter((g) => !isNaN(g) && g > 0)
      );

      // Preserve template's groupId if specified and not colliding; otherwise assign next unused positive ID
      let assignedGroupNumber: number;
      if (group.groupId && !existingGroupIds.has(group.groupId)) {
        assignedGroupNumber = group.groupId;
      } else {
        let candidate = 1;
        while (existingGroupIds.has(candidate)) {
          candidate++;
        }
        assignedGroupNumber = candidate;
      }

      const GROUP_PALETTE = ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
      const frameColor =
        group.color || GROUP_PALETTE[(assignedGroupNumber - 1) % GROUP_PALETTE.length];

      // Prepare other frames rectangles for collision avoidance
      const otherFrames: FrameRect[] = existingFrames.map((f) => {
        const fW =
          (f.style?.width ? parseInt(String(f.style.width), 10) : 0) ||
          f.measured?.width ||
          440;
        const fH =
          (f.style?.height ? parseInt(String(f.style.height), 10) : 0) ||
          f.measured?.height ||
          480;
        return { x: f.position.x, y: f.position.y, w: fW, h: fH };
      });

      // 2. If group has a full flowchart node graph (decisions, processes, terminals, groupFrames, edges)
      if (group.flowNodes && group.flowNodes.length > 0) {
        const minX = Math.min(...group.flowNodes.map((n: Node) => n.position.x));
        const minY = Math.min(...group.flowNodes.map((n: Node) => n.position.y));
        const maxX = Math.max(
          ...group.flowNodes.map(
            (n: Node) =>
              n.position.x +
              ((n.style?.width ? parseInt(String(n.style.width), 10) : 0) || n.measured?.width || 270)
          )
        );
        const maxY = Math.max(
          ...group.flowNodes.map(
            (n: Node) =>
              n.position.y +
              ((n.style?.height ? parseInt(String(n.style.height), 10) : 0) || n.measured?.height || 140)
          )
        );
        const totalW = Math.max(440, maxX - minX);
        const totalH = Math.max(480, maxY - minY);

        let resolvedPos: { x: number; y: number };
        if (targetPos) {
          resolvedPos = findNearestNonOverlappingPosition(
            targetPos.x,
            targetPos.y,
            totalW,
            totalH,
            otherFrames,
            30
          );
        } else {
          const lastFrame = existingFrames[existingFrames.length - 1];
          const fallbackPos = lastFrame
            ? {
              x:
                lastFrame.position.x +
                ((lastFrame.style?.width ? parseInt(String(lastFrame.style.width), 10) : 0) || 440) +
                60,
              y: lastFrame.position.y,
            }
            : { x: 300, y: 150 };
          resolvedPos = findNearestNonOverlappingPosition(
            fallbackPos.x,
            fallbackPos.y,
            totalW,
            totalH,
            otherFrames,
            30
          );
        }

        const offsetX = resolvedPos.x - minX;
        const offsetY = resolvedPos.y - minY;

        let nextQId = currentHighestId + 1;
        const idMap = new Map<string, string>();

        group.flowNodes.forEach((wn: Node) => {
          if (wn.type === 'question') {
            const newQId = nextQId++;
            idMap.set(wn.id, `q-${newQId}`);
          } else if (wn.type === 'groupFrame' || wn.type === 'groupContainer') {
            idMap.set(
              wn.id,
              `grp-frame-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`
            );
          } else {
            idMap.set(
              wn.id,
              `${wn.type}-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`
            );
          }
        });

        const deployedNodes: Node[] = group.flowNodes.map((wn: Node) => {
          const newId = idMap.get(wn.id) || wn.id;
          const newContainerId = (wn.data as any)?.containerId
            ? idMap.get((wn.data as any).containerId) || (wn.data as any).containerId
            : undefined;

          let qId: number | undefined;
          if (wn.type === 'question') {
            const mappedStr = newId.replace('q-', '');
            qId = parseInt(mappedStr, 10);
          }

          let updatedQuestionIds: string[] | undefined;
          if (Array.isArray((wn.data as any)?.questionIds)) {
            updatedQuestionIds = (wn.data as any).questionIds.map(
              (oldId: string) => idMap.get(oldId) || oldId
            );
          }

          const isFrame = wn.type === 'groupFrame' || wn.type === 'groupContainer';

          return {
            ...wn,
            id: newId,
            type: isFrame ? 'groupFrame' : wn.type,
            position: {
              x: Math.round(wn.position.x + offsetX),
              y: Math.round(wn.position.y + offsetY),
            },
            zIndex: isFrame ? 0 : 10,
            style: isFrame
              ? {
                width: (wn.style?.width ? parseInt(String(wn.style.width), 10) : 0) || 440,
                height: (wn.style?.height ? parseInt(String(wn.style.height), 10) : 0) || 480,
              }
              : wn.style,
            selected: isFrame,
            data: {
              ...wn.data,
              ...(newContainerId ? { containerId: newContainerId } : {}),
              ...(qId ? { question_id: qId } : {}),
              ...(updatedQuestionIds
                ? { questionIds: updatedQuestionIds, questionCount: updatedQuestionIds.length }
                : {}),
              ...(isFrame
                ? {
                  groupId: newId,
                  numericGroupId: assignedGroupNumber,
                  title: (wn.data as any)?.title || group.name,
                  titleBn: (wn.data as any)?.titleBn || group.nameBn || group.name,
                  category: (wn.data as any)?.category || group.category || 'custom',
                  color: (wn.data as any)?.color || frameColor,
                  onToggleCollapse: handleToggleGroupCollapse,
                  onUngroup: handleUngroup,
                  onDeleteGroup: handleDeleteGroupContainer,
                  onDeleteFrame: handleDeleteGroupContainer,
                }
                : {
                  group: assignedGroupNumber,
                  ...(wn.type === 'question'
                    ? { customColor: (wn.data as any)?.customColor || frameColor }
                    : {}),
                }),
            },
          };
        });

        const deployedEdges: Edge[] = (group.flowEdges || []).map((we: Edge) => {
          const newSource = idMap.get(we.source) || we.source;
          const newTarget = idMap.get(we.target) || we.target;
          const newEdgeContainerId = (we.data as any)?.containerId
            ? idMap.get((we.data as any).containerId) || (we.data as any).containerId
            : undefined;
          return {
            ...we,
            id: `edge-${newSource}-${newTarget}-${Date.now().toString().slice(-4)}`,
            source: newSource,
            target: newTarget,
            data: {
              ...we.data,
              ...(newEdgeContainerId ? { containerId: newEdgeContainerId } : {}),
            },
          };
        });

        setNodes((nds) => nds.concat(deployedNodes));
        setEdges((eds) => eds.concat(deployedEdges));

        setGroupMeta?.((prev) => ({
          ...prev,
          totalGroups: Math.max(prev.totalGroups, assignedGroupNumber),
        }));

        const focusNode =
          deployedNodes.find((n) => n.type === 'groupFrame') ||
          deployedNodes[0];
        if (focusNode) {
          setSelectedNodeId(focusNode.id);
          setActiveView('editor');
          setTimeout(() => {
            setCenter(focusNode.position.x + 220, focusNode.position.y + 200, {
              zoom: 0.85,
              duration: 500,
            });
          }, 100);
        }
        return;
      }

      // 3. Standard Template: Insert questions nested neatly inside a 440px wide GroupFrameNode
      const frameId = `grp-frame-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`;
      const frameWidth = 440;
      const questionCount = group.questions?.length || 0;
      const frameHeight = Math.max(480, questionCount * 220 + 80);

      let resolvedPos: { x: number; y: number };
      if (targetPos) {
        resolvedPos = findNearestNonOverlappingPosition(
          targetPos.x,
          targetPos.y,
          frameWidth,
          frameHeight,
          otherFrames,
          30
        );
      } else {
        const lastFrame = existingFrames[existingFrames.length - 1];
        const fallbackPos = lastFrame
          ? {
            x:
              lastFrame.position.x +
              ((lastFrame.style?.width ? parseInt(String(lastFrame.style.width), 10) : 0) || 440) +
              60,
            y: lastFrame.position.y,
          }
          : { x: 300, y: 150 };
        resolvedPos = findNearestNonOverlappingPosition(
          fallbackPos.x,
          fallbackPos.y,
          frameWidth,
          frameHeight,
          otherFrames,
          30
        );
      }

      const questionNodeIds: string[] = [];
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      group.questions.forEach((q, idx) => {
        const qId = currentHighestId + 1 + idx;
        const nodeId = `q-${qId}`;
        questionNodeIds.push(nodeId);

        // Center questions inside 440px frame (440 - 270) / 2 = 85px offset
        newNodes.push({
          id: nodeId,
          type: 'question',
          position: {
            x: resolvedPos.x + 85,
            y: resolvedPos.y + 60 + idx * 220,
          },
          zIndex: 10,
          hidden: startCollapsed,
          data: {
            question_id: qId,
            question: q.question,
            question_bn: q.question_bn || q.question,
            answer_type: q.answer_type,
            mandatory: q.mandatory ?? true,
            editable: q.editable ?? true,
            placeholder: q.placeholder || '',
            hint: q.hint || '',
            options: q.options || '',
            containerId: frameId,
            group: assignedGroupNumber,
            group_name: group.name,
            customColor: frameColor,
          },
        });

        if (idx > 0) {
          const prevNodeId = `q-${currentHighestId + idx}`;
          newEdges.push({
            id: `edge-${prevNodeId}-${nodeId}-${Date.now().toString().slice(-4)}`,
            source: prevNodeId,
            target: nodeId,
            type: 'surveyEdge',
            hidden: startCollapsed,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
            },
            data: {
              rule: 'Next',
              containerId: frameId,
            },
          });
        }
      });

      // The modern Figma-style Group Area Frame Node
      const containerNode: Node = {
        id: frameId,
        type: 'groupFrame',
        position: resolvedPos,
        zIndex: 0,
        style: { width: frameWidth, height: frameHeight },
        selected: true,
        data: {
          groupId: frameId,
          numericGroupId: assignedGroupNumber,
          title: group.name,
          titleBn: group.nameBn || group.name,
          category: group.category || 'custom',
          color: frameColor,
          isCollapsed: startCollapsed,
          questionIds: questionNodeIds,
          questionCount: questionCount,
          expandedHeight: frameHeight,
          onToggleCollapse: handleToggleGroupCollapse,
          onUngroup: handleUngroup,
          onDeleteGroup: handleDeleteGroupContainer,
          onDeleteFrame: handleDeleteGroupContainer,
        },
      };

      setNodes((nds) => nds.concat(containerNode).concat(newNodes));
      setEdges((eds) => eds.concat(newEdges));

      const newTotalGroups = existingFrames.length + 1;
      setGroupMeta?.((prev) => ({
        ...prev,
        totalGroups: newTotalGroups,
        hasNextGroup: newTotalGroups > (prev.groupNumber || 1),
      }));

      setSelectedNodeId(frameId);
      setActiveView('editor');

      setTimeout(() => {
          setCenter(resolvedPos.x + 220, resolvedPos.y + 200, {
          zoom: 0.85,
          duration: 500,
        });
      }, 100);
    },
    [
    nodes,
    setNodes,
    setEdges,
    setCenter,
    setSelectedNodeId,
    setActiveView,
    setGroupMeta,
    handleToggleGroupCollapse,
    handleUngroup,
    handleDeleteGroupContainer,
    ]
  );

  return {
    handleNodesChange,
    handleToggleGroupCollapse,
    handleUngroup,
    handleDeleteGroupContainer,
    handleInsertGroupIntoCanvas,
  };
}

