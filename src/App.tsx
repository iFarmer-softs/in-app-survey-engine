import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  ControlButton,
  Background,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  useUpdateNodeInternals,
  MarkerType,
} from '@xyflow/react';
import type { Edge, Node, EdgeChange, NodeChange, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Crop,
  Plus,
  AlertTriangle,
  Layers,
} from 'lucide-react';

import { Header } from './components/layout/Header';
import { GroupTemplateHeader } from './components/layout/GroupTemplateHeader';
import { InputTypeViewsPanel } from './components/layout/InputTypeViewsPanel';
import { FigmaToolbar, type CanvasToolMode } from './components/canvas/FigmaToolbar';
import { FlowchartListView } from './components/dashboard/FlowchartListView';
import { QuestionGroupListView } from './components/groups/QuestionGroupListView';
import { CreateFlowchartModal } from './components/modals/CreateFlowchartModal';
import { CreateGroupModal } from './components/modals/CreateGroupModal';
import { SaveSelectionAsGroupModal } from './components/modals/SaveSelectionAsGroupModal';
import { JsonExportModal } from './components/modals/JsonExportModal';
import { MobilePreviewModal } from './components/modals/MobilePreviewModal';
import { FlowDiagnosticsModal } from './components/modals/FlowDiagnosticsModal';
import { WarningAlertModal } from './components/modals/WarningAlertModal';
import {
  GroupTransferWarningModal,
  type PendingGroupTransfer,
} from './components/modals/GroupTransferWarningModal';
import { CreateVersionModal } from './components/modals/CreateVersionModal';
import { VersionHistoryModal } from './components/modals/VersionHistoryModal';
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
  checkFramesOverlap,
  findNearestNonOverlappingPosition,
} from './utils/flowLayout';
import {
  validateSurveyFlow,
  isNodeInContainer,
  resolveNodeGroupId,
  getNodeDimensions,
  getContainerBounds,
  GROUP_BORDER_INSET,
  GROUP_HEADER_INSET,
  isNodeCleanlyInsideContainer,
  isNodeOverlappingContainer,
} from './utils/flowValidator';
import {
  calculateDependencyTrace,
  getTraceNodeRole,
  getTraceEdgeRole,
} from './utils/dependencyTracing';

import { useProjectManager } from './hooks/useProjectManager';
import { useGroupStudio } from './hooks/useGroupStudio';
import { useGroupContainers } from './hooks/useGroupContainers';
import { useFlowCanvasConnections } from './hooks/useFlowCanvasConnections';
import { useSidebarResizer } from './hooks/useSidebarResizer';
import { useTheme } from './hooks/useTheme';
import { useCanvasHistory } from './hooks/useCanvasHistory';
import { createNewQuestionGroup, loadAllGroups } from './utils/groupStorage';
import { apiClient } from './services/api';

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
  default: CustomFlowchartEdge,
  surveyEdge: CustomFlowchartEdge,
  custom: CustomFlowchartEdge,
  smoothstep: CustomFlowchartEdge,
  step: CustomFlowchartEdge,
  straight: CustomFlowchartEdge,
  bezier: CustomFlowchartEdge,
};

const FlowEditor: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, setCenter, zoomIn, zoomOut, zoomTo } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const [activeView, setActiveView] = useState<'editor' | 'list' | 'groups'>('editor');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isSaveSelectionModalOpen, setIsSaveSelectionModalOpen] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [isCreateVersionModalOpen, setIsCreateVersionModalOpen] = useState(false);
  const [isInitialPublishMode, setIsInitialPublishMode] = useState(false);
  const [isVersionHistoryModalOpen, setIsVersionHistoryModalOpen] = useState(false);
  const [versionHistoryTargetProject, setVersionHistoryTargetProject] = useState<any | null>(null);
  const [versionPreviewCustomSchema, setVersionPreviewCustomSchema] = useState<DynamicKycGroupResponse | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Visual Inspection: Dependency Path Tracing state (disabled for now)
  const [isPathTracingEnabled, setIsPathTracingEnabled] = useState(false);
  const togglePathTracing = useCallback(() => {
    setIsPathTracingEnabled((prev) => !prev);
  }, []);

  // Figma-style Canvas Tool Mode: 'select' (V) | 'hand' (H) | 'drawArea' (F)
  const [activeToolMode, setActiveToolMode] = useState<CanvasToolMode>('select');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const isDrawAreaMode = activeToolMode === 'drawArea';
  const isHandMode = activeToolMode === 'hand' || isSpacePressed;

  const [drawStartPos, setDrawStartPos] = useState<{
    client: { x: number; y: number };
    relative: { x: number; y: number };
  } | null>(null);
  const [drawCurrentPos, setDrawCurrentPos] = useState<{
    client: { x: number; y: number };
    relative: { x: number; y: number };
  } | null>(null);

  // Right Inspector expand / collapse state with persistent localStorage
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('survey_right_sidebar_open') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleRightSidebar = useCallback(() => {
    setIsRightSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('survey_right_sidebar_open', String(next));
      } catch { }
      setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
      return next;
    });
  }, []);

  // Draggable inspector resizer hook (Antigravity Style)
  const {
    rightWidth,
    resizingSide,
    startResizingRight,
    resetRightWidth,
  } = useSidebarResizer();

  // Dark / Light / System Theme hook
  const { theme, resolvedTheme, cycleTheme } = useTheme();

  // Global keyboard shortcuts: Cmd+J (right inspector)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleRightSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleRightSidebar]);

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
    handleCreateVersionSnapshot,
    handleRestoreVersion,
    isServerConnected,
    isSyncing,
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

  // In-memory Canvas Undo / Redo system with drag coalescing
  const {
    canUndo,
    canRedo,
    recordSnapshot,
    handleUndo,
    handleRedo,
    clearHistory,
    onNodeDragStart,
    onNodeDragStop,
  } = useCanvasHistory({
    onApplySnapshot: (snap) => {
      setNodes(snap.nodes);
      setEdges(snap.edges);
      setGroupMeta(snap.groupMeta);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    },
  });

  const triggerUndo = useCallback(() => {
    handleUndo(nodes, edges, groupMeta);
  }, [handleUndo, nodes, edges, groupMeta]);

  const triggerRedo = useCallback(() => {
    handleRedo(nodes, edges, groupMeta);
  }, [handleRedo, nodes, edges, groupMeta]);

  // Group transfer & containment states
  const [pendingGroupTransfer, setPendingGroupTransfer] = useState<PendingGroupTransfer | null>(null);
  const [containmentToast, setContainmentToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showContainmentToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setContainmentToast(msg);
    toastTimerRef.current = setTimeout(() => {
      setContainmentToast(null);
    }, 3500);
  }, []);

  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragStartContainersRef = useRef<Map<string, Node>>(new Map());

  const handleNodeDragStart = useCallback(
    (_event: any, _draggedNode?: Node, _draggedNodesList?: Node[]) => {
      onNodeDragStart(nodes, edges, groupMeta);
      const posMap = new Map<string, { x: number; y: number }>();
      const containerMap = new Map<string, Node>();
      const containers = nodes.filter(
        (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
      );
      nodes.forEach((n) => {
        posMap.set(n.id, { x: n.position.x, y: n.position.y });
        let parent = containers.find((c) => isNodeInContainer(n, c, nodes));
        if (!parent && n.type !== 'groupFrame' && n.type !== 'groupContainer') {
          parent = containers.find((c) => isNodeOverlappingContainer(n, c));
        }
        if (parent) {
          containerMap.set(n.id, parent);
        }
      });
      dragStartPositionsRef.current = posMap;
      dragStartContainersRef.current = containerMap;
    },
    [nodes, edges, groupMeta, onNodeDragStart]
  );

  // Auto-synchronize groupMeta.totalGroups with the actual count of groups on canvas (NOT group IDs)
  useEffect(() => {
    const frameNodes = nodes.filter(
      (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
    );
    const questionGroups = new Set(
      nodes
        .filter((n) => n.type === 'question')
        .map((n) => Number((n.data as any)?.group))
        .filter((g) => !isNaN(g) && g > 0)
    );

    let actualGroupCount = 0;
    if (frameNodes.length > 0) {
      actualGroupCount = frameNodes.length;
    } else if (questionGroups.size > 1) {
      actualGroupCount = questionGroups.size;
    }

    if (actualGroupCount > 0 && actualGroupCount !== groupMeta.totalGroups) {
      setGroupMeta((prev) => ({
        ...prev,
        totalGroups: actualGroupCount,
        hasNextGroup: actualGroupCount > (prev.groupNumber || 1),
      }));
    }
  }, [nodes, groupMeta.totalGroups]);

  // Global Undo / Redo keyboard listener (Cmd/Ctrl + Z, Cmd/Ctrl + Shift + Z, Cmd/Ctrl + Y)
  useEffect(() => {
    const handleUndoRedoKeys = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) ||
        target?.isContentEditable
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        triggerUndo();
      } else if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        triggerRedo();
      }
    };
    window.addEventListener('keydown', handleUndoRedoKeys);
    return () => window.removeEventListener('keydown', handleUndoRedoKeys);
  }, [triggerUndo, triggerRedo]);

  // Manual save state and trigger
  const [justSaved, setJustSaved] = useState(false);
  const handleManualSave = useCallback(async () => {
    await syncActiveProject(nodes, edges, groupMeta, false);
    setJustSaved(true);
    setTimeout(() => {
      setJustSaved(false);
    }, 2000);
  }, [nodes, edges, groupMeta, syncActiveProject]);

  useEffect(() => {
    const handleSaveKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleSaveKeyDown);
    return () => window.removeEventListener('keydown', handleSaveKeyDown);
  }, [handleManualSave]);

  // 3. Group template studio hook
  const {
    groups,
    setGroups,
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
    handleNodesChange: handleGroupNodesChange,
    handleToggleGroupCollapse: baseToggleGroupCollapse,
    handleUngroup: baseUngroup,
    handleDeleteGroupContainer: baseDeleteGroupContainer,
    handleInsertGroupIntoCanvas: baseInsertGroupIntoCanvas,
  } = useGroupContainers({
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    setSelectedNodeId,
    setActiveView,
    setCenter,
    setGroupMeta,
    updateNodeInternals,
  });

  const handleToggleGroupCollapse = useCallback(
    (id: string) => {
      recordSnapshot(nodes, edges, groupMeta);
      baseToggleGroupCollapse(id);
    },
    [baseToggleGroupCollapse, recordSnapshot, nodes, edges, groupMeta]
  );

  const handleUngroup = useCallback(
    (id: string) => {
      recordSnapshot(nodes, edges, groupMeta);
      baseUngroup(id);
    },
    [baseUngroup, recordSnapshot, nodes, edges, groupMeta]
  );

  const handleDeleteGroupContainer = useCallback(
    (id: string) => {
      recordSnapshot(nodes, edges, groupMeta);
      baseDeleteGroupContainer(id);
    },
    [baseDeleteGroupContainer, recordSnapshot, nodes, edges, groupMeta]
  );

  const handleInsertGroupIntoCanvas = useCallback(
    (group: ReusableQuestionGroup, position?: { x: number; y: number }) => {
      recordSnapshot(nodes, edges, groupMeta);
      baseInsertGroupIntoCanvas(group, position);
    },
    [baseInsertGroupIntoCanvas, recordSnapshot, nodes, edges, groupMeta]
  );

  // Save an entire Group Area Frame and all its enclosed symbols into the Question Group Library
  const handleSaveGroupAreaToLibrary = useCallback(
    (containerNode: Node) => {
      const cData = containerNode.data as any;
      const childNodes = nodes.filter((n) => isNodeInContainer(n, containerNode, nodes));
      const childNodeIds = new Set(childNodes.map((n) => n.id));
      childNodeIds.add(containerNode.id);

      const childEdges = edges.filter(
        (e) => childNodeIds.has(e.source) && childNodeIds.has(e.target)
      );

      const questionNodes = childNodes
        .filter((n) => n.type === 'question')
        .sort((a, b) => a.position.y - b.position.y);

      const questionTemplates: GroupQuestionTemplate[] = questionNodes.map((n) => {
        const qd = n.data as any;
        return {
          question: qd.question || 'Untitled Question',
          question_bn: qd.question_bn || qd.question || '',
          answer_type: qd.answer_type || 'string',
          mandatory: qd.mandatory ?? true,
          editable: qd.editable ?? true,
          placeholder: qd.placeholder || '',
          hint: qd.hint || '',
          options: qd.options || '',
        };
      });

      const groupTitle = cData.title || `Group Area ${cData.numericGroupId || 1}`;
      const groupTitleBn = cData.titleBn || groupTitle;

      const newGroup = createNewQuestionGroup(
        groupTitle,
        groupTitleBn,
        `Reusable group template saved from Group Area #${cData.numericGroupId || 1}`,
        cData.category || 'custom',
        cData.color || '#8b5cf6',
        questionTemplates,
        cData.numericGroupId,
        [containerNode, ...childNodes],
        childEdges
      );

      if (apiClient.isOnline()) {
        apiClient.createGroup(newGroup).catch(console.error);
      }
      setGroups(loadAllGroups());
      alert(`"${groupTitle}" has been saved to your Question Group Library!`);
    },
    [nodes, edges, setGroups]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (changes.some((c) => c.type === 'remove')) {
        recordSnapshot(nodes, edges, groupMeta);
      }
      handleGroupNodesChange(changes);
    },
    [handleGroupNodesChange, recordSnapshot, nodes, edges, groupMeta]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((c) => c.type === 'remove')) {
        recordSnapshot(nodes, edges, groupMeta);
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, recordSnapshot, nodes, edges, groupMeta]
  );

  // 5. Connections & routing hook
  const {
    warningAlertData,
    setWarningAlertData,
    edgeRouting,
    onConnect: baseOnConnect,
    onReconnect: baseOnReconnect,
  } = useFlowCanvasConnections({
    nodes,
    edges,
    setNodes,
    setEdges,
    onContainmentWarning: showContainmentToast,
  });

  const onConnect = useCallback(
    (params: Connection) => {
      recordSnapshot(nodes, edges, groupMeta);
      baseOnConnect(params);
    },
    [baseOnConnect, recordSnapshot, nodes, edges, groupMeta]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      recordSnapshot(nodes, edges, groupMeta);
      baseOnReconnect(oldEdge, newConnection);
    },
    [baseOnReconnect, recordSnapshot, nodes, edges, groupMeta]
  );

  // Live drag updates and Undo/Redo capture when edge line is dragged/resized
  useEffect(() => {
    const handleEdgeDragStart = () => {
      // Snapshot pristine edge coordinates before live dragging mutates them
      recordSnapshot(nodes, edges, groupMeta);
    };

    const handleEdgeLiveDrag = (event: Event) => {
      const customEvt = event as CustomEvent<{
        edgeId: string;
        centerX?: number;
        centerY?: number;
        labelOffsetX?: number;
        labelOffsetY?: number;
        corridorOffsetX?: number;
        corridorOffsetY?: number;
        curvature?: number;
      }>;
      const detail = customEvt.detail;
      if (!detail || !detail.edgeId) return;

      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === detail.edgeId) {
            return {
              ...edge,
              data: {
                ...(edge.data || {}),
                ...(detail.labelOffsetX !== undefined ? { labelOffsetX: detail.labelOffsetX, centerX: undefined } : {}),
                ...(detail.labelOffsetY !== undefined ? { labelOffsetY: detail.labelOffsetY, centerY: undefined } : {}),
                ...(detail.corridorOffsetX !== undefined ? { corridorOffsetX: detail.corridorOffsetX } : {}),
                ...(detail.corridorOffsetY !== undefined ? { corridorOffsetY: detail.corridorOffsetY } : {}),
                ...(detail.centerX !== undefined && detail.labelOffsetX === undefined ? { centerX: detail.centerX } : {}),
                ...(detail.centerY !== undefined && detail.labelOffsetY === undefined ? { centerY: detail.centerY } : {}),
                ...(detail.curvature !== undefined ? { curvature: detail.curvature } : {}),
              },
            };
          }
          return edge;
        })
      );
    };

    const handleEdgeBendChange = (event: Event) => {
      const customEvt = event as CustomEvent<{
        edgeId: string;
        centerX?: number;
        centerY?: number;
        labelOffsetX?: number;
        labelOffsetY?: number;
        corridorOffsetX?: number;
        corridorOffsetY?: number;
        curvature?: number;
        reset?: boolean;
      }>;
      const detail = customEvt.detail;
      if (!detail || !detail.edgeId) {
        return;
      }

      if (detail.reset) {
        recordSnapshot(nodes, edges, groupMeta);
      }
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === detail.edgeId) {
            if (detail.reset) {
              const {
                centerX,
                centerY,
                labelOffsetX,
                labelOffsetY,
                corridorOffsetX,
                corridorOffsetY,
                offset,
                curvature,
                ...restData
              } = (edge.data || {}) as any;
              return {
                ...edge,
                data: restData,
              };
            }
            return {
              ...edge,
              data: {
                ...(edge.data || {}),
                ...(detail.labelOffsetX !== undefined ? { labelOffsetX: detail.labelOffsetX, centerX: undefined } : {}),
                ...(detail.labelOffsetY !== undefined ? { labelOffsetY: detail.labelOffsetY, centerY: undefined } : {}),
                ...(detail.corridorOffsetX !== undefined ? { corridorOffsetX: detail.corridorOffsetX } : {}),
                ...(detail.corridorOffsetY !== undefined ? { corridorOffsetY: detail.corridorOffsetY } : {}),
                ...(detail.centerX !== undefined && detail.labelOffsetX === undefined ? { centerX: detail.centerX } : {}),
                ...(detail.centerY !== undefined && detail.labelOffsetY === undefined ? { centerY: detail.centerY } : {}),
                ...(detail.curvature !== undefined ? { curvature: detail.curvature } : {}),
              },
            };
          }
          return edge;
        })
      );
    };

    const handleEdgeDelete = (event: Event) => {
      const customEvt = event as CustomEvent<{ edgeId: string }>;
      const edgeId = customEvt.detail?.edgeId;
      if (!edgeId) return;

      recordSnapshot(nodes, edges, groupMeta);
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdgeId((current) => (current === edgeId ? null : current));
    };

    window.addEventListener('canvas-edge-drag-start', handleEdgeDragStart);
    window.addEventListener('canvas-edge-live-drag', handleEdgeLiveDrag);
    window.addEventListener('canvas-edge-bend-changed', handleEdgeBendChange);
    window.addEventListener('canvas-edge-delete', handleEdgeDelete);
    return () => {
      window.removeEventListener('canvas-edge-drag-start', handleEdgeDragStart);
      window.removeEventListener('canvas-edge-live-drag', handleEdgeLiveDrag);
      window.removeEventListener('canvas-edge-bend-changed', handleEdgeBendChange);
      window.removeEventListener('canvas-edge-delete', handleEdgeDelete);
    };
  }, [nodes, edges, groupMeta, recordSnapshot, setEdges, setSelectedEdgeId]);

  // Real-time flow health diagnostics
  const diagnostics = useMemo(() => {
    return validateSurveyFlow(nodes, edges);
  }, [nodes, edges]);

  const diagnosticsErrors = useMemo(
    () => diagnostics.filter((d) => d.type === 'error').length,
    [diagnostics]
  );

  // Sync active project state to storage whenever nodes, edges, or meta changes (debounced to 800ms)
  useEffect(() => {
    if (groupDesignSession) return;
    const timer = setTimeout(() => {
      syncActiveProject(nodes, edges, groupMeta, false);
    }, 800);
    return () => clearTimeout(timer);
  }, [nodes, edges, groupMeta, groupDesignSession, syncActiveProject]);

  // Switch active project
  const handleSelectProject = useCallback(
    (id: string) => {
      selectProjectById(id, (target) => {
        clearHistory();
        setNodes(target.nodes);
        setEdges(target.edges);
        setGroupMeta(target.groupMeta);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setActiveView('editor');
        setTimeout(() => fitView({ padding: 0.2 }), 50);
      });
    },
    [selectProjectById, clearHistory, setNodes, setEdges, fitView]
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
        clearHistory();
        setNodes(newProj.nodes);
        setEdges(newProj.edges);
        setGroupMeta(newProj.groupMeta);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setActiveView('editor');
        setTimeout(() => fitView({ padding: 0.2 }), 50);
      });
    },
    [createProjectAction, clearHistory, setNodes, setEdges, fitView]
  );

  // Version Control Handlers
  const handleExecuteCreateSnapshot = useCallback(
    (params: {
      version: string;
      title: string;
      description: string;
      isPublished: boolean;
      createdBy: string;
    }) => {
      handleCreateVersionSnapshot(params, nodes, edges, groupMeta);
    },
    [handleCreateVersionSnapshot, nodes, edges, groupMeta]
  );

  const handleExecuteRestoreSnapshot = useCallback(
    (versionId: string) => {
      recordSnapshot(nodes, edges, groupMeta);
      handleRestoreVersion(versionId, (restored) => {
        setNodes(restored.nodes);
        setEdges(restored.edges);
        setGroupMeta(restored.groupMeta);
        setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 150);
      });
    },
    [recordSnapshot, nodes, edges, groupMeta, handleRestoreVersion, setNodes, setEdges, fitView]
  );

  const handleOpenMobilePreviewFromVersion = useCallback(
    (vNodes: Node[], vEdges: Edge[], vMeta: any) => {
      const compiled = compileFlowToSchema(vNodes, vEdges, vMeta);
      setVersionPreviewCustomSchema(compiled);
      setIsMobileModalOpen(true);
    },
    []
  );

  // Stable ref for container/frame action callbacks to prevent React Flow 002 nodeTypes churn
  const containerHandlersRef = useRef({
    handleToggleGroupCollapse,
    handleUngroup,
    handleDeleteGroupContainer,
  });

  useEffect(() => {
    containerHandlersRef.current = {
      handleToggleGroupCollapse,
      handleUngroup,
      handleDeleteGroupContainer,
    };
  });

  const StableGroupContainerNode = useCallback((props: any) => (
    <GroupContainerNode
      {...props}
      onToggleCollapse={(id: string) => containerHandlersRef.current.handleToggleGroupCollapse(id)}
      onUngroup={(id: string) => containerHandlersRef.current.handleUngroup(id)}
      onDeleteGroup={(id: string) => containerHandlersRef.current.handleDeleteGroupContainer(id)}
    />
  ), []);

  const StableGroupFrameNode = useCallback((props: any) => (
    <GroupFrameNode
      {...props}
      onDeleteFrame={(id: string) => containerHandlersRef.current.handleDeleteGroupContainer(id)}
    />
  ), []);

  // Stabilized custom node types with static references across renders
  const nodeTypes = useMemo(
    () => ({
      ...baseNodeTypes,
      groupContainer: StableGroupContainerNode,
      groupFrame: StableGroupFrameNode,
    }),
    [StableGroupContainerNode, StableGroupFrameNode]
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
    recordSnapshot(nodes, edges, groupMeta);

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

    const existingFrames = nodes.filter(
      (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
    );
    const existingGroupNumbers = existingFrames
      .map((f) => (f.data as any)?.numericGroupId || parseInt((f.data as any)?.groupId) || 1)
      .filter((g) => !isNaN(g) && g > 0);
    const nextGrpId =
      existingGroupNumbers.length > 0 ? Math.max(...existingGroupNumbers) + 1 : 1;
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

    const newTotal = existingFrames.length + 1;
    setGroupMeta((prev) => ({
      ...prev,
      totalGroups: newTotal,
      hasNextGroup: newTotal > (prev.groupNumber || 1),
    }));

    setSelectedNodeId(newFrameId);
  }, [selectedQuestionNodes, groupMeta, nodes, edges, recordSnapshot, setNodes, setGroupMeta]);

  // Global Figma-style Hotkeys: V (Select), H (Hand), F (Draw Area), Space (Hold for Hand), Cmd+G (Wrap), Zoom (+, -, 0, Shift+1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable) return;

      // Global Canvas Zoom Controls
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault();
        zoomIn({ duration: 150 });
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault();
        zoomOut({ duration: 150 });
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault();
        zoomTo(1, { duration: 200 });
      } else if (e.shiftKey && (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        fitView({ padding: 0.2, duration: 300 });
      } else if (e.shiftKey && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        zoomTo(1, { duration: 200 });
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleWrapSelectionInFrame();
      } else if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          setActiveToolMode('select');
          setDrawStartPos(null);
          setDrawCurrentPos(null);
        } else if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          setActiveToolMode('hand');
          setDrawStartPos(null);
          setDrawCurrentPos(null);
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          setActiveToolMode('drawArea');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setActiveToolMode('select');
          setDrawStartPos(null);
          setDrawCurrentPos(null);
        } else if (e.code === 'Space' && !isSpacePressed) {
          e.preventDefault();
          setIsSpacePressed(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleWrapSelectionInFrame, isSpacePressed, zoomIn, zoomOut, zoomTo, fitView]);

  // Selected entities across Flowchart Canvas
  const activeSelectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const activeSelectedEdge = useMemo(() => {
    return edges.find((e) => e.id === selectedEdgeId) || null;
  }, [edges, selectedEdgeId]);

  const activeNodes = nodes;
  const activeEdges = edges;

  // Dependency Path Tracing calculation for canvas highlighting:
  // Automatically highlights the full upstream and downstream dependency path on node selection
  // and dims un-connected nodes to reduce canvas noise, without requiring a manual header toggle.
  const activeTrace = useMemo(() => {
    if (!selectedNodeId) return null;
    const selected = nodes.find((n) => n.id === selectedNodeId);
    if (!selected || selected.type === 'groupContainer' || selected.type === 'groupFrame') {
      return null;
    }
    return calculateDependencyTrace(nodes, edges, selectedNodeId);
  }, [selectedNodeId, nodes, edges]);

  // Derived display nodes with highlight/dim classes without mutating base nodes state
  const displayNodes = useMemo(() => {
    if (!activeTrace) return nodes;
    return nodes.map((node) => {
      const role = getTraceNodeRole(node.id, node.type, activeTrace);
      if (role === 'normal') return node;
      const traceClass =
        role === 'selected'
          ? 'trace-node-selected'
          : role === 'ancestor'
            ? 'trace-node-ancestor'
            : role === 'descendant'
              ? 'trace-node-descendant'
              : 'trace-node-dimmed';

      const existingClass = (node.className || '').trim();
      return {
        ...node,
        className: existingClass ? `${existingClass} ${traceClass}` : traceClass,
      };
    });
  }, [nodes, activeTrace]);

  // Derived display edges with traceRole without mutating base edges state
  const displayEdges = useMemo(() => {
    return edges.map((edge) => {
      const role = activeTrace ? getTraceEdgeRole(edge.id, activeTrace) : undefined;
      return {
        ...edge,
        type: edge.type || 'surveyEdge',
        reconnectable: false,
        data: {
          ...(edge.data || {}),
          traceRole: role,
        },
      };
    });
  }, [edges, activeTrace]);

  // Selection handlers: auto-open right inspector when an item is selected on Main Canvas
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setIsRightSidebarOpen(true);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setIsRightSidebarOpen(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // Helper to calculate non-overlapping coordinates and metadata for a brand-new group frame
  const getNextGroupAreaConfig = useCallback(
    (frames: Node[], targetPos?: { x: number; y: number }) => {
      const existingGroupNumbers = frames
        .map((f) => (f.data as any)?.numericGroupId || parseInt((f.data as any)?.groupId) || 1)
        .filter((g) => !isNaN(g) && g > 0);
      const nextGroupNumber =
        existingGroupNumbers.length > 0 ? Math.max(...existingGroupNumbers) + 1 : 1;

      const frameId = `grp-frame-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`;
      const GROUP_PALETTE = ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
      const frameColor = GROUP_PALETTE[(nextGroupNumber - 1) % GROUP_PALETTE.length];

      const lastFrame = frames[frames.length - 1];
      let resolvedPos =
        targetPos ||
        (lastFrame
          ? { x: lastFrame.position.x + 500, y: lastFrame.position.y }
          : { x: 300, y: 150 });

      // Strict Non-Overlap Enforcement: Nudge new frame to the right until guaranteed non-overlapping
      while (
        frames.some((frame) => {
          const fW =
            (frame.style?.width ? parseInt(String(frame.style.width), 10) : 0) ||
            frame.measured?.width ||
            440;
          const fH =
            (frame.style?.height ? parseInt(String(frame.style.height), 10) : 0) ||
            frame.measured?.height ||
            480;
          return checkFramesOverlap(
            { x: resolvedPos.x, y: resolvedPos.y, w: 440, h: 480 },
            { x: frame.position.x, y: frame.position.y, w: fW, h: fH },
            24
          );
        })
      ) {
        resolvedPos = { x: resolvedPos.x + 500, y: resolvedPos.y };
      }

      return { frameId, nextGroupNumber, frameColor, resolvedPos };
    },
    []
  );

  // Instant Creation of a Group Area (Group Frame)
  const handleCreateNewGroupArea = useCallback(
    (targetPos?: { x: number; y: number }) => {
      const existingFrames = nodes.filter(
        (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
      );
      const { frameId, nextGroupNumber, frameColor, resolvedPos } = getNextGroupAreaConfig(
        existingFrames,
        targetPos
      );

      const newFrame: Node = {
        id: frameId,
        type: 'groupFrame',
        position: resolvedPos,
        zIndex: 0,
        style: { width: 440, height: 480 },
        data: {
          groupId: frameId,
          numericGroupId: nextGroupNumber,
          title: `Group Area ${nextGroupNumber}`,
          titleBn: `গ্রুপ এলাকা ${nextGroupNumber}`,
          category: 'custom',
          color: frameColor,
          questionIds: [],
          questionCount: 0,
          expandedHeight: 480,
        },
      };

      recordSnapshot(nodes, edges, groupMeta);
      setNodes((nds) => nds.concat(newFrame));
      setSelectedNodeId(frameId);
      const newTotal = existingFrames.length + 1;
      setGroupMeta((prev) => ({
        ...prev,
        totalGroups: newTotal,
        hasNextGroup: newTotal > (prev.groupNumber || 1),
      }));
    },
    [nodes, edges, groupMeta, recordSnapshot, setNodes, setSelectedNodeId, setGroupMeta, getNextGroupAreaConfig]
  );

  // Figma-style Canvas Mouse Drawing Handlers for Group Area
  const handleDrawMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left mouse button only
    const rect = reactFlowWrapper.current?.getBoundingClientRect();
    if (!rect) return;

    const relative = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    const client = {
      x: e.clientX,
      y: e.clientY,
    };

    setDrawStartPos({ client, relative });
    setDrawCurrentPos({ client, relative });
  }, []);

  const handleDrawMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawStartPos) return;
      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      if (!rect) return;

      const relative = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const client = {
        x: e.clientX,
        y: e.clientY,
      };

      setDrawCurrentPos({ client, relative });
    },
    [drawStartPos]
  );

  const handleDrawMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!drawStartPos) {
        setActiveToolMode('select');
        return;
      }

      const startClient = drawStartPos.client;
      const endClient = { x: e.clientX, y: e.clientY };

      const minClientX = Math.min(startClient.x, endClient.x);
      const maxClientX = Math.max(startClient.x, endClient.x);
      const minClientY = Math.min(startClient.y, endClient.y);
      const maxClientY = Math.max(startClient.y, endClient.y);

      const screenWidth = maxClientX - minClientX;
      const screenHeight = maxClientY - minClientY;

      // Convert screen corners to canvas flow space
      const flowTopLeft = screenToFlowPosition({ x: minClientX, y: minClientY });
      const flowBottomRight = screenToFlowPosition({ x: maxClientX, y: maxClientY });

      let flowX = flowTopLeft.x;
      let flowY = flowTopLeft.y;
      let flowWidth = Math.abs(flowBottomRight.x - flowTopLeft.x);
      let flowHeight = Math.abs(flowBottomRight.y - flowTopLeft.y);

      // If user merely clicked without dragging (< 25px), generate default spacious frame
      if (screenWidth < 25 && screenHeight < 25) {
        flowWidth = 440;
        flowHeight = 480;
      } else {
        flowWidth = Math.max(flowWidth, 340);
        flowHeight = Math.max(flowHeight, 220);
      }

      const existingFrames = nodes.filter(
        (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
      );
      const existingGroupNumbers = existingFrames
        .map((f) => (f.data as any)?.numericGroupId || parseInt((f.data as any)?.groupId) || 1)
        .filter((g) => !isNaN(g) && g > 0);
      const nextGroupNumber =
        existingGroupNumbers.length > 0 ? Math.max(...existingGroupNumbers) + 1 : 1;

      const GROUP_PALETTE = ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
      const frameColor = GROUP_PALETTE[(nextGroupNumber - 1) % GROUP_PALETTE.length];
      const frameId = `grp-frame-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`;

      // Active existing container IDs on canvas
      const activeContainerIds = new Set(existingFrames.map((f) => f.id));

      // Detect non-frame question or logic nodes enclosed inside the drawn rectangle.
      // CRITICAL: NEVER steal nodes that already belong to an active existing container!
      const enclosedNodeIds: string[] = [];
      const nonFrameNodes = nodes.filter(
        (n) => n.type !== 'groupFrame' && n.type !== 'groupContainer'
      );

      nonFrameNodes.forEach((node) => {
        const currentContainerId = (node.data as any)?.containerId;
        // If node is already bound to an active container, protect it from being stolen
        if (currentContainerId && activeContainerIds.has(currentContainerId)) {
          return;
        }

        const nodeW = node.measured?.width || 270;
        const nodeH = node.measured?.height || 180;
        const nodeCenterX = node.position.x + nodeW / 2;
        const nodeCenterY = node.position.y + nodeH / 2;

        const isInside =
          (node.position.x >= flowX &&
            node.position.x <= flowX + flowWidth &&
            node.position.y >= flowY &&
            node.position.y <= flowY + flowHeight) ||
          (nodeCenterX >= flowX &&
            nodeCenterX <= flowX + flowWidth &&
            nodeCenterY >= flowY &&
            nodeCenterY <= flowY + flowHeight);

        if (isInside) {
          enclosedNodeIds.push(node.id);
        }
      });

      // Check if the user mistakenly drew this rectangle over an existing container
      let collidedFrame: Node | null = null;
      for (const frame of existingFrames) {
        const fX = frame.position.x;
        const fY = frame.position.y;
        const fW =
          (frame.style?.width ? parseInt(String(frame.style.width), 10) : 0) ||
          frame.measured?.width ||
          440;
        const fH =
          (frame.style?.height ? parseInt(String(frame.style.height), 10) : 0) ||
          frame.measured?.height ||
          480;

        const xOverlap = Math.max(0, Math.min(flowX + flowWidth, fX + fW) - Math.max(flowX, fX));
        const yOverlap = Math.max(0, Math.min(flowY + flowHeight, fY + fH) - Math.max(flowY, fY));
        const overlapArea = xOverlap * yOverlap;

        // Strict Non-Overlap Enforcement: Check if drawn box intersects with any existing frame
        if (overlapArea > 0) {
          collidedFrame = frame;
          break;
        }
      }

      // If drawn rectangle collides or overlaps with ANY existing container:
      // STRICT NON-OVERLAP ENFORCEMENT: Never allow creating an overlapping group frame!
      if (collidedFrame) {
        setSelectedNodeId(collidedFrame.id);
        setActiveToolMode('select');
        setDrawStartPos(null);
        setDrawCurrentPos(null);
        return;
      }

      const newFrame: Node = {
        id: frameId,
        type: 'groupFrame',
        position: { x: Math.round(flowX), y: Math.round(flowY) },
        zIndex: 0,
        style: { width: Math.round(flowWidth), height: Math.round(flowHeight) },
        data: {
          groupId: frameId,
          numericGroupId: nextGroupNumber,
          title: `Group Area ${nextGroupNumber}`,
          titleBn: `গ্রুপ এলাকা ${nextGroupNumber}`,
          category: 'custom',
          color: frameColor,
          questionIds: enclosedNodeIds,
          questionCount: enclosedNodeIds.length,
          expandedHeight: Math.round(flowHeight),
        },
      };

      recordSnapshot(nodes, edges, groupMeta);

      setNodes((currentNodes) => {
        const updated = currentNodes.map((n) => {
          if (enclosedNodeIds.includes(n.id)) {
            return {
              ...n,
              data: {
                ...n.data,
                containerId: frameId,
                group: nextGroupNumber,
              },
            };
          }
          return n;
        });
        return [newFrame, ...updated];
      });

      setSelectedNodeId(frameId);
      const newTotal = existingFrames.length + 1;
      setGroupMeta((prev) => ({
        ...prev,
        totalGroups: newTotal,
        hasNextGroup: newTotal > (prev.groupNumber || 1),
      }));

      setActiveToolMode('select');
      setDrawStartPos(null);
      setDrawCurrentPos(null);
    },
    [
      drawStartPos,
      nodes,
      edges,
      groupMeta,
      recordSnapshot,
      screenToFlowPosition,
      setNodes,
      setSelectedNodeId,
      setGroupMeta,
    ]
  );

  // Helper to commit reparenting when moving across groups
  const executeInterGroupReparent = useCallback(
    (_movedNodes: Node[], reparentMap: Map<string, Node>) => {
      const reparentedNodeIds = new Set(reparentMap.keys());
      const existingContainers = nodes.filter(
        (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
      );

      const getNodeContainerId = (nodeId: string): string | undefined => {
        if (reparentMap.has(nodeId)) {
          return reparentMap.get(nodeId)!.id;
        }
        const n = nodes.find((item) => item.id === nodeId);
        if (!n) return undefined;
        if ((n.data as any)?.containerId) {
          return (n.data as any).containerId;
        }
        const parentFrame = existingContainers.find((c) =>
          ((c.data as any)?.questionIds || []).includes(n.id)
        );
        if (parentFrame) return parentFrame.id;

        const nW = n.measured?.width || 200;
        const nH = n.measured?.height || 150;
        const cX = n.position.x + nW / 2;
        const cY = n.position.y + nH / 2;
        const spatialFrame = existingContainers.find((c) => {
          const { fX, fY, fW, fH } = getContainerBounds(c);
          return cX >= fX && cX <= fX + fW && cY >= fY && cY <= fY + fH;
        });
        return spatialFrame?.id;
      };

      // Clean Auto-Disconnect on Inter-Group Drop:
      // Auto-sever any connections that tied the moved symbol(s) to their previous group
      const edgesToKeep = edges.filter((e) => {
        const isSourceMoved = reparentedNodeIds.has(e.source);
        const isTargetMoved = reparentedNodeIds.has(e.target);

        // If neither node changed group, keep the edge as-is
        if (!isSourceMoved && !isTargetMoved) {
          return true;
        }

        // If only one endpoint was moved (the other stayed):
        // Auto-sever ALL connections to ensure a clean group transition
        if (isSourceMoved !== isTargetMoved) {
          return false;
        }

        // If both nodes were moved together in the same drag:
        // Drop any cross-group edge, but keep internal connections if they ended up in the same container
        if ((e.data as any)?.isCrossGroup) {
          return false;
        }

        const sourceContainer = getNodeContainerId(e.source);
        const targetContainer = getNodeContainerId(e.target);

        return Boolean(
          sourceContainer &&
            targetContainer &&
            sourceContainer === targetContainer
        );
      });

      recordSnapshot(nodes, edges, groupMeta);

      if (edgesToKeep.length !== edges.length) {
        const keepIds = new Set(edgesToKeep.map((e) => e.id));
        setEdges((currentEdges) => currentEdges.filter((e) => keepIds.has(e.id)));
      }

      setNodes((currentNodes) => {
        const nextNodes = currentNodes.map((n) => {
          if (reparentMap.has(n.id)) {
            const targetContainer = reparentMap.get(n.id)!;
            const targetData = targetContainer.data as any;
            const targetGroupNum =
              targetData?.numericGroupId || parseInt(targetData?.groupId) || 1;
            const targetColor = targetData?.color;

            // Clean up any depends_on, validation, or cross_group_dependency referencing questions outside targetContainer
            const updatedData = { ...n.data };
            if (n.type === 'question') {
              const currentQData = n.data as any;
              if (Array.isArray(currentQData.depends_on) && currentQData.depends_on.length > 0) {
                const targetQIds = new Set(
                  currentNodes
                    .filter((item) => {
                      if (item.id === n.id) return false;
                      const contId = reparentMap.has(item.id)
                        ? reparentMap.get(item.id)!.id
                        : (item.data as any)?.containerId;
                      return contId === targetContainer.id;
                    })
                    .map((item) => (item.data as any)?.question_id)
                    .filter(Boolean)
                );

                const prunedDependsOn = currentQData.depends_on.filter((depId: number) =>
                  targetQIds.has(depId)
                );
                updatedData.depends_on = prunedDependsOn.length > 0 ? prunedDependsOn : undefined;

                if (currentQData.validation) {
                  const prunedValidation: Record<string, any> = {};
                  for (const [key, val] of Object.entries(currentQData.validation)) {
                    if (targetQIds.has(Number(key))) {
                      prunedValidation[key] = val;
                    }
                  }
                  updatedData.validation =
                    Object.keys(prunedValidation).length > 0 ? prunedValidation : undefined;
                }
              }

              if (Array.isArray(currentQData.cross_group_dependency)) {
                updatedData.cross_group_dependency = undefined;
              }
            }

            return {
              ...n,
              data: {
                ...updatedData,
                containerId: targetContainer.id,
                group: targetGroupNum,
                ...(n.type === 'question' && targetColor ? { customColor: targetColor } : {}),
              },
            };
          }

          if (n.type === 'groupFrame' || n.type === 'groupContainer') {
            const currentQIds: string[] = (n.data as any)?.questionIds || [];
            let updatedQIds = [...currentQIds];
            let modified = false;

            // Remove any nodes that left this container (reparented to another group)
            for (const [nodeId, targetContainer] of reparentMap.entries()) {
              if (targetContainer.id !== n.id && updatedQIds.includes(nodeId)) {
                updatedQIds = updatedQIds.filter((id) => id !== nodeId);
                modified = true;
              }
            }

            // Add any nodes that joined this container
            for (const [nodeId, targetContainer] of reparentMap.entries()) {
              if (targetContainer.id === n.id && !updatedQIds.includes(nodeId)) {
                updatedQIds.push(nodeId);
                modified = true;
              }
            }

            if (modified) {
              const currentHeight =
                (n.style?.height ? parseInt(String(n.style.height), 10) : 0) || 220;
              const neededHeight = Math.max(currentHeight, updatedQIds.length * 220 + 120);

              return {
                ...n,
                style: n.type === 'groupFrame' ? { ...n.style, height: neededHeight } : n.style,
                data: {
                  ...n.data,
                  questionIds: updatedQIds,
                  questionCount: updatedQIds.length,
                  expandedHeight: neededHeight,
                },
              };
            }
          }

          return n;
        });

        return nextNodes;
      });
    },
    [nodes, edges, groupMeta, recordSnapshot, setEdges, setNodes]
  );

  // Drag stop handler: handles Smart Non-Overlap Auto-Nudge for groups and Auto-Reparenting for symbols
  const handleNodeDragStop = useCallback(
    (_event: any, draggedNode: Node, draggedNodesList?: Node[]) => {
      onNodeDragStop(nodes);

      if (!draggedNode) return;

      // Case A: Group Frame / Container was dragged
      // Free transit was allowed during drag; on drop, if overlapping another frame, auto-nudge to nearest clear spot!
      if (draggedNode.type === 'groupFrame' || draggedNode.type === 'groupContainer') {
        const otherFrames = nodes
          .filter(
            (n) => (n.type === 'groupFrame' || n.type === 'groupContainer') && n.id !== draggedNode.id
          )
          .map((other) => {
            const { fX, fY, fW, fH } = getContainerBounds(other);
            return { x: fX, y: fY, w: fW, h: fH };
          });

        // Resolve all child symbols inside this container authoritatively
        const childIdSet = new Set<string>();
        nodes.forEach((n) => {
          if (isNodeInContainer(n, draggedNode, nodes)) {
            childIdSet.add(n.id);
          }
        });

        const { fW: frameW, fH: frameH } = getContainerBounds(draggedNode);

        let finalPos = draggedNode.position;
        let nudgeDx = 0;
        let nudgeDy = 0;

        if (otherFrames.length > 0) {
          const nearestClearPos = findNearestNonOverlappingPosition(
            draggedNode.position.x,
            draggedNode.position.y,
            frameW,
            frameH,
            otherFrames,
            30
          );

          nudgeDx = nearestClearPos.x - draggedNode.position.x;
          nudgeDy = nearestClearPos.y - draggedNode.position.y;
          if (Math.abs(nudgeDx) > 1 || Math.abs(nudgeDy) > 1) {
            finalPos = nearestClearPos;
          }
        }

        const numericGroup =
          (draggedNode.data as any)?.numericGroupId ||
          parseInt(String((draggedNode.data as any)?.groupId || '').replace(/\D+/g, ''), 10) ||
          1;

        recordSnapshot(nodes, edges, groupMeta);

        setNodes((currentNodes) =>
          currentNodes.map((n) => {
            if (n.id === draggedNode.id) {
              return {
                ...n,
                position: finalPos,
                data: {
                  ...n.data,
                  questionIds: Array.from(childIdSet),
                  questionCount: childIdSet.size,
                },
              };
            }
            if (childIdSet.has(n.id)) {
              return {
                ...n,
                position: {
                  x: Math.round(n.position.x + nudgeDx),
                  y: Math.round(n.position.y + nudgeDy),
                },
                data: {
                  ...n.data,
                  containerId: draggedNode.id,
                  group: numericGroup,
                },
              };
            }
            return n;
          })
        );
        return;
      }

      // Case B: Symbol or Question was dragged (exclude Start and End terminators from mandatory group containment)
      const activeList =
        draggedNodesList && draggedNodesList.length > 0
          ? draggedNodesList.filter((n) => n.type !== 'groupFrame' && n.type !== 'groupContainer' && n.type !== 'start' && n.type !== 'end')
          : [draggedNode].filter((n) => n.type !== 'groupFrame' && n.type !== 'groupContainer' && n.type !== 'start' && n.type !== 'end');

      if (activeList.length === 0) return;

      const existingContainers = nodes.filter(
        (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
      );

      if (existingContainers.length === 0) return;

      const droppedOutsideNodes: Node[] = [];
      const droppedOnBorderNodes: Node[] = [];
      const movingAcrossNodes: Node[] = [];
      const reparentMap = new Map<string, Node>();
      let primarySourceContainer: Node | null = null;
      let primaryTargetContainer: Node | null = null;

      // Helper to compute safe snapback position inside parent container
      const getSafeSnapbackPos = (node: Node, targetContainer?: Node): { x: number; y: number } => {
        const startPos = dragStartPositionsRef.current.get(node.id);
        const parent =
          targetContainer ||
          dragStartContainersRef.current.get(node.id) ||
          existingContainers.find((c) => isNodeInContainer(node, c, existingContainers)) ||
          existingContainers.find((c) => isNodeOverlappingContainer(node, c));

        if (parent) {
          if (startPos) {
            const dummyAtStart = { ...node, position: startPos };
            if (isNodeCleanlyInsideContainer(dummyAtStart, parent)) {
              return startPos;
            }
          }
          const { fX, fY, fW, fH } = getContainerBounds(parent);
          const { width, height } = getNodeDimensions(node);
          const safeX = Math.max(
            fX + GROUP_BORDER_INSET + 16,
            Math.min(node.position.x, fX + fW - GROUP_BORDER_INSET - 16 - width)
          );
          const safeY = Math.max(
            fY + GROUP_HEADER_INSET + 16,
            Math.min(node.position.y, fY + fH - GROUP_BORDER_INSET - 16 - height)
          );
          return { x: safeX, y: safeY };
        }

        return startPos || node.position;
      };

      for (const node of activeList) {
        const nodeInState = nodes.find((n) => n.id === node.id) || node;
        // Resolve original parent container before drag
        const prevContainer =
          dragStartContainersRef.current.get(node.id) ||
          existingContainers.find((c) => isNodeInContainer(nodeInState, c, existingContainers));

        // Check if node is cleanly inside any container
        const cleanContainer = existingContainers.find((c) =>
          isNodeCleanlyInsideContainer(node, c)
        );

        if (cleanContainer) {
          // Node is cleanly inside a container (away from all borders and header)
          if (prevContainer && cleanContainer.id !== prevContainer.id) {
            // Cleanly moved to a DIFFERENT container -> prompt warning modal!
            movingAcrossNodes.push(node);
            reparentMap.set(node.id, cleanContainer);
            if (!primarySourceContainer) primarySourceContainer = prevContainer;
            if (!primaryTargetContainer) primaryTargetContainer = cleanContainer;
          } else if (!prevContainer) {
            // Unparented node cleanly dropped into a container
            reparentMap.set(node.id, cleanContainer);
          }
          // If cleanly dropped inside its own parent container -> valid move!
          continue;
        }

        // Node is NOT cleanly inside any container.
        // Check if it overlaps (partially touches/intersects) ANY container
        const overlappingContainer = existingContainers.find((c) =>
          isNodeOverlappingContainer(node, c)
        );

        if (overlappingContainer) {
          // Node is placed partially on the border of a container (its own or another group)!
          droppedOnBorderNodes.push(node);
        } else {
          // Node is dropped completely outside all group containers on empty canvas
          droppedOutsideNodes.push(node);
        }
      }

      // 1. Enforce: Questions/symbols can't be taken outside of a group area
      if (droppedOutsideNodes.length > 0) {
        setNodes((currentNodes) =>
          currentNodes.map((n) => {
            if (activeList.some((d) => d.id === n.id)) {
              const prevCont =
                dragStartContainersRef.current.get(n.id) ||
                existingContainers.find((c) => isNodeInContainer(n, c, existingContainers));
              const safePos = getSafeSnapbackPos(n, prevCont);
              return {
                ...n,
                position: { ...safePos },
              };
            }
            return n;
          })
        );
        showContainmentToast('Questions and symbols cannot be placed outside of a group area.');
        return;
      }

      // 2. Enforce: Symbols shouldn't also be placed on the group border
      // If ANY part of the symbol is on the group border, snap back to parent group!
      if (droppedOnBorderNodes.length > 0) {
        setNodes((currentNodes) =>
          currentNodes.map((n) => {
            if (activeList.some((d) => d.id === n.id)) {
              const borderCont =
                dragStartContainersRef.current.get(n.id) ||
                existingContainers.find((c) => isNodeOverlappingContainer(n, c));
              const safePos = getSafeSnapbackPos(n, borderCont);
              return {
                ...n,
                position: { ...safePos },
              };
            }
            return n;
          })
        );
        showContainmentToast('Questions and symbols cannot be placed on the group border.');
        return;
      }

      // 3. Enforce: Moving from one group to another shows a warning popup
      if (movingAcrossNodes.length > 0 && primarySourceContainer && primaryTargetContainer) {
        const sourceCont = primarySourceContainer;
        const targetCont = primaryTargetContainer;
        const currentReparentMap = new Map(reparentMap);

        setPendingGroupTransfer({
          nodes: movingAcrossNodes,
          sourceContainer: sourceCont,
          targetContainer: targetCont,
          onConfirm: () => {
            executeInterGroupReparent(movingAcrossNodes, currentReparentMap);
          },
          onCancel: () => {
            setNodes((currentNodes) =>
              currentNodes.map((n) => {
                if (movingAcrossNodes.some((m) => m.id === n.id)) {
                  const safePos = getSafeSnapbackPos(n, sourceCont);
                  return {
                    ...n,
                    position: { ...safePos },
                  };
                }
                return n;
              })
            );
          },
        });
        return;
      }

      // 4. Directly reparent if node had no previous container
      if (reparentMap.size > 0) {
        executeInterGroupReparent(activeList, reparentMap);
      }
    },
    [
      nodes,
      edges,
      groupMeta,
      onNodeDragStop,
      recordSnapshot,
      setNodes,
      executeInterGroupReparent,
      showContainmentToast,
    ]
  );

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

      // Strict Group Area Enforcement (Option 1):
      // If dropped outside any Group Area, auto-instantiate a new Group Area so no node is ever orphaned!
      if (!targetContainer && nodeType !== 'groupFrame') {
        const existingFrames = nodes.filter(
          (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
        );
        const existingGroupNumbers = existingFrames
          .map((f) => (f.data as any)?.numericGroupId || parseInt((f.data as any)?.groupId) || 1)
          .filter((g) => !isNaN(g) && g > 0);
        const nextGroupNumber =
          existingGroupNumbers.length > 0 ? Math.max(...existingGroupNumbers) + 1 : 1;

        const newFrameId = `grp-frame-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`;
        const GROUP_PALETTE = ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
        const frameColor = GROUP_PALETTE[(nextGroupNumber - 1) % GROUP_PALETTE.length];

        const frameX = Math.round(position.x - 85);
        const frameY = Math.round(position.y - 60);

        const newFrameNode: Node = {
          id: newFrameId,
          type: 'groupFrame',
          position: { x: frameX, y: frameY },
          zIndex: 0,
          style: { width: 440, height: 480 },
          data: {
            groupId: newFrameId,
            numericGroupId: nextGroupNumber,
            title: `Group Area ${nextGroupNumber}`,
            titleBn: `গ্রুপ এলাকা ${nextGroupNumber}`,
            category: 'custom',
            color: frameColor,
            questionIds: [newNodeId],
            questionCount: 1,
            expandedHeight: 480,
          },
        };

        const itemX = frameX + 85;
        const itemY = frameY + 60;

        if (nodeType === 'question') {
          nodeData = {
            question_id: newQId,
            group: nextGroupNumber,
            containerId: newFrameId,
            customColor: frameColor,
            question: name || 'New Question',
            question_bn: nameBn || name || 'নতুন প্রশ্ন',
            answer_type: answerType || 'string',
            mandatory: true,
            editable: true,
            placeholder: '',
            hint: '',
            options: options || '',
          };
        } else if (nodeType === 'decision') {
          nodeData = {
            label: 'Condition Check',
            conditionType: 'match',
            comparisonValue: 'Yes',
            containerId: newFrameId,
            group: nextGroupNumber,
          };
        } else if (nodeType === 'groupJump') {
          nodeData = {
            targetGroupId: nextGroupNumber + 1,
            targetGroupTitle: `Group ${nextGroupNumber + 1}`,
            containerId: newFrameId,
            group: nextGroupNumber,
          };
        } else {
          nodeData = {
            label: name || nodeType.toUpperCase(),
            containerId: newFrameId,
            group: nextGroupNumber,
          };
        }

        const newNode: Node = {
          id: newNodeId,
          type: nodeType,
          position: { x: itemX, y: itemY },
          zIndex: 10,
          data: nodeData,
        };

        recordSnapshot(nodes, edges, groupMeta);
        setNodes((nds) => nds.concat(newFrameNode, newNode));
        setSelectedNodeId(newNodeId);
        const newTotal = existingFrames.length + 1;
        setGroupMeta((prev) => ({
          ...prev,
          totalGroups: newTotal,
          hasNextGroup: newTotal > (prev.groupNumber || 1),
        }));
        return;
      }

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
          containerId: targetContainer?.id,
          group: (targetContainer?.data as any)?.numericGroupId || groupMeta.groupNumber,
        };
      } else if (nodeType === 'groupJump') {
        nodeData = {
          targetGroupId: groupMeta.groupNumber + 1,
          targetGroupTitle: `Group ${groupMeta.groupNumber + 1}`,
          containerId: targetContainer?.id,
          group: (targetContainer?.data as any)?.numericGroupId || groupMeta.groupNumber,
        };
      } else {
        nodeData = {
          label: name || nodeType.toUpperCase(),
          containerId: targetContainer?.id,
          group: (targetContainer?.data as any)?.numericGroupId || groupMeta.groupNumber,
        };
      }

      // If dropped inside a container or frame, place it cleanly inside
      let nodePos = position;
      let dropNeededWidth: number | undefined;
      let dropNeededHeight: number | undefined;
      if (targetContainer) {
        const { fX, fY, fW, fH } = getContainerBounds(targetContainer);
        const { width: itemW, height: itemH } = getNodeDimensions({
          type: nodeType,
          data: nodeData,
        } as any);

        if (nodeType === 'question') {
          const existingChildren = nodes.filter((n) => isNodeInContainer(n, targetContainer, nodes));
          dropNeededWidth = Math.max(fW, itemW + 48);
          const posX = fX + Math.max(20, Math.round((dropNeededWidth - itemW) / 2));

          const headerBottom = fY + GROUP_HEADER_INSET;
          let lowestBottom = headerBottom + 16;
          for (const child of existingChildren) {
            const { height: childH } = getNodeDimensions(child);
            const b = child.position.y + childH;
            if (b > lowestBottom) {
              lowestBottom = b;
            }
          }
          const posY = existingChildren.length === 0 ? fY + 60 : lowestBottom + 20;
          dropNeededHeight = Math.max(fH, (posY + itemH + 36) - fY);
          nodePos = { x: posX, y: posY };
        } else {
          // Clamp symbol position so it stays comfortably inside the target frame, away from all borders
          dropNeededWidth = Math.max(fW, itemW + 48);
          const clampedX = Math.max(
            fX + GROUP_BORDER_INSET + 8,
            Math.min(position.x, fX + dropNeededWidth - itemW - GROUP_BORDER_INSET - 8)
          );
          const clampedY = Math.max(
            fY + GROUP_HEADER_INSET + 12,
            Math.min(position.y, fY + fH - itemH - GROUP_BORDER_INSET - 8)
          );
          dropNeededHeight = Math.max(fH, (clampedY + itemH + 36) - fY);
          nodePos = { x: clampedX, y: clampedY };
        }
      }

      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        position: nodePos,
        zIndex: nodeType === 'groupFrame' || nodeType === 'groupContainer' ? 0 : 10,
        style: nodeType === 'groupFrame' ? { width: 440, height: 480 } : undefined,
        data: nodeData,
      };

      recordSnapshot(nodes, edges, groupMeta);

      setNodes((nds) => {
        const nextNodes = nds.concat(newNode);
        if (targetContainer && nodeType !== 'groupFrame' && nodeType !== 'groupContainer') {
          return nextNodes.map((n) => {
            if (n.id === targetContainer.id) {
              const prevIds = (n.data as any).questionIds || [];
              const updatedIds = prevIds.includes(newNodeId) ? prevIds : [...prevIds, newNodeId];
              const newCount = updatedIds.length;
              const curW = dropNeededWidth || (n.style?.width ? parseInt(String(n.style.width), 10) : 440);
              const curH = dropNeededHeight || (n.style?.height ? parseInt(String(n.style.height), 10) : 480);
              return {
                ...n,
                width: curW,
                height: curH,
                style: n.type === 'groupFrame' ? { ...n.style, width: curW, height: curH } : n.style,
                data: {
                  ...n.data,
                  width: curW,
                  height: curH,
                  questionIds: updatedIds,
                  questionCount: newCount,
                  expandedHeight: curH,
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
    [nodes, edges, groupMeta, recordSnapshot, screenToFlowPosition, setNodes, handleInsertGroupIntoCanvas]
  );

  // Helper to authoritatively resolve target frame for adding inputs / symbols
  const resolveTargetFrame = useCallback(
    (currentNodes: Node[], preferredId: string | null) => {
      const existingFrames = currentNodes.filter(
        (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
      );
      // 1. Direct match with preferredId (e.g. selectedNodeId)
      let targetFrame = existingFrames.find((f) => f.id === preferredId);

      // 2. If a child node is selected, find its container frame
      if (!targetFrame && preferredId) {
        const sel = currentNodes.find((n) => n.id === preferredId);
        if (sel) {
          targetFrame = existingFrames.find((f) => isNodeInContainer(sel, f, currentNodes));
          if (!targetFrame && (sel.data as any)?.containerId) {
            targetFrame = existingFrames.find((f) => f.id === (sel.data as any).containerId);
          }
          if (!targetFrame && (sel.data as any)?.group) {
            const gNum = (sel.data as any).group;
            targetFrame = existingFrames.find(
              (f) =>
                (f.data as any)?.numericGroupId === gNum ||
                (f.data as any)?.groupId === gNum ||
                (f.data as any)?.groupId === String(gNum)
            );
          }
        }
      }

      // 3. If preferredId is null or unmatched, check if any frame has selected === true
      if (!targetFrame) {
        targetFrame = existingFrames.find((f) => f.selected);
      }

      // 4. Check if any selected child node belongs to a frame
      if (!targetFrame) {
        const selChild = currentNodes.find(
          (n) => n.selected && n.type !== 'groupFrame' && n.type !== 'groupContainer'
        );
        if (selChild) {
          targetFrame = existingFrames.find((f) => isNodeInContainer(selChild, f, currentNodes));
        }
      }

      // 5. If there is only 1 group frame on canvas, default to that frame
      if (!targetFrame && existingFrames.length === 1) {
        targetFrame = existingFrames[0];
      }

      return targetFrame;
    },
    []
  );

  // Click-to-add from Flowchart Symbols palette
  const handleAddSymbol = useCallback(
    (nodeType: FlowNodeType, name: string, nameBn: string) => {
      if (nodeType === 'groupFrame') {
        handleCreateNewGroupArea();
        return;
      }

      const existingFrames = nodes.filter(
        (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
      );
      const targetFrame = resolveTargetFrame(nodes, selectedNodeId);

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

      // If no group is selected on canvas and no default applies: automatically create a new group with this symbol!
      if (!targetFrame) {
        const { frameId, nextGroupNumber, frameColor, resolvedPos } = getNextGroupAreaConfig(existingFrames);
        const newFrameNode: Node = {
          id: frameId,
          type: 'groupFrame',
          position: resolvedPos,
          zIndex: 0,
          style: { width: 440, height: 480 },
          data: {
            groupId: frameId,
            numericGroupId: nextGroupNumber,
            title: `Group Area ${nextGroupNumber}`,
            titleBn: `গ্রুপ এলাকা ${nextGroupNumber}`,
            category: 'custom',
            color: frameColor,
            questionIds: [newNodeId],
            questionCount: 1,
            expandedHeight: 480,
          },
        };

        let nodeData: any = {};
        if (nodeType === 'question') {
          nodeData = {
            question_id: newQId,
            group: nextGroupNumber,
            containerId: frameId,
            customColor: frameColor,
            question: name || 'New Question',
            question_bn: nameBn || name || 'নতুন প্রশ্ন',
            answer_type: 'string',
            mandatory: true,
            editable: true,
            placeholder: '',
            hint: '',
            options: '',
          };
        } else if (nodeType === 'decision') {
          nodeData = {
            label: 'Condition Check',
            conditionType: 'match',
            comparisonValue: 'Yes',
            containerId: frameId,
            group: nextGroupNumber,
          };
        } else if (nodeType === 'groupJump') {
          nodeData = {
            targetGroupId: nextGroupNumber + 1,
            targetGroupTitle: `Group ${nextGroupNumber + 1}`,
            containerId: frameId,
            group: nextGroupNumber,
          };
        } else {
          nodeData = {
            label: name || nodeType.toUpperCase(),
            containerId: frameId,
            group: nextGroupNumber,
          };
        }

        const newNode: Node = {
          id: newNodeId,
          type: nodeType,
          position: { x: resolvedPos.x + 85, y: resolvedPos.y + 60 },
          zIndex: 10,
          data: nodeData,
        };

        recordSnapshot(nodes, edges, groupMeta);
        setNodes((nds) => nds.concat(newFrameNode, newNode));
        setSelectedNodeId(newNodeId);
        return;
      }

      // If targetFrame exists, nest neatly inside it
      const cData = targetFrame.data as any;
      const numGrp = cData.numericGroupId || parseInt(cData.groupId) || groupMeta.groupNumber;

      let nodeData: any = {};
      if (nodeType === 'question') {
        nodeData = {
          question_id: newQId,
          group: numGrp,
          containerId: targetFrame.id,
          customColor: cData.color,
          question: name || 'New Question',
          question_bn: nameBn || name || 'নতুন প্রশ্ন',
          answer_type: 'string',
          mandatory: true,
          editable: true,
          placeholder: '',
          hint: '',
          options: '',
        };
      } else if (nodeType === 'decision') {
        nodeData = {
          label: 'Condition Check',
          conditionType: 'match',
          comparisonValue: 'Yes',
          containerId: targetFrame.id,
          group: numGrp,
        };
      } else if (nodeType === 'groupJump') {
        nodeData = {
          targetGroupId: numGrp + 1,
          targetGroupTitle: `Group ${numGrp + 1}`,
          containerId: targetFrame.id,
          group: numGrp,
        };
      } else {
        nodeData = {
          label: name || nodeType.toUpperCase(),
          containerId: targetFrame.id,
          group: numGrp,
        };
      }

      const existingChildren = nodes.filter((n) => isNodeInContainer(n, targetFrame, nodes));
      const { fX, fY, fW, fH } = getContainerBounds(targetFrame);
      const { width: symW, height: symH } = getNodeDimensions({
        type: nodeType,
        data: nodeData,
      } as any);

      const neededWidth = Math.max(fW, symW + 48);
      const posX = fX + Math.max(20, Math.round((neededWidth - symW) / 2));

      const headerBottom = fY + GROUP_HEADER_INSET;
      let lowestBottom = headerBottom + 16;
      for (const child of existingChildren) {
        const { height: childH } = getNodeDimensions(child);
        const b = child.position.y + childH;
        if (b > lowestBottom) {
          lowestBottom = b;
        }
      }
      const posY = existingChildren.length === 0 ? fY + 60 : lowestBottom + 20;
      const neededHeight = Math.max(fH, (posY + symH + 36) - fY);

      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        position: { x: posX, y: posY },
        zIndex: 10,
        data: nodeData,
      };

      recordSnapshot(nodes, edges, groupMeta);
      setNodes((nds) => {
        const nextNodes = nds.concat(newNode);
        return nextNodes.map((n) => {
          if (n.id === targetFrame.id) {
            const prevIds = (n.data as any)?.questionIds || [];
            const updatedIds = prevIds.includes(newNodeId) ? prevIds : [...prevIds, newNodeId];
            const newCount = updatedIds.length;
            return {
              ...n,
              width: neededWidth,
              height: neededHeight,
              style: {
                ...n.style,
                width: neededWidth,
                height: neededHeight,
              },
              data: {
                ...n.data,
                width: neededWidth,
                height: neededHeight,
                expandedHeight: neededHeight,
                questionIds: updatedIds,
                questionCount: newCount,
              },
            };
          }
          return n;
        });
      });
      setSelectedNodeId(newNodeId);
    },
    [nodes, edges, groupMeta, recordSnapshot, setNodes, selectedNodeId, handleCreateNewGroupArea, getNextGroupAreaConfig, resolveTargetFrame]
  );

  // Click-to-add from Input Type Views palette
  const handleAddQuestionFromWidget = useCallback(
    (answerType: AnswerType, name: string, nameBn: string, options?: string) => {
      const existingFrames = nodes.filter(
        (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
      );
      const targetFrame = resolveTargetFrame(nodes, selectedNodeId);

      const currentHighestId = nodes.reduce((max, n) => {
        if (n.type === 'question' && (n.data as any)?.question_id) {
          return Math.max(max, Number((n.data as any).question_id) || 0);
        }
        return max;
      }, 100);

      const newQId = currentHighestId + 1;
      const newNodeId = `q-${newQId}`;

      // If no group is selected in the canvas: automatically create a new group with this question!
      if (!targetFrame) {
        const { frameId, nextGroupNumber, frameColor, resolvedPos } = getNextGroupAreaConfig(existingFrames);
        const newFrameNode: Node = {
          id: frameId,
          type: 'groupFrame',
          position: resolvedPos,
          zIndex: 0,
          style: { width: 440, height: 480 },
          data: {
            groupId: frameId,
            numericGroupId: nextGroupNumber,
            title: `Group Area ${nextGroupNumber}`,
            titleBn: `গ্রুপ এলাকা ${nextGroupNumber}`,
            category: 'custom',
            color: frameColor,
            questionIds: [newNodeId],
            questionCount: 1,
            expandedHeight: 480,
          },
        };

        const newNode: Node = {
          id: newNodeId,
          type: 'question',
          position: { x: resolvedPos.x + 85, y: resolvedPos.y + 60 },
          zIndex: 10,
          data: {
            question_id: newQId,
            group: nextGroupNumber,
            containerId: frameId,
            customColor: frameColor,
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

        recordSnapshot(nodes, edges, groupMeta);
        setNodes((nds) => nds.concat(newFrameNode, newNode));
        setSelectedNodeId(newNodeId);
        return;
      }

      // If targetFrame exists, nest cleanly inside it
      const cData = targetFrame.data as any;
      const numGrp = cData.numericGroupId || parseInt(cData.groupId) || groupMeta.groupNumber;

      const nodeData = {
        question_id: newQId,
        group: numGrp,
        containerId: targetFrame.id,
        customColor: cData.color,
        question: name || 'New Question',
        question_bn: nameBn || name || 'নতুন প্রশ্ন',
        answer_type: answerType,
        mandatory: true,
        editable: true,
        placeholder: '',
        hint: '',
        options: options || '',
      };

      const existingChildren = nodes.filter((n) => isNodeInContainer(n, targetFrame, nodes));
      const { fX, fY, fW, fH } = getContainerBounds(targetFrame);
      const { width: nodeW, height: nodeH } = getNodeDimensions({
        type: 'question',
        data: nodeData,
      } as any);

      // Ensure targetFrame is wide enough for the question
      const neededWidth = Math.max(fW, nodeW + 48);
      const posX = fX + Math.max(20, Math.round((neededWidth - nodeW) / 2));

      // Calculate vertical position: 20px below lowest child, or 60px below top if empty
      const headerBottom = fY + GROUP_HEADER_INSET;
      let lowestBottom = headerBottom + 16;
      for (const child of existingChildren) {
        const { height: childH } = getNodeDimensions(child);
        const b = child.position.y + childH;
        if (b > lowestBottom) {
          lowestBottom = b;
        }
      }
      const posY = existingChildren.length === 0 ? fY + 60 : lowestBottom + 20;

      // Expand frame height to enclose the new question with 36px bottom cushion
      const neededHeight = Math.max(fH, (posY + nodeH + 36) - fY);

      const newNode: Node = {
        id: newNodeId,
        type: 'question',
        position: { x: posX, y: posY },
        zIndex: 10,
        data: nodeData,
      };

      recordSnapshot(nodes, edges, groupMeta);
      setNodes((nds) => {
        const nextNodes = nds.concat(newNode);
        return nextNodes.map((n) => {
          if (n.id === targetFrame.id) {
            const prevIds = (n.data as any)?.questionIds || [];
            const updatedIds = prevIds.includes(newNodeId) ? prevIds : [...prevIds, newNodeId];
            const newCount = updatedIds.length;
            return {
              ...n,
              width: neededWidth,
              height: neededHeight,
              style: {
                ...n.style,
                width: neededWidth,
                height: neededHeight,
              },
              data: {
                ...n.data,
                width: neededWidth,
                height: neededHeight,
                expandedHeight: neededHeight,
                questionIds: updatedIds,
                questionCount: newCount,
              },
            };
          }
          return n;
        });
      });
      setSelectedNodeId(newNodeId);
    },
    [nodes, edges, groupMeta, recordSnapshot, setNodes, selectedNodeId, getNextGroupAreaConfig, resolveTargetFrame]
  );

  // Update Node Data
  const handleUpdateNodeData = useCallback(
    (nodeId: string, newData: any) => {
      recordSnapshot(nodes, edges, groupMeta);
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
    [nodes, edges, groupMeta, recordSnapshot, setNodes]
  );

  // Update Edge Data
  const handleUpdateEdgeData = useCallback(
    (edgeId: string, newEdgeData: any) => {
      recordSnapshot(nodes, edges, groupMeta);
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === edgeId) {
            let label = edge.label;
            if (newEdgeData.label !== undefined) {
              label = newEdgeData.label;
            } else if (newEdgeData.validationType && newEdgeData.triggerValue) {
              label = `${newEdgeData.validationType.toUpperCase()} "${newEdgeData.triggerValue}"`;
            }

            const { targetHandle, sourceHandle, ...restData } = newEdgeData;
            return {
              ...edge,
              ...(targetHandle !== undefined ? { targetHandle } : {}),
              ...(sourceHandle !== undefined ? { sourceHandle } : {}),
              label,
              data: {
                ...edge.data,
                ...restData,
              },
            };
          }
          return edge;
        })
      );
    },
    [nodes, edges, groupMeta, recordSnapshot, setEdges]
  );

  // Add Edge
  const handleAddEdge = useCallback(
    (newEdge: Edge) => {
      recordSnapshot(nodes, edges, groupMeta);
      setEdges((eds) => [...eds, newEdge]);
    },
    [nodes, edges, groupMeta, recordSnapshot, setEdges]
  );

  // Delete Edge
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      recordSnapshot(nodes, edges, groupMeta);
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [nodes, edges, groupMeta, recordSnapshot, setEdges]
  );

  // Update Group Meta
  const handleUpdateGroupMeta = useCallback(
    (newMeta: Partial<GroupMeta>) => {
      recordSnapshot(nodes, edges, groupMeta);
      setGroupMeta((prev) => ({
        ...prev,
        ...newMeta,
      }));
    },
    [nodes, edges, groupMeta, recordSnapshot]
  );

  // Delete Node (Cascades to all children if node is a Group Container or Group Frame)
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      recordSnapshot(nodes, edges, groupMeta);
      const targetNode = nodes.find((n) => n.id === nodeId);
      const toDelete = new Set<string>([nodeId]);

      if (
        targetNode &&
        (targetNode.type === 'groupContainer' || targetNode.type === 'groupFrame')
      ) {
        const childIds: string[] = (targetNode.data as any)?.questionIds || [];
        childIds.forEach((cid) => toDelete.add(cid));

        const frameWidth =
          Number(targetNode.style?.width) || (targetNode.data as any)?.width || 440;
        const frameHeight =
          Number(targetNode.style?.height) || (targetNode.data as any)?.height || 480;
        const fx = targetNode.position.x;
        const fy = targetNode.position.y;

        nodes.forEach((n) => {
          if (n.id !== nodeId) {
            if ((n.data as any)?.containerId === nodeId) {
              toDelete.add(n.id);
            } else if (
              n.position.x >= fx - 10 &&
              n.position.x <= fx + frameWidth + 10 &&
              n.position.y >= fy - 10 &&
              n.position.y <= fy + frameHeight + 10
            ) {
              toDelete.add(n.id);
            }
          }
        });
      }

      setNodes((nds) => nds.filter((n) => !toDelete.has(n.id)));
      setEdges((eds) =>
        eds.filter(
          (e) =>
            !toDelete.has(e.source) &&
            !toDelete.has(e.target) &&
            (e.data as any)?.containerId !== nodeId
        )
      );
      if (selectedNodeId && toDelete.has(selectedNodeId)) {
        setSelectedNodeId(null);
      }
    },
    [nodes, edges, groupMeta, recordSnapshot, selectedNodeId, setNodes, setEdges]
  );

  // Duplicate Node
  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      recordSnapshot(nodes, edges, groupMeta);
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
    [nodes, edges, groupMeta, recordSnapshot, setNodes]
  );

  // Active mutation dispatchers for Inspector panel
  const activeUpdateNodeData = handleUpdateNodeData;
  const activeDeleteNode = handleDeleteNode;
  const activeDuplicateNode = handleDuplicateNode;
  const activeUpdateEdgeData = handleUpdateEdgeData;
  const activeDeleteEdge = handleDeleteEdge;

  // Auto-branch from option handle
  const handleAddNestedQuestion = useCallback(
    (parentNodeId: string, optionValue: string) => {
      recordSnapshot(nodes, edges, groupMeta);
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

      const existingFrames = nodes.filter(
        (n) => n.type === 'groupFrame' || n.type === 'groupContainer'
      );
      const parentFrame = existingFrames.find((f) => isNodeInContainer(parentNode, f, nodes));

      let posX = parentNode.position.x + 360;
      let posY = parentNode.position.y + childCount * 170;
      let neededWidth: number | undefined;
      let neededHeight: number | undefined;

      if (parentFrame) {
        const existingChildren = nodes.filter((n) => isNodeInContainer(n, parentFrame, nodes));
        const { fX, fY, fW, fH } = getContainerBounds(parentFrame);
        const nodeW = 270;
        const nodeH = 180;
        neededWidth = Math.max(fW, nodeW + 48);
        posX = fX + Math.max(20, Math.round((neededWidth - nodeW) / 2));

        const headerBottom = fY + GROUP_HEADER_INSET;
        let lowestBottom = headerBottom + 16;
        for (const child of existingChildren) {
          const { height: childH } = getNodeDimensions(child);
          const b = child.position.y + childH;
          if (b > lowestBottom) {
            lowestBottom = b;
          }
        }
        posY = lowestBottom + 20;
        neededHeight = Math.max(fH, (posY + nodeH + 36) - fY);
      }

      const pData = parentNode.data as any;
      const fData = parentFrame ? (parentFrame.data as any) : null;
      const groupNum = fData?.numericGroupId || parseInt(fData?.groupId) || pData?.group || 1;

      const newNode: Node = {
        id: newNodeId,
        type: 'question',
        position: { x: posX, y: posY },
        zIndex: 10,
        data: {
          question_id: newQId,
          group: groupNum,
          containerId: parentFrame ? parentFrame.id : pData?.containerId,
          customColor: fData?.color || pData?.customColor,
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

      setNodes((nds) => {
        const nextNodes = nds.concat(newNode);
        if (parentFrame) {
          return nextNodes.map((n) => {
            if (n.id === parentFrame.id) {
              const prevIds = (n.data as any)?.questionIds || [];
              const updatedIds = prevIds.includes(newNodeId) ? prevIds : [...prevIds, newNodeId];
              const newCount = updatedIds.length;
              return {
                ...n,
                width: neededWidth,
                height: neededHeight,
                style: {
                  ...n.style,
                  width: neededWidth,
                  height: neededHeight,
                },
                data: {
                  ...n.data,
                  width: neededWidth,
                  height: neededHeight,
                  expandedHeight: neededHeight,
                  questionIds: updatedIds,
                  questionCount: newCount,
                },
              };
            }
            return n;
          });
        }
        return nextNodes;
      });
      setEdges((eds) => eds.concat(newEdge));
      setSelectedNodeId(newNodeId);
    },
    [nodes, edges, groupMeta, recordSnapshot, edgeRouting, setNodes, setEdges]
  );

  // Hierarchical DAG Auto-Layout
  const handleAutoLayout = useCallback(() => {
    recordSnapshot(nodes, edges, groupMeta);
    const arrangedNodes = calculateHierarchicalLayout(nodes, edges);
    setNodes(arrangedNodes);
    setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 60);
  }, [nodes, edges, groupMeta, recordSnapshot, setNodes, fitView]);

  // Align tools
  const handleAlignHorizontal = useCallback(() => {
    recordSnapshot(nodes, edges, groupMeta);
    setNodes((nds) => alignNodesHorizontal(nds, selectedNodeId ? [selectedNodeId] : undefined));
  }, [nodes, edges, groupMeta, recordSnapshot, selectedNodeId, setNodes]);

  const handleAlignVertical = useCallback(() => {
    recordSnapshot(nodes, edges, groupMeta);
    setNodes((nds) => alignNodesVertical(nds, selectedNodeId ? [selectedNodeId] : undefined));
  }, [nodes, edges, groupMeta, recordSnapshot, selectedNodeId, setNodes]);

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

  // Clear canvas handler: completely blank flowchart
  const handleClearCanvas = useCallback(() => {
    if (window.confirm('Clear all symbols and connections from this flowchart canvas?')) {
      recordSnapshot(nodes, edges, groupMeta);
      setNodes([]);
      setEdges([]);
      setGroupMeta({
        totalGroups: 1,
        groupNumber: 1,
        hasNextGroup: false,
        instruction: '',
        groupJumps: [],
      });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, [nodes, edges, groupMeta, recordSnapshot, setNodes, setEdges, setGroupMeta]);

  // Reset to sample initial schema
  const handleResetSample = useCallback(() => {
    if (
      window.confirm(
        'Reset current flowchart to the default Sofol Dynamic KYC sample?'
      )
    ) {
      recordSnapshot(nodes, edges, groupMeta);
      const parsed = parseSchemaToFlow(SAMPLE_INITIAL_SCHEMA);
      setNodes(parsed.nodes);
      setEdges(parsed.edges);
      setGroupMeta(parsed.meta);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    }
  }, [nodes, edges, groupMeta, recordSnapshot, setNodes, setEdges, fitView]);

  // Compile current schema
  const currentCompiledSchema = useMemo(() => {
    return compileFlowToSchema(nodes, edges, groupMeta);
  }, [nodes, edges, groupMeta]);

  // Import JSON schema handler
  const handleImportSchema = useCallback(
    (schema: DynamicKycGroupResponse) => {
      recordSnapshot(nodes, edges, groupMeta);
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
    [nodes, edges, groupMeta, recordSnapshot, setNodes, setEdges, fitView, activeProject, setProjects, setActiveView]
  );

  /**
   * Fits the viewport smoothly to the currently selected group, or the group containing
   * the currently selected node, or the first group found on the canvas.
   */
  const handleFitToGroup = useCallback((targetGroupId?: string) => {
    let groupNode: Node | undefined;
    if (targetGroupId) {
      groupNode = nodes.find((n) => n.id === targetGroupId);
    } else if (selectedNodeId) {
      const selected = nodes.find((n) => n.id === selectedNodeId);
      if (selected?.type === 'groupContainer' || selected?.type === 'groupFrame') {
        groupNode = selected;
      } else if (selected) {
        const cId = (selected.data as any)?.containerId || resolveNodeGroupId(selected, nodes);
        if (cId) {
          groupNode = nodes.find((n) => n.id === cId);
        }
      }
    }

    if (!groupNode) {
      groupNode = nodes.find((n) => n.type === 'groupContainer' || n.type === 'groupFrame');
    }

    if (!groupNode) {
      fitView({ padding: 0.2, duration: 400 });
      return;
    }

    const gId = groupNode.id;
    const members = nodes.filter(
      (n) => n.id === gId || isNodeInContainer(n, groupNode!, nodes)
    );

    fitView({
      nodes: members.length > 0 ? members : [groupNode],
      padding: 0.25,
      duration: 400,
    });
  }, [nodes, selectedNodeId, fitView]);

  return (
    <div className="app-container">
      {/* MAIN APPLICATION CONTENT AREA (Edge-to-edge full width layout) */}
      <div className="admin-main-viewport">
        {activeView === 'list' ? (
          <FlowchartListView
            projects={projects}
            activeProjectId={activeProjectId}
            isServerConnected={isServerConnected}
            onOpenProject={handleSelectProject}
            onCreateNew={() => setIsCreateModalOpen(true)}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={(id) => {
              handleDeleteProject(id, (nextId) => {
                if (nextId) {
                  selectProjectById(nextId, (target) => {
                    setNodes(target.nodes);
                    setEdges(target.edges);
                    setGroupMeta(target.groupMeta);
                  });
                } else {
                  setNodes([]);
                  setEdges([]);
                }
              });
            }}
            onOpenVersionHistory={(proj) => {
              setVersionHistoryTargetProject(proj);
              setIsVersionHistoryModalOpen(true);
            }}
            onNavigateToStudio={() => {
              if (projects.length === 0) {
                handleCreateNewProject(
                  'My Survey Flowchart',
                  '',
                  'Dynamic KYC and field assessment survey flowchart',
                  1
                );
                return;
              }
              setActiveView('editor');
            }}
            onNavigateToGroups={() => {
              refreshGroups();
              setActiveView('groups');
            }}
            activeProjectTitle={activeProject?.title || 'Survey Flowchart'}
            theme={theme}
            resolvedTheme={resolvedTheme}
            onCycleTheme={cycleTheme}
          />
        ) : activeView === 'groups' ? (
          <QuestionGroupListView
            groups={groups}
            onCreateGroupInStudio={() => setIsCreateGroupModalOpen(true)}
            onEditGroupInStudio={handleEditGroupInStudio}
            onDeleteGroup={handleDeleteGroup}
            onInsertGroupIntoCanvas={(grp) => handleInsertGroupIntoCanvas(grp)}
            onResetDefaults={handleResetDefaultGroups}
            onNavigateToStudio={() => setActiveView('editor')}
            onNavigateToList={() => {
              refreshProjects();
              setActiveView('list');
            }}
            activeProjectTitle={activeProject?.title || 'Survey Flowchart'}
            theme={theme}
            resolvedTheme={resolvedTheme}
            onCycleTheme={cycleTheme}
          />
        ) : (
          <div className="studio-editor-wrapper">
            <div className="studio-body app-body">
              {/* CENTER: React Flow Canvas & Floating Top HUD Elements */}
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
                {/* 1. FLOATING TOP ACTION BAR / ISLANDS */}
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
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={triggerUndo}
                    onRedo={triggerRedo}
                  />
                ) : (
                  <Header
                    projectTitle={activeProject?.title}
                    currentVersion={activeProject?.currentVersion || '1.0.0'}
                    versionStatus={activeProject?.status || 'draft'}
                    groupMeta={groupMeta}
                    onResetSample={handleResetSample}
                    onClearCanvas={handleClearCanvas}
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
                    onAlignHorizontal={handleAlignHorizontal}
                    onAlignVertical={handleAlignVertical}
                    onOpenVersionHistory={() => {
                      setVersionHistoryTargetProject(activeProject);
                      setIsVersionHistoryModalOpen(true);
                    }}
                    onOpenCreateSnapshot={() => {
                      setIsInitialPublishMode(false);
                      setIsCreateVersionModalOpen(true);
                    }}
                    onPublishVersion={() => {
                      setIsInitialPublishMode(true);
                      setIsCreateVersionModalOpen(true);
                    }}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={triggerUndo}
                    onRedo={triggerRedo}
                    isPathTracingEnabled={isPathTracingEnabled}
                    onTogglePathTracing={togglePathTracing}
                    onAddGroupArea={handleCreateNewGroupArea}
                    isServerConnected={isServerConnected}
                    activeToolMode={activeToolMode}
                    onSelectMode={(mode) => {
                      setActiveToolMode(mode);
                      if (mode !== 'drawArea') {
                        setDrawStartPos(null);
                        setDrawCurrentPos(null);
                      }
                    }}
                    onAddSymbol={handleAddSymbol}
                    onAddQuestion={handleAddQuestionFromWidget}
                    groups={groups}
                    onInsertGroup={(grp) => handleInsertGroupIntoCanvas(grp)}
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
                )}
                <main
                  className="canvas-wrapper canvas-container"
                  ref={reactFlowWrapper}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  style={{ flex: 1, minHeight: 0 }}
                >
                  {/* Interactive Figma-style Frame Draw Overlay */}
                  {isDrawAreaMode && (
                    <div
                      className="draw-area-interaction-overlay"
                      onMouseDown={handleDrawMouseDown}
                      onMouseMove={handleDrawMouseMove}
                      onMouseUp={handleDrawMouseUp}
                    >
                      {drawStartPos && drawCurrentPos && (
                        <div
                          className="draw-area-preview-box"
                          style={{
                            left: Math.min(drawStartPos.relative.x, drawCurrentPos.relative.x),
                            top: Math.min(drawStartPos.relative.y, drawCurrentPos.relative.y),
                            width: Math.abs(drawCurrentPos.relative.x - drawStartPos.relative.x),
                            height: Math.abs(drawCurrentPos.relative.y - drawStartPos.relative.y),
                          }}
                        >
                          <div className="draw-area-preview-badge">
                            <Crop size={12} className="text-cyan-400" />
                            <span>
                              New Group Area ({Math.round(Math.abs(drawCurrentPos.relative.x - drawStartPos.relative.x))} × {Math.round(Math.abs(drawCurrentPos.relative.y - drawStartPos.relative.y))})
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty Canvas Starter Area Guide */}
                  {!nodes.some((n) => n.type === 'groupFrame' || n.type === 'groupContainer') && (
                    <div className="canvas-empty-area-guide">
                      <div className="canvas-empty-area-card animate-in">
                        <div className="canvas-empty-area-icon">
                          <Crop size={24} className="text-cyan-400" />
                        </div>
                        <h3 className="canvas-empty-area-title">Group Area Required</h3>
                        <p className="canvas-empty-area-desc">
                          Every question and logic check belongs to a <strong>Group Area</strong>. Drag any question or symbol from the left sidebar to automatically start your first Group Area, or choose below.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm canvas-empty-area-btn"
                            onClick={() => handleCreateNewGroupArea()}
                          >
                            <Plus size={14} />
                            <span>Create Group Area</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm canvas-empty-area-btn"
                            onClick={() => setActiveToolMode('drawArea')}
                            title="Draw custom group boundary on canvas (F)"
                          >
                            <Crop size={14} className="text-cyan-400" />
                            <span>Draw Area (F)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <ReactFlow
                    nodes={displayNodes}
                    edges={displayEdges}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={handleEdgesChange}
                    onConnect={onConnect}
                    onReconnect={onReconnect}
                    edgesReconnectable={true}
                    panOnDrag={isHandMode ? true : [1, 2]}
                    selectionOnDrag={!isHandMode && !isDrawAreaMode}
                    nodesDraggable={!isHandMode && !isDrawAreaMode}
                    elementsSelectable={!isHandMode && !isDrawAreaMode}
                    onNodeDragStart={handleNodeDragStart}
                    onNodeDragStop={handleNodeDragStop}
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
                    snapToGrid={true}
                    snapGrid={[16, 16]}
                    onConnectStart={() => setIsConnecting(true)}
                    onConnectEnd={() => setIsConnecting(false)}
                    fitView
                    minZoom={0.05}
                    maxZoom={5.0}
                    zoomOnPinch={true}
                    zoomOnScroll={true}
                    zoomOnDoubleClick={false}
                    preventScrolling={true}
                    deleteKeyCode={['Backspace', 'Delete']}
                    elevateNodesOnSelect={false}
                    className={`survey-flow-canvas ${isHandMode ? 'is-tool-hand' : isDrawAreaMode ? 'is-tool-draw' : ''
                      } ${isConnecting ? 'is-connecting' : ''}`}
                  >
                    <Controls className="flow-controls">
                      <ControlButton
                        onClick={() => handleFitToGroup()}
                        title="Fit to group"
                        aria-label="Fit to group"
                        className="react-flow__controls-fittogroup"
                      >
                        <Layers size={14} />
                      </ControlButton>
                    </Controls>
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

                  {/* Figma-style Bottom Floating Toolbar Dock */}
                  <FigmaToolbar
                    activeMode={activeToolMode}
                    onSelectMode={(mode) => {
                      setActiveToolMode(mode);
                      if (mode !== 'drawArea') {
                        setDrawStartPos(null);
                        setDrawCurrentPos(null);
                      }
                    }}
                    theme={theme}
                    resolvedTheme={resolvedTheme}
                    onCycleTheme={cycleTheme}
                    onSave={handleManualSave}
                    isSaving={isSyncing}
                    isSaved={justSaved}
                    onOpenMobileModal={() => {
                      setVersionPreviewCustomSchema(null);
                      setIsMobileModalOpen(true);
                    }}
                    onOpenJsonModal={() => setIsJsonModalOpen(true)}
                  />
                </main>
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
                onFocusNode={handleFocusDiagnosticNode}
                onSaveGroupToLibrary={handleSaveGroupAreaToLibrary}
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
        onClose={() => {
          setIsMobileModalOpen(false);
          setVersionPreviewCustomSchema(null);
        }}
        schema={versionPreviewCustomSchema || currentCompiledSchema}
      />

      <FlowDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        diagnostics={diagnostics}
        onSelectNode={handleFocusDiagnosticNode}
      />

      <CreateVersionModal
        isOpen={isCreateVersionModalOpen}
        onClose={() => setIsCreateVersionModalOpen(false)}
        currentVersion={activeProject?.currentVersion || '1.0.0'}
        isInitialPublish={isInitialPublishMode}
        onSubmit={handleExecuteCreateSnapshot}
      />

      {versionHistoryTargetProject && (
        <VersionHistoryModal
          isOpen={isVersionHistoryModalOpen}
          onClose={() => {
            setIsVersionHistoryModalOpen(false);
            setVersionHistoryTargetProject(null);
          }}
          project={versionHistoryTargetProject}
          currentNodes={nodes}
          currentEdges={edges}
          onRestoreVersion={handleExecuteRestoreSnapshot}
          onOpenMobilePreview={handleOpenMobilePreviewFromVersion}
          onOpenCreateVersion={() => {
            setIsInitialPublishMode(false);
            setIsCreateVersionModalOpen(true);
          }}
        />
      )}

      <WarningAlertModal
        isOpen={Boolean(warningAlertData)}
        onClose={() => setWarningAlertData(null)}
        data={warningAlertData}
      />

      <GroupTransferWarningModal
        isOpen={Boolean(pendingGroupTransfer)}
        transfer={pendingGroupTransfer}
        onClose={() => setPendingGroupTransfer(null)}
      />

      {containmentToast && (
        <div className="canvas-containment-toast">
          <AlertTriangle size={15} />
          <span>{containmentToast}</span>
        </div>
      )}
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
