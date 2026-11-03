import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  MarkerType,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Layers, Sparkles, PanelLeftOpen, PanelRightOpen, Crop } from 'lucide-react';

import { Header } from './components/layout/Header';
import { GroupTemplateHeader } from './components/layout/GroupTemplateHeader';
import { AdminLeftSidebar } from './components/layout/AdminLeftSidebar';
import { FlowchartSymbolsPanel } from './components/layout/FlowchartSymbolsPanel';
import { InputTypeViewsPanel } from './components/layout/InputTypeViewsPanel';
import { GroupWorkshopCanvas, type WorkshopBridge } from './components/canvas/GroupWorkshopCanvas';
import { FlowchartListView } from './components/dashboard/FlowchartListView';
import { QuestionGroupListView } from './components/groups/QuestionGroupListView';
import { CreateFlowchartModal } from './components/modals/CreateFlowchartModal';
import { CreateGroupModal } from './components/modals/CreateGroupModal';
import { SaveSelectionAsGroupModal } from './components/modals/SaveSelectionAsGroupModal';
import { JsonExportModal } from './components/modals/JsonExportModal';
import { MobilePreviewModal } from './components/modals/MobilePreviewModal';
import { FlowDiagnosticsModal } from './components/modals/FlowDiagnosticsModal';
import { WarningAlertModal } from './components/modals/WarningAlertModal';
import { CustomFlowchartEdge } from './components/edges/CustomFlowchartEdge';

import { QuestionNode } from './components/nodes/QuestionNode';
import { DecisionNode } from './components/nodes/DecisionNode';
import { GroupContainerNode } from './components/nodes/GroupContainerNode';
import { GroupFrameNode } from './components/nodes/GroupFrameNode';
import {
  GroupJumpNode,
  StartNode,
  EndNode,
  ProcessNode,
  DocumentNode,
} from './components/nodes/ControlNodes';

import {
  SAMPLE_INITIAL_SCHEMA,
  parseSchemaToFlow,
  compileFlowToSchema,
} from './utils/schemaCompiler';
import type { GroupMeta } from './utils/schemaCompiler';
import type { DynamicKycGroupResponse, FlowNodeType, AnswerType } from './types/survey';
import type {
  ReusableQuestionGroup,
  GroupCategory,
  GroupQuestionTemplate,
} from './types/group';
import {
  calculateHierarchicalLayout,
  alignNodesHorizontal,
  alignNodesVertical,
} from './utils/flowLayout';
import { validateSurveyFlow } from './utils/flowValidator';

import { useProjectManager } from './hooks/useProjectManager';
import { useGroupStudio } from './hooks/useGroupStudio';
import { useGroupContainers } from './hooks/useGroupContainers';
import { useFlowCanvasConnections } from './hooks/useFlowCanvasConnections';
import { useSidebarResizer } from './hooks/useSidebarResizer';
import { useTheme } from './hooks/useTheme';

const baseNodeTypes = {
  question: QuestionNode,
  decision: DecisionNode,
  groupJump: GroupJumpNode,
  start: StartNode,
  end: EndNode,
  process: ProcessNode,
  document: DocumentNode,
  groupContainer: GroupContainerNode,
  groupFrame: GroupFrameNode,
};

const edgeTypes = {
  surveyEdge: CustomFlowchartEdge,
};

const FlowEditor: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();

  const [activeView, setActiveView] = useState<'editor' | 'list' | 'groups'>('editor');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isSaveSelectionModalOpen, setIsSaveSelectionModalOpen] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Workshop Selection & Bridge State
  const [selectedSource, setSelectedSource] = useState<'main' | 'workshop'>('main');
  const [workshopSelectedNodeId, setWorkshopSelectedNodeId] = useState<string | null>(null);
  const [workshopSelectedEdgeId, setWorkshopSelectedEdgeId] = useState<string | null>(null);
  const [workshopNodes, setWorkshopNodes] = useState<Node[]>([]);
  const [workshopEdges, setWorkshopEdges] = useState<Edge[]>([]);
  const workshopBridgeRef = useRef<WorkshopBridge | null>(null);

  // Sidebar expand / collapse states with persistent localStorage
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('survey_left_sidebar_open') !== 'false';
    } catch {
      return true;
    }
  });

  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('survey_right_sidebar_open') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleLeftSidebar = useCallback(() => {
    setIsLeftSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('survey_left_sidebar_open', String(next));
      } catch {}
      setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
      return next;
    });
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setIsRightSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('survey_right_sidebar_open', String(next));
      } catch {}
      setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
      return next;
    });
  }, []);

  // Draggable sidebar & bottom dock resizer hook (Antigravity Style)
  const {
    leftWidth,
    rightWidth,
    bottomHeight,
    resizingSide,
    startResizingLeft,
    startResizingRight,
    startResizingBottom,
    resetLeftWidth,
    resetRightWidth,
    resetBottomHeight,
  } = useSidebarResizer();

  const [isBottomDockOpen, setIsBottomDockOpen] = useState(true);
  const toggleBottomDock = useCallback(() => {
    setIsBottomDockOpen((prev) => {
      const next = !prev;
      setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
      return next;
    });
  }, []);

  // Dark / Light / System Theme hook
  const { theme, resolvedTheme, setTheme, cycleTheme } = useTheme();

  // Global keyboard shortcuts: Cmd+B (left sidebar), Cmd+J (right inspector)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleLeftSidebar();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleRightSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleLeftSidebar, toggleRightSidebar]);

  // 1. Projects manager hook
  const {
    projects,
    setProjects,
    activeProjectId,
    activeProject,
    refreshProjects,
    handleSelectProject: selectProjectById,
    handleCreateNewProject: createProjectAction,
    handleDuplicateProject,
    handleDeleteProject,
    syncActiveProject,
  } = useProjectManager();

  // 2. React Flow canvas nodes and edges state
  const [nodes, setNodes, onNodesChange] = useNodesState(activeProject?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeProject?.edges || []);
  const [groupMeta, setGroupMeta] = useState<GroupMeta>(
    activeProject?.groupMeta || {
      totalGroups: 1,
      groupNumber: 1,
      hasNextGroup: false,
      instruction: '',
      groupJumps: [],
    }
  );

  // 3. Group template studio hook
  const {
    groups,
    refreshGroups,
    handleDeleteGroup,
    handleResetDefaultGroups,
    groupDesignSession,
    setGroupDesignSession,
    handleStartNewGroupInStudio,
    handleEditGroupInStudio,
    handleExitGroupDesignSession,
    handleSaveGroupDesignSession,
    handleSaveSelectionAsGroup: saveSelectionAsGroupAction,
  } = useGroupStudio({
    activeProjectId,
    nodes,
    edges,
    groupMeta,
    setNodes,
    setEdges,
    setGroupMeta,
    setSelectedNodeId,
    setSelectedEdgeId,
    setActiveView,
    fitView,
  });

  // 4. Group container collapse, ungroup & sync hook
  const {
    handleNodesChange,
    handleToggleGroupCollapse,
    handleUngroup,
    handleDeleteGroupContainer,
    handleInsertGroupIntoCanvas,
  } = useGroupContainers({
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    setSelectedNodeId,
    setActiveView,
    setCenter,
  });

  // 5. Connections & routing hook
  const {
    warningAlertData,
    setWarningAlertData,
    edgeRouting,
    handleChangeEdgeRouting,
    onConnect,
  } = useFlowCanvasConnections({
    nodes,
    edges,
    setEdges,
  });

  // Real-time flow health diagnostics
  const diagnostics = useMemo(() => {
    return validateSurveyFlow(nodes, edges);
  }, [nodes, edges]);

  const diagnosticsErrors = useMemo(
    () => diagnostics.filter((d) => d.type === 'error').length,
    [diagnostics]
  );

  // Sync active project state to storage whenever nodes, edges, or meta changes
  useEffect(() => {
    syncActiveProject(nodes, edges, groupMeta, Boolean(groupDesignSession));
  }, [nodes, edges, groupMeta, groupDesignSession, syncActiveProject]);

  // Switch active project
  const handleSelectProject = useCallback(
    (id: string) => {
      selectProjectById(id, (target) => {
        setNodes(target.nodes);
        setEdges(target.edges);
        setGroupMeta(target.groupMeta);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setActiveView('editor');
        setTimeout(() => fitView({ padding: 0.2 }), 50);
      });
    },
    [selectProjectById, setNodes, setEdges, fitView]
  );

  // Create new blank flowchart
  const handleCreateNewProject = useCallback(
    (
      title: string,
      titleBn: string,
      description: string,
      totalGroups: number
    ) => {
      createProjectAction(title, titleBn, description, totalGroups, (newProj) => {
        setNodes(newProj.nodes);
        setEdges(newProj.edges);
        setGroupMeta(newProj.groupMeta);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setActiveView('editor');
        setTimeout(() => fitView({ padding: 0.2 }), 50);
      });
    },
    [createProjectAction, setNodes, setEdges, fitView]
  );

  // Memoized custom node types with active callbacks
  const nodeTypes = useMemo(
    () => ({
      ...baseNodeTypes,
      groupContainer: (props: any) => (
        <GroupContainerNode
          {...props}
          onToggleCollapse={handleToggleGroupCollapse}
          onUngroup={handleUngroup}
          onDeleteGroup={handleDeleteGroupContainer}
        />
      ),
    }),
    [handleToggleGroupCollapse, handleUngroup, handleDeleteGroupContainer]
  );

  // Derived selected question nodes for "Save Selection as Group"
  const selectedQuestionNodes = useMemo(() => {
    const selected = nodes.filter(
      (n) => (n.selected || n.id === selectedNodeId) && n.type === 'question'
    );
    return [...selected].sort((a, b) => a.position.y - b.position.y);
  }, [nodes, selectedNodeId]);

  const selectedQuestionTemplates: GroupQuestionTemplate[] = useMemo(() => {
    return selectedQuestionNodes.map((n) => {
      const data = n.data as any;
      return {
        question: data.question || 'Untitled Question',
        question_bn: data.question_bn || data.question || '',
        answer_type: data.answer_type || 'string',
        mandatory: data.mandatory ?? true,
        editable: data.editable ?? true,
        placeholder: data.placeholder || '',
        hint: data.hint || '',
        options: data.options || '',
      };
    });
  }, [selectedQuestionNodes]);

  const handleSaveSelectionAsGroup = useCallback(
    (meta: {
      groupId: number;
      name: string;
      nameBn: string;
      description: string;
      category: GroupCategory;
      color: string;
    }) => {
      saveSelectionAsGroupAction(meta, selectedQuestionTemplates, () => {
        setIsSaveSelectionModalOpen(false);
      });
    },
    [saveSelectionAsGroupAction, selectedQuestionTemplates]
  );

  // Instant Wrap Selection in Group Frame directly on canvas (Marquee & Cmd/Ctrl+G)
  const handleWrapSelectionInFrame = useCallback(() => {
    if (selectedQuestionNodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedQuestionNodes.forEach((n) => {
      const w = n.measured?.width || 270;
      const h = n.measured?.height || 200;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    });

    const padding = 35;
    const frameX = minX - padding;
    const frameY = minY - 55;
    const frameW = Math.max(340, maxX - minX + padding * 2);
    const frameH = Math.max(220, maxY - minY + 55 + padding);

    const nextGrpId = groupMeta.groupNumber + 1;
    const newFrameId = `grp-frame-${Date.now().toString().slice(-4)}`;

    const newFrame: Node = {
      id: newFrameId,
      type: 'groupFrame',
      position: { x: Math.round(frameX), y: Math.round(frameY) },
      style: { width: Math.round(frameW), height: Math.round(frameH) },
      zIndex: 0,
      selected: true,
      data: {
        groupId: newFrameId,
        numericGroupId: nextGrpId,
        title: `Group Area ${nextGrpId}`,
        titleBn: `গ্রুপ এলাকা ${nextGrpId}`,
        category: 'custom',
        color: '#8b5cf6',
        questionIds: selectedQuestionNodes.map((n) => n.id),
        questionCount: selectedQuestionNodes.length,
      },
    };

    setNodes((nds) => {
      const updated = nds.map((n) => {
        if (selectedQuestionNodes.some((s) => s.id === n.id)) {
          return {
            ...n,
            selected: false,
            data: {
              ...n.data,
              containerId: newFrameId,
              group: nextGrpId,
            },
          };
        }
        return n;
      });
      return [newFrame, ...updated];
    });

    setSelectedNodeId(newFrameId);
  }, [selectedQuestionNodes, groupMeta.groupNumber, setNodes]);

  // Global hotkey: Cmd/Ctrl + G to wrap selected questions into a Group Frame
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleWrapSelectionInFrame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleWrapSelectionInFrame]);

  // Selected entities across Main Flowchart and Group Workshop canvases
  const activeSelectedNode = useMemo(() => {
    if (selectedSource === 'workshop') {
      return workshopNodes.find((n) => n.id === workshopSelectedNodeId) || null;
    }
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedSource, workshopNodes, workshopSelectedNodeId, nodes, selectedNodeId]);

  const activeSelectedEdge = useMemo(() => {
    if (selectedSource === 'workshop') {
      return workshopEdges.find((e) => e.id === workshopSelectedEdgeId) || null;
    }
    return edges.find((e) => e.id === selectedEdgeId) || null;
  }, [selectedSource, workshopEdges, workshopSelectedEdgeId, edges, selectedEdgeId]);

  const activeNodes = selectedSource === 'workshop' ? workshopNodes : nodes;
  const activeEdges = selectedSource === 'workshop' ? workshopEdges : edges;

  // Selection handlers: auto-open right inspector when an item is selected on Main Canvas
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedSource('main');
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setWorkshopSelectedNodeId(null);
    setWorkshopSelectedEdgeId(null);
    setIsRightSidebarOpen(true);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedSource('main');
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setWorkshopSelectedNodeId(null);
    setWorkshopSelectedEdgeId(null);
    setIsRightSidebarOpen(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // Selection handlers: auto-open right inspector when an item is selected on Group Workshop Canvas
  const handleWorkshopSelectNode = useCallback((node: Node | null) => {
    if (node) {
      setSelectedSource('workshop');
      setWorkshopSelectedNodeId(node.id);
      setWorkshopSelectedEdgeId(null);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setIsRightSidebarOpen(true);
    } else {
      setWorkshopSelectedNodeId(null);
    }
  }, []);

  const handleWorkshopSelectEdge = useCallback((edge: Edge | null) => {
    if (edge) {
      setSelectedSource('workshop');
      setWorkshopSelectedEdgeId(edge.id);
      setWorkshopSelectedNodeId(null);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setIsRightSidebarOpen(true);
    } else {
      setWorkshopSelectedEdgeId(null);
    }
  }, []);

  // Drag-and-drop drop handler
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const rawGroupData = event.dataTransfer.getData('application/reactflow-question-group');
      if (rawGroupData) {
        try {
          const group: ReusableQuestionGroup = JSON.parse(rawGroupData);
          let position = { x: 300, y: 200 };
          try {
            const flowPos = screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            });
            if (flowPos && !isNaN(flowPos.x) && !isNaN(flowPos.y)) {
              position = flowPos;
            }
          } catch (err) {
            console.warn('screenToFlowPosition error, using default:', err);
          }
          handleInsertGroupIntoCanvas(group, position);
          return;
        } catch (err) {
          console.error('Failed to parse question group drag data:', err);
        }
      }

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

      let position = { x: 300, y: 200 };
      try {
        const flowPos = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        if (flowPos && !isNaN(flowPos.x) && !isNaN(flowPos.y)) {
          position = flowPos;
        }
      } catch (err) {
        console.warn('screenToFlowPosition error, using default:', err);
      }

      const currentHighestId = nodes.reduce((max, n) => {
        if (n.type === 'question' && (n.data as any)?.question_id) {
          return Math.max(max, Number((n.data as any).question_id) || 0);
        }
        return max;
      }, 100);

      const newQId = currentHighestId + 1;
      const newNodeId =
        nodeType === 'question'
          ? `q-${newQId}`
          : `${nodeType}-${Date.now().toString().slice(-4)}`;

      let nodeData: any = {};

      // Check if dropped inside an existing group container or frame on the main canvas
      const targetContainer = nodes.find((n) => {
        if (n.type !== 'groupContainer' && n.type !== 'groupFrame') return false;
        let width = 350;
        let height = 400;
        if (n.type === 'groupContainer') {
          width = 350;
          height =
            (n.data as any)?.expandedHeight ||
            Math.max(220, ((n.data as any)?.questionCount || (n.data as any)?.questionIds?.length || 0) * 230 + 100);
        } else if (n.type === 'groupFrame') {
          if (typeof n.width === 'number' && !isNaN(n.width) && n.width > 0) {
            width = n.width;
          } else if (n.measured?.width && n.measured.width > 0) {
            width = n.measured.width;
          } else if (n.style?.width) {
            const parsed = parseInt(String(n.style.width), 10);
            if (!isNaN(parsed) && parsed > 0) width = parsed;
          } else {
            width = 440;
          }

          if (typeof n.height === 'number' && !isNaN(n.height) && n.height > 0) {
            height = n.height;
          } else if (n.measured?.height && n.measured.height > 0) {
            height = n.measured.height;
          } else if (n.style?.height) {
            const parsed = parseInt(String(n.style.height), 10);
            if (!isNaN(parsed) && parsed > 0) height = parsed;
          } else {
            height = 480;
          }
        }
        return (
          position.x >= n.position.x &&
          position.x <= n.position.x + width &&
          position.y >= n.position.y &&
          position.y <= n.position.y + height
        );
      });

      if (nodeType === 'question') {
        const cData = targetContainer?.data as any;
        nodeData = {
          question_id: newQId,
          group: cData ? cData.numericGroupId || parseInt(cData.groupId) || groupMeta.groupNumber : groupMeta.groupNumber,
          containerId: targetContainer ? targetContainer.id : undefined,
          customColor: cData?.color,
          question: name || 'New Question',
          question_bn: nameBn || name || 'নতুন প্রশ্ন',
          answer_type: answerType || 'string',
          mandatory: true,
          editable: true,
          placeholder: '',
          hint: '',
          options: options || '',
        };
      } else if (nodeType === 'groupFrame') {
        const nextGrpId = groupMeta.groupNumber + 1;
        nodeData = {
          groupId: `grp-frame-${Date.now().toString().slice(-4)}`,
          numericGroupId: nextGrpId,
          title: name || `Group Area ${nextGrpId}`,
          titleBn: nameBn || `গ্রুপ এলাকা ${nextGrpId}`,
          category: 'custom',
          color: '#8b5cf6',
          questionIds: [],
          questionCount: 0,
        };
      } else if (nodeType === 'decision') {
        nodeData = {
          label: 'Condition Check',
          conditionType: 'match',
          comparisonValue: 'Yes',
        };
      } else if (nodeType === 'groupJump') {
        nodeData = {
          targetGroupId: groupMeta.groupNumber + 1,
          targetGroupTitle: `Group ${groupMeta.groupNumber + 1}`,
        };
      } else {
        nodeData = {
          label: name || nodeType.toUpperCase(),
        };
      }

      // If dropped inside a container or frame, place it cleanly inside
      let nodePos = position;
      if (targetContainer && nodeType === 'question') {
        const existingChildIds = (targetContainer.data as any)?.questionIds || [];
        const xOffset = targetContainer.type === 'groupFrame' ? 85 : 35;
        nodePos = {
          x: targetContainer.position.x + xOffset,
          y: targetContainer.position.y + 60 + existingChildIds.length * 200,
        };
      }

      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        position: nodePos,
        zIndex: nodeType === 'groupFrame' || nodeType === 'groupContainer' ? 0 : 10,
        style: nodeType === 'groupFrame' ? { width: 440, height: 480 } : undefined,
        data: nodeData,
      };

      setNodes((nds) => {
        const nextNodes = nds.concat(newNode);
        if (targetContainer && nodeType === 'question') {
          return nextNodes.map((n) => {
            if (n.id === targetContainer.id) {
              const prevIds = (n.data as any).questionIds || [];
              const updatedIds = [...prevIds, newNodeId];
              const newCount = updatedIds.length;
              const currentHeight = (n.style?.height ? parseInt(String(n.style.height), 10) : 0) || 220;
              const neededHeight = Math.max(currentHeight, newCount * 220 + 120);
              return {
                ...n,
                style: n.type === 'groupFrame' ? { ...n.style, height: neededHeight } : n.style,
                data: {
                  ...n.data,
                  questionIds: updatedIds,
                  questionCount: newCount,
                  expandedHeight: neededHeight,
                },
              };
            }
            return n;
          });
        }
        return nextNodes;
      });
      setSelectedNodeId(newNodeId);
    },
    [nodes, screenToFlowPosition, setNodes, groupMeta.groupNumber, handleInsertGroupIntoCanvas]
  );

  // Click-to-add from Flowchart Symbols palette
  const handleAddSymbol = useCallback(
    (nodeType: FlowNodeType, name: string, nameBn: string) => {
      const lastNode = nodes[nodes.length - 1];
      const posX = lastNode ? lastNode.position.x : 300;
      const posY = lastNode ? lastNode.position.y + 180 : 150;

      const currentHighestId = nodes.reduce((max, n) => {
        if (n.type === 'question' && (n.data as any)?.question_id) {
          return Math.max(max, Number((n.data as any).question_id) || 0);
        }
        return max;
      }, 100);

      const newQId = currentHighestId + 1;
      const newNodeId =
        nodeType === 'question'
          ? `q-${newQId}`
          : `${nodeType}-${Date.now().toString().slice(-4)}`;

      let nodeData: any = {};
      if (nodeType === 'question') {
        nodeData = {
          question_id: newQId,
          question: name || 'New Question',
          question_bn: nameBn || name || 'নতুন প্রশ্ন',
          answer_type: 'string',
          mandatory: true,
          editable: true,
          placeholder: '',
          hint: '',
          options: '',
        };
      } else if (nodeType === 'groupFrame') {
        const nextGrpId = groupMeta.groupNumber + 1;
        nodeData = {
          groupId: `grp-frame-${Date.now().toString().slice(-4)}`,
          numericGroupId: nextGrpId,
          title: name || `Group Area ${nextGrpId}`,
          titleBn: nameBn || `গ্রুপ এলাকা ${nextGrpId}`,
          category: 'custom',
          color: '#8b5cf6',
          questionIds: [],
          questionCount: 0,
        };
      } else if (nodeType === 'decision') {
        nodeData = {
          label: 'Condition Check',
          conditionType: 'match',
          comparisonValue: 'Yes',
        };
      } else if (nodeType === 'groupJump') {
        nodeData = {
          targetGroupId: groupMeta.groupNumber + 1,
          targetGroupTitle: `Group ${groupMeta.groupNumber + 1}`,
        };
      } else {
        nodeData = {
          label: name || nodeType.toUpperCase(),
        };
      }

      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        position: { x: posX, y: posY },
        zIndex: nodeType === 'groupFrame' || nodeType === 'groupContainer' ? 0 : 10,
        style: nodeType === 'groupFrame' ? { width: 440, height: 480 } : undefined,
        data: nodeData,
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNodeId(newNodeId);
    },
    [nodes, groupMeta.groupNumber, setNodes]
  );

  // Click-to-add from Input Type Views palette
  const handleAddQuestionFromWidget = useCallback(
    (answerType: AnswerType, name: string, nameBn: string, options?: string) => {
      const lastNode = nodes[nodes.length - 1];
      const posX = lastNode ? lastNode.position.x : 300;
      const posY = lastNode ? lastNode.position.y + 180 : 150;

      const currentHighestId = nodes.reduce((max, n) => {
        if (n.type === 'question' && (n.data as any)?.question_id) {
          return Math.max(max, Number((n.data as any).question_id) || 0);
        }
        return max;
      }, 100);

      const newQId = currentHighestId + 1;
      const newNodeId = `q-${newQId}`;

      const newNode: Node = {
        id: newNodeId,
        type: 'question',
        position: { x: posX, y: posY },
        data: {
          question_id: newQId,
          question: name || 'New Question',
          question_bn: nameBn || name || 'নতুন প্রশ্ন',
          answer_type: answerType,
          mandatory: true,
          editable: true,
          placeholder: '',
          hint: '',
          options: options || '',
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNodeId(newNodeId);
    },
    [nodes, setNodes]
  );

  // Update Node Data
  const handleUpdateNodeData = useCallback(
    (nodeId: string, newData: any) => {
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
    [setNodes]
  );

  // Update Edge Data
  const handleUpdateEdgeData = useCallback(
    (edgeId: string, newEdgeData: any) => {
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
              data: {
                ...edge.data,
                ...newEdgeData,
              },
            };
          }
          return edge;
        })
      );
    },
    [setEdges]
  );

  // Add Edge
  const handleAddEdge = useCallback(
    (newEdge: Edge) => {
      setEdges((eds) => [...eds, newEdge]);
    },
    [setEdges]
  );

  // Delete Edge
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [setEdges]
  );

  // Update Group Meta
  const handleUpdateGroupMeta = useCallback(
    (newMeta: Partial<GroupMeta>) => {
      setGroupMeta((prev) => ({
        ...prev,
        ...newMeta,
      }));
    },
    []
  );

  // Delete Node
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [selectedNodeId, setNodes, setEdges]
  );

  // Duplicate Node
  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const nodeToCopy = nodes.find((n) => n.id === nodeId);
      if (!nodeToCopy) return;

      let newQId = 0;
      if (nodeToCopy.type === 'question') {
        const currentHighestId = nodes.reduce((max, n) => {
          if (n.type === 'question' && (n.data as any)?.question_id) {
            return Math.max(max, (n.data as any).question_id);
          }
          return max;
        }, 100);
        newQId = currentHighestId + 1;
      }

      const newNodeId =
        nodeToCopy.type === 'question'
          ? `q-${newQId}`
          : `${nodeToCopy.type}-${Date.now().toString().slice(-4)}`;

      const clonedNode: Node = {
        ...nodeToCopy,
        id: newNodeId,
        position: {
          x: nodeToCopy.position.x + 30,
          y: nodeToCopy.position.y + 30,
        },
        data: {
          ...nodeToCopy.data,
          ...(newQId ? { question_id: newQId } : {}),
        },
      };

      setNodes((nds) => nds.concat(clonedNode));
      setSelectedNodeId(newNodeId);
    },
    [nodes, setNodes]
  );

  // Active mutation dispatchers that automatically route to either Main Canvas or Group Workshop Canvas
  const activeUpdateNodeData = useCallback(
    (nodeId: string, newData: any) => {
      if (selectedSource === 'workshop') {
        workshopBridgeRef.current?.updateNodeData(nodeId, newData);
      } else {
        handleUpdateNodeData(nodeId, newData);
      }
    },
    [selectedSource, handleUpdateNodeData]
  );

  const activeDeleteNode = useCallback(
    (nodeId: string) => {
      if (selectedSource === 'workshop') {
        workshopBridgeRef.current?.deleteNode(nodeId);
        setWorkshopSelectedNodeId(null);
      } else {
        handleDeleteNode(nodeId);
      }
    },
    [selectedSource, handleDeleteNode]
  );

  const activeDuplicateNode = useCallback(
    (nodeId: string) => {
      if (selectedSource === 'workshop') {
        const target = workshopNodes.find((n) => n.id === nodeId);
        if (target) {
          workshopBridgeRef.current?.duplicateNode(target);
        }
      } else {
        handleDuplicateNode(nodeId);
      }
    },
    [selectedSource, workshopNodes, handleDuplicateNode]
  );

  const activeUpdateEdgeData = useCallback(
    (edgeId: string, newEdgeData: any) => {
      if (selectedSource === 'workshop') {
        workshopBridgeRef.current?.updateEdgeData(edgeId, newEdgeData);
      } else {
        handleUpdateEdgeData(edgeId, newEdgeData);
      }
    },
    [selectedSource, handleUpdateEdgeData]
  );

  const activeDeleteEdge = useCallback(
    (edgeId: string) => {
      if (selectedSource === 'workshop') {
        workshopBridgeRef.current?.deleteEdge(edgeId);
        setWorkshopSelectedEdgeId(null);
      } else {
        handleDeleteEdge(edgeId);
      }
    },
    [selectedSource, handleDeleteEdge]
  );

  // Auto-branch from option handle
  const handleAddNestedQuestion = useCallback(
    (parentNodeId: string, optionValue: string) => {
      const parentNode = nodes.find((n) => n.id === parentNodeId);
      if (!parentNode) return;

      const currentHighestId = nodes.reduce((max, n) => {
        if (n.type === 'question' && (n.data as any)?.question_id) {
          return Math.max(max, (n.data as any).question_id);
        }
        return max;
      }, 100);

      const newQId = currentHighestId + 1;
      const newNodeId = `q-${newQId}`;
      const childCount = edges.filter((e) => e.source === parentNodeId).length;

      const newNode: Node = {
        id: newNodeId,
        type: 'question',
        position: {
          x: parentNode.position.x + 360,
          y: parentNode.position.y + childCount * 170,
        },
        data: {
          question_id: newQId,
          question: `Follow-up for: ${optionValue}`,
          question_bn: `${optionValue} সম্পর্কিত বিস্তারিত প্রশ্ন`,
          answer_type: 'string',
          mandatory: true,
          editable: true,
          placeholder: 'তথ্য লিখুন...',
          hint: `${optionValue} নির্বাচন করার কারণে এই প্রশ্নটি প্রযোজ্য`,
        },
      };

      const newEdge: Edge = {
        id: `e-${parentNodeId}-${newNodeId}-${Date.now()}`,
        source: parentNodeId,
        sourceHandle: `opt-${encodeURIComponent(optionValue.trim())}`,
        target: newNodeId,
        type: 'surveyEdge',
        label: `IF "${optionValue.trim()}"`,
        animated: true,
        style: {
          stroke: '#f59e0b',
          strokeWidth: 2,
          strokeDasharray: '4 4',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: '#f59e0b',
        },
        data: {
          validationType: 'match',
          triggerValue: optionValue.trim(),
          routingType: edgeRouting,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setEdges((eds) => eds.concat(newEdge));
      setSelectedNodeId(newNodeId);
    },
    [nodes, edges, edgeRouting, setNodes, setEdges]
  );

  // Hierarchical DAG Auto-Layout
  const handleAutoLayout = useCallback(() => {
    const arrangedNodes = calculateHierarchicalLayout(nodes, edges);
    setNodes(arrangedNodes);
    setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 60);
  }, [nodes, edges, setNodes, fitView]);

  // Align tools
  const handleAlignHorizontal = useCallback(() => {
    setNodes((nds) => alignNodesHorizontal(nds, selectedNodeId ? [selectedNodeId] : undefined));
  }, [selectedNodeId, setNodes]);

  const handleAlignVertical = useCallback(() => {
    setNodes((nds) => alignNodesVertical(nds, selectedNodeId ? [selectedNodeId] : undefined));
  }, [selectedNodeId, setNodes]);

  // Locate and focus diagnostic node on canvas
  const handleFocusDiagnosticNode = useCallback(
    (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (target) {
        setSelectedNodeId(nodeId);
        setSelectedEdgeId(null);
        setCenter(target.position.x + 130, target.position.y + 70, {
          zoom: 1.25,
          duration: 500,
        });
      }
    },
    [nodes, setCenter]
  );

  // Reset to sample initial schema
  const handleResetSample = useCallback(() => {
    if (
      window.confirm(
        'Reset current flowchart to the default Sofol Dynamic KYC sample?'
      )
    ) {
      const parsed = parseSchemaToFlow(SAMPLE_INITIAL_SCHEMA);
      setNodes(parsed.nodes);
      setEdges(parsed.edges);
      setGroupMeta(parsed.meta);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    }
  }, [setNodes, setEdges, fitView]);

  // Compile current schema
  const currentCompiledSchema = useMemo(() => {
    return compileFlowToSchema(nodes, edges, groupMeta);
  }, [nodes, edges, groupMeta]);

  // Import JSON schema handler
  const handleImportSchema = useCallback(
    (schema: DynamicKycGroupResponse) => {
      const parsed = parseSchemaToFlow(schema);
      setNodes(parsed.nodes);
      setEdges(parsed.edges);
      setGroupMeta(parsed.meta);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setActiveView('editor');

      if (activeProject) {
        setProjects((prev) => {
          const updated = prev.map((p) => {
            if (p.id === activeProject.id) {
              return {
                ...p,
                nodes: parsed.nodes,
                edges: parsed.edges,
                groupMeta: parsed.meta,
                updatedAt: new Date().toISOString(),
              };
            }
            return p;
          });
          return updated;
        });
      }

      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 150);
    },
    [setNodes, setEdges, fitView, activeProject, setProjects, setActiveView]
  );

  return (
    <div className="app-container">
      {/* 1. ADMIN LEFT SIDEBAR */}
      <AdminLeftSidebar
        activeView={activeView}
        onSelectView={(view) => {
          if (view === 'list') {
            refreshProjects();
          } else if (view === 'groups') {
            refreshGroups();
          }
          setActiveView(view);
        }}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        activeProjectTitle={activeProject?.title || 'Survey Flowchart'}
        totalProjectsCount={projects.length}
        totalGroupsCount={groups.length}
        theme={theme}
        resolvedTheme={resolvedTheme}
        onSelectTheme={setTheme}
        onCycleTheme={cycleTheme}
      />

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <div className="admin-main-viewport">
        {activeView === 'list' ? (
          <FlowchartListView
            projects={projects}
            activeProjectId={activeProjectId}
            onOpenProject={handleSelectProject}
            onCreateNew={() => setIsCreateModalOpen(true)}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={(id) => handleDeleteProject(id, handleSelectProject)}
          />
        ) : activeView === 'groups' ? (
          <QuestionGroupListView
            groups={groups}
            onCreateGroupInStudio={() => setIsCreateGroupModalOpen(true)}
            onEditGroupInStudio={handleEditGroupInStudio}
            onDeleteGroup={handleDeleteGroup}
            onInsertGroupIntoCanvas={(grp) => handleInsertGroupIntoCanvas(grp)}
            onResetDefaults={handleResetDefaultGroups}
          />
        ) : (
          <div className="studio-editor-wrapper">
            {groupDesignSession ? (
              <GroupTemplateHeader
                name={groupDesignSession.name}
                nameBn={groupDesignSession.nameBn}
                category={groupDesignSession.category}
                color={groupDesignSession.color}
                description={groupDesignSession.description}
                questionCount={nodes.filter((n) => n.type === 'question').length}
                edgeCount={edges.length}
                onUpdateMetadata={(meta) =>
                  setGroupDesignSession((prev) => (prev ? { ...prev, ...meta } : prev))
                }
                onAutoLayout={handleAutoLayout}
                onExit={handleExitGroupDesignSession}
                onSave={handleSaveGroupDesignSession}
              />
            ) : (
              <Header
                projectTitle={activeProject?.title}
                groupMeta={groupMeta}
                onOpenJsonModal={() => setIsJsonModalOpen(true)}
                onOpenMobileModal={() => setIsMobileModalOpen(true)}
                onResetSample={handleResetSample}
                onAutoLayout={handleAutoLayout}
                onBackToList={() => {
                  refreshProjects();
                  setActiveView('list');
                }}
                nodeCount={nodes.length}
                edgeCount={edges.length}
                diagnosticsCount={diagnostics.length}
                diagnosticsErrors={diagnosticsErrors}
                onOpenDiagnostics={() => setIsDiagnosticsModalOpen(true)}
                edgeRouting={edgeRouting}
                onChangeEdgeRouting={handleChangeEdgeRouting}
                onAlignHorizontal={handleAlignHorizontal}
                onAlignVertical={handleAlignVertical}
              />
            )}

            <div className="studio-body app-body">
              {/* Floating Dock Buttons when Sidebars are Collapsed */}
              {!isLeftSidebarOpen && (
                <button
                  type="button"
                  className="floating-sidebar-toggle left-dock"
                  onClick={toggleLeftSidebar}
                  title="Expand Symbols & Question Groups (Ctrl+B)"
                >
                  <PanelLeftOpen size={14} />
                  <span className="dock-label">Symbols</span>
                </button>
              )}

              {!isRightSidebarOpen && (
                <button
                  type="button"
                  className="floating-sidebar-toggle right-dock"
                  onClick={toggleRightSidebar}
                  title="Expand Inspector & Settings (Ctrl+J)"
                >
                  <PanelRightOpen size={14} />
                  <span className="dock-label">Inspector</span>
                </button>
              )}

              {/* LEFT PANEL: Flowchart Symbols & Reusable Groups */}
              <FlowchartSymbolsPanel
                isOpen={isLeftSidebarOpen}
                width={leftWidth}
                isResizing={resizingSide === 'left'}
                onToggleCollapse={toggleLeftSidebar}
                onAddSymbol={handleAddSymbol}
                groups={groups}
                onInsertGroup={(grp) => handleInsertGroupIntoCanvas(grp)}
                onDeleteGroup={handleDeleteGroup}
                onNavigateToGroups={() => {
                  if (groupDesignSession) {
                    if (window.confirm('Exit Group Designer without saving?')) {
                      handleExitGroupDesignSession();
                    }
                  } else {
                    setActiveView('groups');
                  }
                }}
              />

              {/* Left Resizer Splitter (Antigravity Style) */}
              {isLeftSidebarOpen && (
                <div
                  className={`sidebar-resizer left-resizer ${resizingSide === 'left' ? 'is-active' : ''}`}
                  onMouseDown={startResizingLeft}
                  onDoubleClick={resetLeftWidth}
                  title="Drag to resize sidebar, double-click to reset width"
                />
              )}

              {/* CENTER: React Flow Canvas & Question Group Studio Dock */}
              <div
                className="canvas-and-dock-container"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  minWidth: 0,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <main
                  className="canvas-wrapper canvas-container"
                  ref={reactFlowWrapper}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  style={{ flex: 1, minHeight: 0 }}
                >
                  {!groupDesignSession && selectedQuestionNodes.length >= 1 && (
                    <div className="canvas-floating-selection-bar">
                      <div className="selection-bar-badge">
                        <Layers size={13} className="text-emerald" />
                        <span>
                          <strong>{selectedQuestionNodes.length}</strong> Question{selectedQuestionNodes.length > 1 ? 's' : ''} Selected
                        </span>
                      </div>
                      <button
                        className="btn btn-primary btn-floating-save-group"
                        onClick={() => setIsSaveSelectionModalOpen(true)}
                        title="Bundle selected questions into a reusable Question Group"
                      >
                        <Sparkles size={14} />
                        <span>Create Group from Selection</span>
                      </button>

                      <button
                        className="btn btn-secondary btn-floating-save-group"
                        onClick={handleWrapSelectionInFrame}
                        title="Wrap selected questions into a Group Frame right here on canvas (Ctrl+G)"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <Crop size={14} className="text-emerald" />
                        <span>Wrap in Group Frame (Ctrl+G)</span>
                      </button>
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
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    defaultEdgeOptions={{
                      type: 'surveyEdge',
                      markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 16,
                        height: 16,
                      },
                    }}
                    fitView
                    deleteKeyCode={['Backspace', 'Delete']}
                    elevateNodesOnSelect={false}
                    className="survey-flow-canvas"
                  >
                    <Controls className="flow-controls" />
                    <MiniMap
                      className="flow-minimap"
                      nodeColor={(n) => {
                        if (n.type === 'start') return '#10b981';
                        if (n.type === 'end') return '#ef4444';
                        if (n.type === 'decision') return '#f59e0b';
                        if (n.type === 'groupJump') return '#8b5cf6';
                        if (n.type === 'process') return '#6366f1';
                        if (n.type === 'document') return '#06b6d4';
                        return '#0284c7';
                      }}
                      position="bottom-left"
                    />
                    <Background
                      variant={BackgroundVariant.Dots}
                      gap={20}
                      size={1}
                      color={resolvedTheme === 'light' ? '#cbd5e1' : '#334155'}
                    />
                  </ReactFlow>
                </main>

                {/* Bottom Dock Resizer Handle (only when open) */}
                {!groupDesignSession && isBottomDockOpen && (
                  <div
                    className={`bottom-dock-resizer ${resizingSide === 'bottom' ? 'is-active' : ''}`}
                    onMouseDown={startResizingBottom}
                    onDoubleClick={resetBottomHeight}
                    title="Drag to resize Question Group Studio, double-click to reset"
                  />
                )}

                {/* Bottom Group Creation Workshop Canvas (Independent Split-Screen Flow Canvas) */}
                {!groupDesignSession && (
                  <GroupWorkshopCanvas
                    isOpen={isBottomDockOpen}
                    height={bottomHeight}
                    isResizing={resizingSide === 'bottom'}
                    onToggleOpen={toggleBottomDock}
                    onDeployGroupToSurvey={(grp) => handleInsertGroupIntoCanvas(grp)}
                    onSaveToLibrary={() => refreshGroups()}
                    theme={resolvedTheme}
                    onSelectNode={handleWorkshopSelectNode}
                    onSelectEdge={handleWorkshopSelectEdge}
                    onWorkshopNodesChange={setWorkshopNodes}
                    onWorkshopEdgesChange={setWorkshopEdges}
                    onRegisterBridge={(bridge) => {
                      workshopBridgeRef.current = bridge;
                    }}
                  />
                )}
              </div>

              {/* Right Resizer Splitter (Antigravity Style) */}
              {isRightSidebarOpen && (
                <div
                  className={`sidebar-resizer right-resizer ${resizingSide === 'right' ? 'is-active' : ''}`}
                  onMouseDown={startResizingRight}
                  onDoubleClick={resetRightWidth}
                  title="Drag to resize inspector, double-click to reset width"
                />
              )}

              {/* RIGHT PANEL: Input Type Views & Inspector */}
              <InputTypeViewsPanel
                isOpen={isRightSidebarOpen}
                width={rightWidth}
                isResizing={resizingSide === 'right'}
                onToggleCollapse={toggleRightSidebar}
                selectedNode={activeSelectedNode}
                selectedEdge={activeSelectedEdge}
                nodes={activeNodes}
                edges={activeEdges}
                groups={groups}
                groupMeta={groupMeta}
                onUpdateNodeData={activeUpdateNodeData}
                onUpdateEdgeData={activeUpdateEdgeData}
                onUpdateGroupMeta={handleUpdateGroupMeta}
                onDeleteNode={activeDeleteNode}
                onDuplicateNode={activeDuplicateNode}
                onAddNestedQuestion={handleAddNestedQuestion}
                onAddQuestion={handleAddQuestionFromWidget}
                onAddEdge={handleAddEdge}
                onDeleteEdge={activeDeleteEdge}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateFlowchartModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateNewProject}
      />

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onCreate={handleStartNewGroupInStudio}
      />

      <SaveSelectionAsGroupModal
        isOpen={isSaveSelectionModalOpen}
        onClose={() => setIsSaveSelectionModalOpen(false)}
        selectedQuestions={selectedQuestionTemplates}
        onSave={handleSaveSelectionAsGroup}
      />

      <JsonExportModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        schema={currentCompiledSchema}
        onImportSchema={handleImportSchema}
      />

      <MobilePreviewModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
        schema={currentCompiledSchema}
      />

      <FlowDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        diagnostics={diagnostics}
        onSelectNode={handleFocusDiagnosticNode}
      />

      <WarningAlertModal
        isOpen={Boolean(warningAlertData)}
        onClose={() => setWarningAlertData(null)}
        data={warningAlertData}
      />
    </div>
  );
};

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}
