import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge, Connection, NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Layers,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Send,
  BoxSelect,
  Crop,
} from 'lucide-react';
import type { FlowNodeType, AnswerType } from '../../types/survey';
import type {
  ReusableQuestionGroup,
  GroupCategory,
  GroupQuestionTemplate,
} from '../../types/group';
import { QuestionNode } from '../nodes/QuestionNode';
import { GroupFrameNode } from '../nodes/GroupFrameNode';
import { DecisionNode } from '../nodes/DecisionNode';
import {
  StartNode,
  EndNode,
  ProcessNode,
  DocumentNode,
  GroupJumpNode,
} from '../nodes/ControlNodes';
import { CustomFlowchartEdge } from '../edges/CustomFlowchartEdge';
import { createNewQuestionGroup } from '../../utils/groupStorage';
import { resolveNodeGroupId } from '../../utils/flowValidator';

export interface WorkshopBridge {
  updateNodeData: (nodeId: string, newData: any) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (node: Node) => void;
  updateEdgeData: (edgeId: string, newEdgeData: any) => void;
  deleteEdge: (edgeId: string) => void;
}

export interface GroupWorkshopCanvasProps {
  height: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  isResizing?: boolean;
  onDeployGroupToSurvey: (
    group: ReusableQuestionGroup,
    workshopNodes?: Node[],
    workshopEdges?: Edge[]
  ) => void;
  onSaveToLibrary?: (group: ReusableQuestionGroup) => void;
  theme: 'dark' | 'light';
  onSelectNode?: (node: Node | null) => void;
  onSelectEdge?: (edge: Edge | null) => void;
  onWorkshopNodesChange?: (nodes: Node[]) => void;
  onWorkshopEdgesChange?: (edges: Edge[]) => void;
  onRegisterBridge?: (bridge: WorkshopBridge | null) => void;
}

const nodeTypes = {
  question: QuestionNode,
  groupFrame: GroupFrameNode,
  decision: DecisionNode,
  start: StartNode,
  end: EndNode,
  process: ProcessNode,
  document: DocumentNode,
  groupJump: GroupJumpNode,
};

const edgeTypes = {
  surveyEdge: CustomFlowchartEdge,
};

const CATEGORIES: { value: GroupCategory; label: string }[] = [
  { value: 'kyc', label: 'KYC & Demographics' },
  { value: 'land', label: 'Land & Plots' },
  { value: 'crop', label: 'Crops & Yields' },
  { value: 'financial', label: 'Financial & Loan' },
  { value: 'verification', label: 'Field Verification' },
  { value: 'custom', label: 'Custom' },
];

const SWATCHES = [
  '#0284c7', // Sky Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
];

// Inner Workshop Component (wrapped inside ReactFlowProvider)
const WorkshopFlowCanvasInner: React.FC<GroupWorkshopCanvasProps> = ({
  height,
  isOpen,
  onToggleOpen,
  isResizing,
  onDeployGroupToSurvey,
  onSaveToLibrary,
  theme,
  onSelectNode,
  onSelectEdge,
  onWorkshopNodesChange,
  onWorkshopEdgesChange,
  onRegisterBridge,
}) => {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Group Metadata State
  const [groupName, setGroupName] = useState('Land & Cultivation Details');
  const [groupNameBn, setGroupNameBn] = useState('আবাদি জমি ও চাষাবাদ তথ্য');
  const [numericGroupId, setNumericGroupId] = useState<number>(2);
  const [category, setCategory] = useState<GroupCategory>('land');
  const [color, setColor] = useState('#10b981');

  // Initial group frame area node
  const initialFrameNode: Node = useMemo(
    () => ({
      id: 'frame-workshop-1',
      type: 'groupFrame',
      position: { x: 80, y: 60 },
      style: { width: 440, height: 480 },
      data: {
        groupId: 'grp-area-1',
        numericGroupId: 2,
        title: 'Land & Cultivation Details',
        titleBn: 'আবাদি জমি ও চাষাবাদ তথ্য',
        category: 'land',
        color: '#10b981',
        questionIds: [],
        questionCount: 0,
      },
    }),
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([initialFrameNode]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Synchronized Frame Dragging: moving a frame moves its child questions
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const extraChanges: NodeChange[] = [];

      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          const node = nodes.find((n) => n.id === change.id);
          if (node && node.type === 'groupFrame') {
            const childNodes = nodes.filter(
              (n) => (n.data as any)?.containerId === node.id
            );

            if (childNodes.length > 0) {
              const dx = change.position.x - node.position.x;
              const dy = change.position.y - node.position.y;
              if (dx !== 0 || dy !== 0) {
                childNodes.forEach((child) => {
                  extraChanges.push({
                    type: 'position',
                    id: child.id,
                    position: {
                      x: child.position.x + dx,
                      y: child.position.y + dy,
                    },
                    dragging: change.dragging,
                  });
                });
              }
            }
          }
        }
      });

      onNodesChange(extraChanges.length > 0 ? [...changes, ...extraChanges] : changes);
    },
    [nodes, onNodesChange]
  );

  // Connect edges inside workshop
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      const sourceGroup = resolveNodeGroupId(sourceNode, nodes, numericGroupId);
      const targetGroup = resolveNodeGroupId(targetNode, nodes, numericGroupId);
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
              isCrossGroup,
              sourceGroup: isCrossGroup ? sourceGroup : undefined,
              targetGroup: isCrossGroup ? targetGroup : undefined,
            },
          },
          eds
        )
      );
    },
    [nodes, numericGroupId, setEdges]
  );

  // Node, Edge, Pane selection handlers for opening the right inspector
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: n.id === node.id,
        }))
      );
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          selected: false,
        }))
      );
      onSelectNode?.(node);
      onSelectEdge?.(null);
    },
    [onSelectNode, onSelectEdge, setNodes, setEdges]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          selected: e.id === edge.id,
        }))
      );
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: false,
        }))
      );
      onSelectEdge?.(edge);
      onSelectNode?.(null);
    },
    [onSelectEdge, onSelectNode, setEdges, setNodes]
  );

  const onPaneClick = useCallback(() => {
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)));
    setEdges((eds) => eds.map((e) => (e.selected ? { ...e, selected: false } : e)));
    onSelectNode?.(null);
    onSelectEdge?.(null);
  }, [onSelectNode, onSelectEdge, setNodes, setEdges]);

  // Sync nodes and edges with parent for real-time inspector reflection
  useEffect(() => {
    onWorkshopNodesChange?.(nodes);
  }, [nodes, onWorkshopNodesChange]);

  useEffect(() => {
    onWorkshopEdgesChange?.(edges);
  }, [edges, onWorkshopEdgesChange]);

  // Register bridge for inspector updates
  useEffect(() => {
    if (!onRegisterBridge) return;
    onRegisterBridge({
      updateNodeData: (nodeId: string, newData: any) => {
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  ...newData,
                },
              };
            }
            return node;
          })
        );
      },
      deleteNode: (nodeId: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
        onSelectNode?.(null);
      },
      duplicateNode: (node: Node) => {
        const newNodeId = `w-copy-${Date.now().toString().slice(-4)}`;
        const duplicatedNode: Node = {
          ...node,
          id: newNodeId,
          position: { x: node.position.x + 30, y: node.position.y + 30 },
          selected: true,
          data: {
            ...node.data,
            question_id: Math.floor(1000 + Math.random() * 9000),
          },
        };
        setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), duplicatedNode]);
        onSelectNode?.(duplicatedNode);
      },
      updateEdgeData: (edgeId: string, newEdgeData: any) => {
        setEdges((eds) =>
          eds.map((edge) => {
            if (edge.id === edgeId) {
              let label = edge.label;
              if (newEdgeData.label !== undefined) {
                label = newEdgeData.label;
              } else if (newEdgeData.validationType && newEdgeData.triggerValue) {
                label = `${newEdgeData.validationType.toUpperCase()} "${newEdgeData.triggerValue}"`;
              }
              return {
                ...edge,
                label,
                data: { ...edge.data, ...newEdgeData },
              };
            }
            return edge;
          })
        );
      },
      deleteEdge: (edgeId: string) => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        onSelectEdge?.(null);
      },
    });

    return () => {
      onRegisterBridge(null);
    };
  }, [onRegisterBridge, onSelectNode, onSelectEdge, setNodes, setEdges]);

  // Add a new Group Frame Area
  const handleAddGroupArea = useCallback(() => {
    const newFrameId = `frame-${Date.now().toString().slice(-4)}`;
    const newGroupId = numericGroupId + 1;
    setNumericGroupId(newGroupId);

    const newFrame: Node = {
      id: newFrameId,
      type: 'groupFrame',
      position: { x: nodes.length * 80 + 100, y: 60 },
      style: { width: 440, height: 480 },
      data: {
        groupId: `grp-area-${newGroupId}`,
        numericGroupId: newGroupId,
        title: groupName || `Group ${newGroupId}`,
        titleBn: groupNameBn || `গ্রুপ ${newGroupId}`,
        category,
        color,
        questionIds: [],
        questionCount: 0,
      },
    };

    setNodes((nds) => [...nds, newFrame]);
  }, [numericGroupId, groupName, groupNameBn, category, color, nodes.length, setNodes]);

  // Marquee Area Drawing & Grouping States
  const [isMarqueeMode, setIsMarqueeMode] = useState(false);
  const [marquee, setMarquee] = useState<{
    originX: number;
    originY: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    flowStartX: number;
    flowStartY: number;
    flowCurrentX: number;
    flowCurrentY: number;
  } | null>(null);

  // Group currently selected questions into a Group Area Frame
  const handleGroupSelectionIntoFrame = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected && n.type !== 'groupFrame');
    if (selectedNodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedNodes.forEach((n) => {
      const w = n.measured?.width || 270;
      const h = n.measured?.height || 180;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    });

    const padding = 40;
    const frameX = minX - padding;
    const frameY = minY - 55;
    const frameW = Math.max(340, maxX - minX + padding * 2);
    const frameH = Math.max(220, maxY - minY + 55 + padding);

    const newFrameId = `frame-${Date.now().toString().slice(-4)}`;
    const newGroupId = numericGroupId + 1;
    setNumericGroupId(newGroupId);

    const newFrame: Node = {
      id: newFrameId,
      type: 'groupFrame',
      position: { x: Math.round(frameX), y: Math.round(frameY) },
      style: { width: Math.round(frameW), height: Math.round(frameH) },
      selected: true,
      data: {
        groupId: `grp-area-${newGroupId}`,
        numericGroupId: newGroupId,
        title: groupName || `Group ${newGroupId}`,
        titleBn: groupNameBn || `গ্রুপ ${newGroupId}`,
        category,
        color,
        questionIds: selectedNodes.map((n) => n.id),
        questionCount: selectedNodes.length,
      },
    };

    setNodes((nds) => {
      const updatedNodes = nds.map((n) => {
        if (selectedNodes.some((s) => s.id === n.id)) {
          return {
            ...n,
            selected: false,
            data: {
              ...n.data,
              containerId: newFrameId,
              group: newGroupId,
            },
          };
        }
        return n;
      });
      return [newFrame, ...updatedNodes];
    });
  }, [nodes, numericGroupId, groupName, groupNameBn, category, color, setNodes]);

  // Keyboard shortcut listener for Cmd/Ctrl+G and 'F'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleGroupSelectionIntoFrame();
      } else if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsMarqueeMode((prev) => !prev);
      } else if (e.key === 'Escape' && isMarqueeMode) {
        setIsMarqueeMode(false);
        setMarquee(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGroupSelectionIntoFrame, isMarqueeMode]);

  // Pointer/Mouse handlers for drawing the marquee area directly on canvas
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isMarqueeMode && !e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (
        target.closest('.react-flow__node') ||
        target.closest('.react-flow__controls') ||
        target.closest('.workshop-quick-form') ||
        target.closest('button')
      ) {
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const originX = rect.left;
      const originY = rect.top;
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setMarquee({
        originX,
        originY,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        flowStartX: flowPos.x,
        flowStartY: flowPos.y,
        flowCurrentX: flowPos.x,
        flowCurrentY: flowPos.y,
      });
    },
    [isMarqueeMode, screenToFlowPosition]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!marquee) return;
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setMarquee((prev) =>
        prev
          ? {
            ...prev,
            currentX: e.clientX,
            currentY: e.clientY,
            flowCurrentX: flowPos.x,
            flowCurrentY: flowPos.y,
          }
          : null
      );
    },
    [marquee, screenToFlowPosition]
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (!marquee) return;

    const minX = Math.min(marquee.flowStartX, marquee.flowCurrentX);
    const maxX = Math.max(marquee.flowStartX, marquee.flowCurrentX);
    const minY = Math.min(marquee.flowStartY, marquee.flowCurrentY);
    const maxY = Math.max(marquee.flowStartY, marquee.flowCurrentY);
    const drawnWidth = maxX - minX;
    const drawnHeight = maxY - minY;

    if (drawnWidth >= 40 && drawnHeight >= 40) {
      // Find questions/symbols located within this drawn area
      const capturedQuestions = nodes.filter((n) => {
        if (n.type === 'groupFrame') return false;
        const nx = n.position.x;
        const ny = n.position.y;
        return nx >= minX - 50 && nx <= maxX && ny >= minY - 50 && ny <= maxY;
      });

      const newFrameId = `frame-${Date.now().toString().slice(-4)}`;
      const newGroupId = numericGroupId + 1;
      setNumericGroupId(newGroupId);

      const frameW = Math.max(340, Math.round(drawnWidth));
      const frameH = Math.max(220, Math.round(drawnHeight));

      const newFrame: Node = {
        id: newFrameId,
        type: 'groupFrame',
        position: { x: Math.round(minX), y: Math.round(minY) },
        style: { width: frameW, height: frameH },
        selected: true,
        data: {
          groupId: `grp-area-${newGroupId}`,
          numericGroupId: newGroupId,
          title: groupName || `Group ${newGroupId}`,
          titleBn: groupNameBn || `গ্রুপ ${newGroupId}`,
          category,
          color,
          questionIds: capturedQuestions.map((q) => q.id),
          questionCount: capturedQuestions.length,
        },
      };

      setNodes((nds) => {
        const updated = nds.map((n) => {
          if (capturedQuestions.some((q) => q.id === n.id)) {
            return {
              ...n,
              data: {
                ...n.data,
                containerId: newFrameId,
                group: newGroupId,
              },
            };
          }
          return { ...n, selected: false };
        });
        return [...updated, newFrame];
      });
    }

    setMarquee(null);
    setIsMarqueeMode(false);
  }, [marquee, nodes, numericGroupId, groupName, groupNameBn, category, color, setNodes]);

  // Safe boundary extraction helper for resizable and styled frames
  const getFrameBounds = useCallback((frameNode: Node) => {
    let width = 440;
    let height = 480;

    if (typeof frameNode.width === 'number' && !isNaN(frameNode.width) && frameNode.width > 0) {
      width = frameNode.width;
    } else if (frameNode.measured?.width && frameNode.measured.width > 0) {
      width = frameNode.measured.width;
    } else if (frameNode.style?.width) {
      const parsed = parseInt(String(frameNode.style.width), 10);
      if (!isNaN(parsed) && parsed > 0) width = parsed;
    } else if ((frameNode.data as any)?.width) {
      const parsed = parseInt(String((frameNode.data as any).width), 10);
      if (!isNaN(parsed) && parsed > 0) width = parsed;
    }

    if (typeof frameNode.height === 'number' && !isNaN(frameNode.height) && frameNode.height > 0) {
      height = frameNode.height;
    } else if (frameNode.measured?.height && frameNode.measured.height > 0) {
      height = frameNode.measured.height;
    } else if (frameNode.style?.height) {
      const parsed = parseInt(String(frameNode.style.height), 10);
      if (!isNaN(parsed) && parsed > 0) height = parsed;
    } else if ((frameNode.data as any)?.height) {
      const parsed = parseInt(String((frameNode.data as any).height), 10);
      if (!isNaN(parsed) && parsed > 0) height = parsed;
    }

    return {
      minX: frameNode.position.x,
      maxX: frameNode.position.x + width,
      minY: frameNode.position.y,
      maxY: frameNode.position.y + height,
      width,
      height,
    };
  }, []);

  // Drag and Drop Handling (Spatial Bounding-Box Detection & Snapping)
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      // 1. Handle dragging a Question Group from the Groups library
      const rawGroupData = event.dataTransfer.getData('application/reactflow-question-group');
      if (rawGroupData) {
        try {
          const group: ReusableQuestionGroup = JSON.parse(rawGroupData);
          if (group && group.questions) {
            setGroupName(group.name);
            setGroupNameBn(group.nameBn || group.name);
            setCategory(group.category);
            setColor(group.color);
            if (group.groupId) {
              setNumericGroupId(group.groupId);
            }
            const frameNode = nodes.find((n) => n.type === 'groupFrame') || initialFrameNode;
            const newQNodes: Node[] = group.questions.map((q, idx) => {
              const qId = idx + 1;
              const nId = `wq-${qId}-${Date.now().toString().slice(-4)}`;
              return {
                id: nId,
                type: 'question',
                position: {
                  x: frameNode.position.x + 85,
                  y: frameNode.position.y + 60 + idx * 190,
                },
                zIndex: 10,
                data: {
                  question_id: qId,
                  group: group.groupId || numericGroupId,
                  containerId: frameNode.id,
                  question: q.question,
                  question_bn: q.question_bn || q.question,
                  answer_type: q.answer_type || 'string',
                  mandatory: q.mandatory ?? true,
                  editable: q.editable ?? true,
                  options: q.options || '',
                  placeholder: q.placeholder || '',
                  hint: q.hint || '',
                },
              };
            });

            const newQEdges: Edge[] = [];
            for (let i = 0; i < newQNodes.length - 1; i++) {
              newQEdges.push({
                id: `wedge-${newQNodes[i].id}-${newQNodes[i + 1].id}`,
                source: newQNodes[i].id,
                sourceHandle: 'default-next',
                target: newQNodes[i + 1].id,
                targetHandle: 'in',
                type: 'surveyEdge',
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 14,
                  height: 14,
                  color: group.color || '#10b981',
                },
                style: { stroke: group.color || '#10b981', strokeWidth: 2 },
              });
            }

            const updatedFrame: Node = {
              ...frameNode,
              style: {
                ...frameNode.style,
                height: Math.max(480, 60 + newQNodes.length * 190 + 40),
              },
              data: {
                ...frameNode.data,
                title: group.name,
                titleBn: group.nameBn || group.name,
                category: group.category,
                color: group.color,
                numericGroupId: group.groupId || numericGroupId,
                questionIds: newQNodes.map((n) => n.id),
                questionCount: newQNodes.length,
              },
            };

            setNodes([updatedFrame, ...newQNodes]);
            setEdges(newQEdges);
            return;
          }
        } catch (err) {
          console.error('Failed to parse question group in workshop:', err);
        }
      }

      // 2. Handle dragging individual flowchart symbols or input types
      const rawData =
        event.dataTransfer.getData('application/reactflow-node') ||
        event.dataTransfer.getData('text/plain');
      if (!rawData) return;

      let parsed: any;
      try {
        parsed = JSON.parse(rawData);
      } catch {
        return;
      }

      const { nodeType, answerType, name, nameBn, options } = parsed as {
        nodeType: FlowNodeType;
        answerType?: AnswerType;
        name?: string;
        nameBn?: string;
        options?: string;
      };

      if (!nodeType) return;

      // If user dropped a group frame symbol
      if (nodeType === 'groupFrame' || parsed.standardSymbol?.includes('Frame')) {
        handleAddGroupArea();
        return;
      }

      let flowPos = { x: 200, y: 150 };
      try {
        const pos = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        if (pos && !isNaN(pos.x) && !isNaN(pos.y)) {
          flowPos = pos;
        }
      } catch (err) {
        console.warn('screenToFlowPosition error in workshop canvas:', err);
      }

      // Spatial Detection: Is this dropped inside any Group Frame Area?
      const targetFrame = nodes.find((n) => {
        if (n.type !== 'groupFrame') return false;
        const bounds = getFrameBounds(n);
        return (
          flowPos.x >= bounds.minX &&
          flowPos.x <= bounds.maxX &&
          flowPos.y >= bounds.minY &&
          flowPos.y <= bounds.maxY
        );
      });

      // Smart Resolution:
      // If pointer wasn't strictly within the exact pixel bounding box of a frame,
      // fallback to the active/selected frame, or the only frame on this workbench.
      let resolvedTargetFrame = targetFrame;
      if (!resolvedTargetFrame) {
        const frameNodes = nodes.filter((n) => n.type === 'groupFrame');
        if (frameNodes.length === 1) {
          resolvedTargetFrame = frameNodes[0];
        } else if (frameNodes.length > 1) {
          resolvedTargetFrame = frameNodes.find((n) => n.selected) || frameNodes[0];
        }
      }

      // Generate Node ID
      const currentHighestId = nodes.reduce((max, n) => {
        if (n.type === 'question' && (n.data as any)?.question_id) {
          return Math.max(max, Number((n.data as any).question_id) || 0);
        }
        return max;
      }, 0);

      const newQId = currentHighestId + 1;
      const newNodeId =
        nodeType === 'question'
          ? `wq-${newQId}-${Date.now().toString().slice(-4)}`
          : `w-${nodeType}-${Date.now().toString().slice(-4)}`;

      // Calculate placement: snap neatly inside frame or at flowPos
      let nodePosition = flowPos;
      if (resolvedTargetFrame) {
        const bounds = getFrameBounds(resolvedTargetFrame);
        const existingChildIds = (resolvedTargetFrame.data as any)?.questionIds || [];
        const xOffset = Math.max(35, Math.floor((bounds.width - 270) / 2));
        nodePosition = {
          x: resolvedTargetFrame.position.x + xOffset,
          y: resolvedTargetFrame.position.y + 60 + existingChildIds.length * 190,
        };
      }

      let nodeData: any = {};
      if (nodeType === 'question') {
        nodeData = {
          question_id: newQId,
          group: resolvedTargetFrame ? (resolvedTargetFrame.data as any).numericGroupId : numericGroupId,
          containerId: resolvedTargetFrame ? resolvedTargetFrame.id : undefined,
          question: name || `Question ${newQId}`,
          question_bn: nameBn || name || `প্রশ্ন ${newQId}`,
          answer_type: answerType || 'string',
          mandatory: true,
          editable: true,
          options: options || (answerType === 'radio' ? 'হ্যাঁ, না' : ''),
        };
      } else if (nodeType === 'decision') {
        nodeData = {
          label: name || 'Condition Check',
          conditionType: 'match',
          comparisonValue: 'Yes',
          containerId: resolvedTargetFrame ? resolvedTargetFrame.id : undefined,
        };
      } else if (nodeType === 'groupJump') {
        nodeData = {
          targetGroupId: numericGroupId + 1,
          targetGroupTitle: `Group ${numericGroupId + 1}`,
          containerId: resolvedTargetFrame ? resolvedTargetFrame.id : undefined,
        };
      } else {
        nodeData = {
          label: name || nodeType.toUpperCase(),
          containerId: resolvedTargetFrame ? resolvedTargetFrame.id : undefined,
        };
      }

      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        position: nodePosition,
        zIndex: 10,
        data: nodeData,
      };

      setNodes((nds) => {
        const nextNodes = [...nds, newNode];
        // If dropped inside a frame, update frame question count, height, and remove drop target
        if (resolvedTargetFrame) {
          return nextNodes.map((n) => {
            if (n.id === resolvedTargetFrame.id) {
              const prevIds = (n.data as any).questionIds || [];
              const updatedIds = [...prevIds, newNodeId];
              const count = updatedIds.length;
              const bounds = getFrameBounds(n);
              const neededHeight = Math.max(bounds.height, 60 + count * 190 + 40);

              return {
                ...n,
                style: {
                  ...n.style,
                  height: neededHeight,
                },
                data: {
                  ...n.data,
                  questionIds: updatedIds,
                  questionCount: count,
                  isDropTarget: false,
                },
              };
            }
            if (n.type === 'groupFrame') {
              return {
                ...n,
                data: {
                  ...n.data,
                  isDropTarget: false,
                },
              };
            }
            return n;
          });
        }
        return nextNodes;
      });

      // Auto-connect sequential nodes inside the frame
      if (resolvedTargetFrame) {
        const existingQuestionIds = (resolvedTargetFrame.data as any).questionIds || [];
        if (existingQuestionIds.length > 0) {
          const lastQId = existingQuestionIds[existingQuestionIds.length - 1];
          const newEdge: Edge = {
            id: `wedge-${lastQId}-${newNodeId}`,
            source: lastQId,
            sourceHandle: 'default-next',
            target: newNodeId,
            targetHandle: 'in',
            type: 'surveyEdge',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 14,
              height: 14,
              color: '#10b981',
            },
            style: { stroke: '#10b981', strokeWidth: 2 },
          };
          setEdges((eds) => [...eds, newEdge]);
        }
      }
    },
    [nodes, screenToFlowPosition, handleAddGroupArea, numericGroupId, getFrameBounds, initialFrameNode, setNodes, setEdges]
  );

  // Auto-arrange questions inside the frame vertically
  const handleAutoArrangeFrame = useCallback(() => {
    const frameNodes = nodes.filter((n) => n.type === 'groupFrame');
    if (frameNodes.length === 0) return;

    // If a specific frame is selected, snap only that frame; otherwise snap all frames
    const selectedFrame = frameNodes.find((n) => n.selected);
    const targetFrames = selectedFrame ? [selectedFrame] : frameNodes;

    setNodes((nds) => {
      let updatedNodes = [...nds];

      targetFrames.forEach((frame) => {
        const bounds = getFrameBounds(frame);
        // Find all child nodes belonging to this frame (or unassigned nodes if single frame)
        const childNodes = updatedNodes
          .filter((n) => {
            if (n.type === 'groupFrame') return false;
            if ((n.data as any)?.containerId === frame.id) return true;
            if (frameNodes.length === 1) return true;
            return false;
          })
          .sort((a, b) => a.position.y - b.position.y);

        if (childNodes.length === 0) return;

        const xOffset = Math.max(35, Math.floor((bounds.width - 270) / 2));
        const neededHeight = Math.max(bounds.height, 70 + childNodes.length * 190 + 40);

        updatedNodes = updatedNodes.map((n) => {
          // If this is one of the child nodes, snap position & container
          const childIdx = childNodes.findIndex((c) => c.id === n.id);
          if (childIdx !== -1) {
            return {
              ...n,
              position: {
                x: frame.position.x + xOffset,
                y: frame.position.y + 70 + childIdx * 190,
              },
              data: {
                ...n.data,
                containerId: frame.id,
                group: (frame.data as any)?.numericGroupId || numericGroupId,
              },
            };
          }

          // If this is the frame node, update height & question metadata
          if (n.id === frame.id) {
            return {
              ...n,
              style: {
                ...n.style,
                height: neededHeight,
              },
              data: {
                ...n.data,
                questionIds: childNodes.map((c) => c.id),
                questionCount: childNodes.length,
              },
            };
          }

          return n;
        });
      });

      return updatedNodes;
    });

    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 60);
  }, [nodes, getFrameBounds, numericGroupId, setNodes, fitView]);

  // Clear Workbench
  const handleClear = useCallback(() => {
    if (window.confirm('Clear all draft nodes on the Group Creation Workbench?')) {
      setNodes([initialFrameNode]);
      setEdges([]);
    }
  }, [initialFrameNode, setNodes, setEdges]);

  // Deploy Group to Main Survey Flow (deploying ALL symbols: questions, decisions, processes, start/end, documents, etc.)
  const handleDeploy = useCallback(() => {
    const nonFrameNodes = nodes.filter((n) => n.type !== 'groupFrame');

    if (nonFrameNodes.length === 0) {
      alert('Add at least one question or flowchart symbol inside the group frame before deploying to the main survey.');
      return;
    }

    const questionNodes = nodes.filter((n) => n.type === 'question');
    const templates: GroupQuestionTemplate[] = questionNodes.map((q) => {
      const d = q.data as any;
      return {
        question: d.question || 'Question',
        question_bn: d.question_bn || d.question || 'প্রশ্ন',
        answer_type: d.answer_type || 'string',
        mandatory: d.mandatory ?? true,
        editable: d.editable ?? true,
        options: d.options || '',
        placeholder: d.placeholder || '',
        hint: d.hint || '',
      };
    });

    const newGroup: ReusableQuestionGroup = {
      ...createNewQuestionGroup(
        groupName.trim() || 'Custom Group',
        groupNameBn.trim() || groupName.trim() || 'গ্রুপ তথ্য',
        `Authored in Group Workshop Canvas (${nonFrameNodes.length} symbols, ${questionNodes.length} questions).`,
        category,
        color,
        templates,
        numericGroupId
      ),
      flowNodes: nodes,
      flowEdges: edges,
    };

    // Save to library
    if (onSaveToLibrary) {
      onSaveToLibrary(newGroup);
    }

    // Deploy to main flowchart canvas with ALL symbols, frames, and connections!
    onDeployGroupToSurvey(newGroup, nodes, edges);
  }, [
    nodes,
    edges,
    groupName,
    groupNameBn,
    category,
    color,
    numericGroupId,
    onSaveToLibrary,
    onDeployGroupToSurvey,
  ]);

  return (
    <div
      className={`workshop-dock-root ${isOpen ? 'is-open' : 'is-collapsed'} ${isResizing ? 'is-resizing' : ''
        }`}
      style={{ height: isOpen ? `${height}px` : '36px' }}
    >
      {/* Workshop Top Header Bar */}
      <div className="workshop-dock-header" onDoubleClick={onToggleOpen}>
        <div className="workshop-header-left">
          <div className="workshop-badge">
            <Layers size={14} className="text-emerald" />
            <span className="workshop-title">Group Creation Workbench Canvas</span>
          </div>

          <span className="workshop-status-pill">
            {nodes.filter((n) => n.type === 'question').length} Questions Drafted
          </span>

          {isOpen && (
            <div className="workshop-quick-form">
              <input
                type="text"
                className="workshop-input bn-font"
                placeholder="বাংলা নাম"
                value={groupNameBn}
                onChange={(e) => setGroupNameBn(e.target.value)}
                title="Bengali Group Name"
              />
              <input
                type="text"
                className="workshop-input"
                placeholder="English Name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                title="English Group Name"
              />
              <input
                type="number"
                className="workshop-input-num"
                placeholder="ID"
                value={numericGroupId}
                onChange={(e) => setNumericGroupId(parseInt(e.target.value) || 1)}
                title="Numeric Group ID"
              />
              <select
                className="workshop-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as GroupCategory)}
                title="Category"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <div className="workshop-swatches">
                {SWATCHES.map((hex) => (
                  <span
                    key={hex}
                    className={`workshop-swatch ${color === hex ? 'is-active' : ''}`}
                    style={{ backgroundColor: hex }}
                    onClick={() => setColor(hex)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="workshop-header-right">
          {isOpen && (
            <>
              <button
                type="button"
                className={`btn-workshop-action ${isMarqueeMode ? 'is-active text-emerald' : ''}`}
                onClick={() => setIsMarqueeMode((prev) => !prev)}
                title="Draw Area Frame: Drag a marquee box on canvas to create group frame (Shortcut: F or Shift+Drag)"
                style={isMarqueeMode ? { borderColor: 'var(--emerald)', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)', fontWeight: 700 } : undefined}
              >
                <Crop size={12} />
                <span>{isMarqueeMode ? 'Drawing Area...' : 'Draw Area [F]'}</span>
              </button>

              {nodes.some((n) => n.selected && n.type !== 'groupFrame') && (
                <button
                  type="button"
                  className="btn-workshop-action text-emerald"
                  onClick={handleGroupSelectionIntoFrame}
                  title="Wrap selected questions into a Group Area Frame (Ctrl+G)"
                  style={{ borderColor: 'var(--emerald)', background: 'rgba(16, 185, 129, 0.12)', fontWeight: 700 }}
                >
                  <BoxSelect size={12} />
                  <span>Group Selected (Ctrl+G)</span>
                </button>
              )}

              <button
                type="button"
                className="btn-workshop-action"
                onClick={handleAddGroupArea}
                title="Draw / Place an additional Group Area Frame"
              >
                <Plus size={12} />
                <span>+ Group Area</span>
              </button>

              <button
                type="button"
                className="btn-workshop-action"
                onClick={handleAutoArrangeFrame}
                title="Auto-organize questions inside the group area"
              >
                <LayoutGrid size={12} />
                <span>Snap Layout</span>
              </button>

              <button
                type="button"
                className="btn-workshop-action text-danger"
                onClick={handleClear}
                title="Clear draft workbench"
              >
                <Trash2 size={12} />
              </button>

              <button
                type="button"
                className="btn btn-primary btn-workshop-deploy"
                onClick={handleDeploy}
                title="Package and deploy this group onto the main survey flow"
              >
                <Send size={12} />
                <span>Deploy to Main Survey</span>
              </button>
            </>
          )}

          <button
            type="button"
            className="dock-toggle-btn"
            onClick={onToggleOpen}
            title={isOpen ? 'Collapse Group Workshop' : 'Expand Group Workshop'}
          >
            {isOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {/* Workshop Canvas Container */}
      {isOpen && (
        <div
          className="workshop-canvas-wrap"
          ref={canvasRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          style={{ cursor: isMarqueeMode ? 'crosshair' : undefined }}
        >
          {/* Live Marquee Drawing Selection Overlay */}
          {marquee && (
            <div
              className="workshop-marquee-box"
              style={{
                position: 'absolute',
                left: Math.min(marquee.startX - marquee.originX, marquee.currentX - marquee.originX),
                top: Math.min(marquee.startY - marquee.originY, marquee.currentY - marquee.originY),
                width: Math.abs(marquee.currentX - marquee.startX),
                height: Math.abs(marquee.currentY - marquee.startY),
                border: '2px dashed #10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.14)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 8px 24px rgba(16, 185, 129, 0.25)',
                borderRadius: '6px',
                pointerEvents: 'none',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                padding: '6px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  background: '#10b981',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }}
              >
                <span>Group Frame:</span>
                <span>
                  {Math.round(Math.abs(marquee.flowCurrentX - marquee.flowStartX))} × {Math.round(Math.abs(marquee.flowCurrentY - marquee.flowStartY))} px
                </span>
              </div>
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            panOnDrag={isMarqueeMode ? false : true}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{
              type: 'surveyEdge',
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 14,
                height: 14,
              },
            }}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            className="workshop-react-flow"
          >
            <Controls className="flow-controls" showInteractive={false} position="bottom-right" />
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color={theme === 'light' ? '#cbd5e1' : '#334155'}
            />
          </ReactFlow>
        </div>
      )}
    </div>
  );
};

// Outer wrapper ensuring an independent ReactFlowProvider for the lower canvas
export const GroupWorkshopCanvas: React.FC<GroupWorkshopCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkshopFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
};
