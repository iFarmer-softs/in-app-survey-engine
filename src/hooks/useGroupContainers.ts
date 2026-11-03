import { useCallback } from 'react';
import { MarkerType } from '@xyflow/react';
import type { Node, Edge, NodeChange } from '@xyflow/react';
import type { ReusableQuestionGroup } from '../types/group';
import { calculateGroupQuestionLayout } from '../utils/flowLayout';

interface UseGroupContainersProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setActiveView: (view: 'editor' | 'list' | 'groups') => void;
  setCenter: (x: number, y: number, options?: { zoom?: number; duration?: number }) => void;
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
            const childIds: string[] = (node.data as any)?.questionIds || [];
            childIds.forEach((cid) => removedChildIds.add(cid));

            const frameWidth = Number(node.style?.width) || (node.data as any)?.width || 440;
            const frameHeight = Number(node.style?.height) || (node.data as any)?.height || 480;
            const fx = node.position.x;
            const fy = node.position.y;

            nodes.forEach((n) => {
              if (n.id !== node.id) {
                if ((n.data as any)?.containerId === node.id) {
                  removedChildIds.add(n.id);
                } else if (
                  n.position.x >= fx - 10 &&
                  n.position.x <= fx + frameWidth + 10 &&
                  n.position.y >= fy - 10 &&
                  n.position.y <= fy + frameHeight + 10
                ) {
                  removedChildIds.add(n.id);
                }
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
            const childIds: string[] =
              (node.data as any)?.questionIds ||
              nodes
                .filter((n) => (n.data as any)?.containerId === node.id)
                .map((n) => n.id);

            if (childIds.length > 0) {
              const dx = change.position.x - node.position.x;
              const dy = change.position.y - node.position.y;
              if (dx !== 0 || dy !== 0) {
                childIds.forEach((childId) => {
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
        const rawChildIds: string[] = (containerNode.data as any).questionIds || [];
        const thisGroupChildren = currentNodes.filter(
          (n) => rawChildIds.includes(n.id) || (n.data as any)?.containerId === containerNodeId
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
        const childIds: string[] = (containerNode.data as any).questionIds || [];

        return currentNodes
          .filter((n) => n.id !== containerNodeId)
          .map((n) => {
            if (childIds.includes(n.id) || (n.data as any)?.containerId === containerNodeId) {
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
        
        // 1. Explicit child IDs
        const childIds: string[] = (containerNode.data as any).questionIds || [];
        childIds.forEach((id) => deletedNodeIds.add(id));

        // 2. Nodes pointing to containerId
        currentNodes.forEach((n) => {
          if ((n.data as any)?.containerId === containerNodeId) {
            deletedNodeIds.add(n.id);
          }
        });

        // 3. Spatially contained nodes within the frame
        const frameWidth = Number(containerNode.style?.width) || (containerNode.data as any)?.width || 440;
        const frameHeight = Number(containerNode.style?.height) || (containerNode.data as any)?.height || 480;
        const fx = containerNode.position.x;
        const fy = containerNode.position.y;

        currentNodes.forEach((n) => {
          if (n.id !== containerNodeId) {
            if (
              n.position.x >= fx - 10 &&
              n.position.x <= fx + frameWidth + 10 &&
              n.position.y >= fy - 10 &&
              n.position.y <= fy + frameHeight + 10
            ) {
              deletedNodeIds.add(n.id);
            }
          }
        });

        return currentNodes.filter((n) => !deletedNodeIds.has(n.id));
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
    [setNodes, setEdges, setSelectedNodeId]
  );

  // Insert Question Group into canvas wrapped in a collapsible GroupContainerNode
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

      const lastNode = nodes[nodes.length - 1];
      const startX = targetPos ? targetPos.x : (lastNode ? lastNode.position.x : 350);
      const startY = targetPos ? targetPos.y : (lastNode ? lastNode.position.y + 180 : 150);

      // If group has a full flowchart node graph (decisions, processes, start/end, documents, groupFrames, edges)
      if (group.flowNodes && group.flowNodes.length > 0) {
        const minX = Math.min(...group.flowNodes.map((n: Node) => n.position.x));
        const minY = Math.min(...group.flowNodes.map((n: Node) => n.position.y));
        const offsetX = startX - minX;
        const offsetY = startY - minY;

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

          return {
            ...wn,
            id: newId,
            position: {
              x: Math.round(wn.position.x + offsetX),
              y: Math.round(wn.position.y + offsetY),
            },
            selected: wn.type === 'groupFrame' || wn.type === 'groupContainer',
            data: {
              ...wn.data,
              ...(newContainerId ? { containerId: newContainerId } : {}),
              ...(qId ? { question_id: qId } : {}),
              ...(updatedQuestionIds
                ? { questionIds: updatedQuestionIds, questionCount: updatedQuestionIds.length }
                : {}),
            },
          };
        });

        const deployedEdges: Edge[] = (group.flowEdges || []).map((we: Edge) => {
          const newSource = idMap.get(we.source) || we.source;
          const newTarget = idMap.get(we.target) || we.target;
          return {
            ...we,
            id: `edge-${newSource}-${newTarget}-${Date.now().toString().slice(-4)}`,
            source: newSource,
            target: newTarget,
            data: { ...we.data },
          };
        });

        setNodes((nds) => nds.concat(deployedNodes));
        setEdges((eds) => eds.concat(deployedEdges));

        const focusNode =
          deployedNodes.find((n) => n.type === 'groupFrame' || n.type === 'groupContainer') ||
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

      const containerId = `grp-container-${Date.now().toString().slice(-5)}`;
      const questionNodeIds: string[] = [];
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      const { offsets, totalExpandedHeight } = calculateGroupQuestionLayout(group.questions);

      group.questions.forEach((q, idx) => {
        const qId = currentHighestId + 1 + idx;
        const nodeId = `q-${qId}`;
        questionNodeIds.push(nodeId);

        newNodes.push({
          id: nodeId,
          type: 'question',
          position: {
            x: startX + 40,
            y: startY + offsets[idx],
          },
          hidden: startCollapsed,
          data: {
            question_id: qId,
            question: q.question,
            question_bn: q.question_bn,
            answer_type: q.answer_type,
            mandatory: q.mandatory ?? true,
            editable: q.editable ?? true,
            placeholder: q.placeholder || '',
            hint: q.hint || '',
            options: q.options || '',
            containerId,
            group: group.groupId || 1,
            group_name: group.name,
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
              containerId,
            },
          });
        }
      });

      // The Group Container Node (framing header with collapse/expand toggle)
      const containerNode: Node = {
        id: containerId,
        type: 'groupContainer',
        position: { x: startX, y: startY },
        data: {
          groupId: group.id,
          numericGroupId: group.groupId || 1,
          title: group.name,
          titleBn: group.nameBn,
          category: group.category,
          color: group.color,
          isCollapsed: startCollapsed,
          questionIds: questionNodeIds,
          questionCount: group.questions.length,
          expandedHeight: totalExpandedHeight,
          childOffsets: offsets,
          onToggleCollapse: handleToggleGroupCollapse,
          onUngroup: handleUngroup,
          onDeleteGroup: handleDeleteGroupContainer,
        },
      };

      setNodes((nds) => nds.concat(containerNode).concat(newNodes));
      setEdges((eds) => eds.concat(newEdges));

      setSelectedNodeId(containerId);
      setActiveView('editor');

      setTimeout(() => {
        setCenter(startX + 140, startY + 90, {
          zoom: 0.9,
          duration: 500,
        });
      }, 100);
    },
    [nodes, setNodes, setEdges, setCenter, setSelectedNodeId, setActiveView, handleToggleGroupCollapse, handleUngroup, handleDeleteGroupContainer]
  );

  return {
    handleNodesChange,
    handleToggleGroupCollapse,
    handleUngroup,
    handleDeleteGroupContainer,
    handleInsertGroupIntoCanvas,
  };
}

