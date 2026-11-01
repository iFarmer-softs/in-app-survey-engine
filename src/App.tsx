import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  MarkerType,
} from '@xyflow/react';
import type { Connection, Edge, Node, NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Layers, Sparkles } from 'lucide-react';

import { Header } from './components/layout/Header';
import { GroupTemplateHeader } from './components/layout/GroupTemplateHeader';
import { AdminLeftSidebar } from './components/layout/AdminLeftSidebar';
import { FlowchartSymbolsPanel } from './components/layout/FlowchartSymbolsPanel';
import { InputTypeViewsPanel } from './components/layout/InputTypeViewsPanel';
import { FlowchartListView } from './components/dashboard/FlowchartListView';
import { QuestionGroupListView } from './components/groups/QuestionGroupListView';
import { CreateFlowchartModal } from './components/modals/CreateFlowchartModal';
import { CreateGroupModal } from './components/modals/CreateGroupModal';
import { SaveSelectionAsGroupModal } from './components/modals/SaveSelectionAsGroupModal';
import { JsonExportModal } from './components/modals/JsonExportModal';
import { MobilePreviewModal } from './components/modals/MobilePreviewModal';
import { FlowDiagnosticsModal } from './components/modals/FlowDiagnosticsModal';
import { WarningAlertModal } from './components/modals/WarningAlertModal';
import type { WarningAlertData } from './components/modals/WarningAlertModal';
import { CustomFlowchartEdge } from './components/edges/CustomFlowchartEdge';

import { QuestionNode } from './components/nodes/QuestionNode';
import { DecisionNode } from './components/nodes/DecisionNode';
import { GroupContainerNode } from './components/nodes/GroupContainerNode';
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
import type { FlowchartProject } from './types/project';
import type {
  ReusableQuestionGroup,
  GroupCategory,
  GroupQuestionTemplate,
} from './types/group';
import {
  loadAllProjects,
  saveAllProjects,
  getActiveProjectId,
  setActiveProjectId as persistActiveProjectId,
  createBlankProject,
  duplicateProject,
} from './utils/projectStorage';
import {
  loadAllGroups,
  saveAllGroups,
  createNewQuestionGroup,
  updateQuestionGroup,
  deleteQuestionGroup,
  DEFAULT_QUESTION_GROUPS,
} from './utils/groupStorage';
import {
  calculateHierarchicalLayout,
  calculateGroupQuestionLayout,
  alignNodesHorizontal,
  alignNodesVertical,
} from './utils/flowLayout';
import { validateSurveyFlow, isBinaryRedundantBranch } from './utils/flowValidator';

const baseNodeTypes = {
  question: QuestionNode,
  decision: DecisionNode,
  groupJump: GroupJumpNode,
  start: StartNode,
  end: EndNode,
  process: ProcessNode,
  document: DocumentNode,
  groupContainer: GroupContainerNode,
};

const edgeTypes = {
  surveyEdge: CustomFlowchartEdge,
};

const FlowEditor: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();

  // Multi-project state management
  const [projects, setProjects] = useState<FlowchartProject[]>(() =>
    loadAllProjects()
  );
  const [activeProjectId, setActiveProjectIdState] = useState<string>(() =>
    getActiveProjectId(projects)
  );
  const [activeView, setActiveView] = useState<'editor' | 'list' | 'groups'>('editor');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);

  // Reusable Question Groups state management
  const [groups, setGroups] = useState<ReusableQuestionGroup[]>(() =>
    loadAllGroups()
  );

  // Group Template Studio & Selection state
  interface GroupDesignSession {
    groupId?: string;
    name: string;
    nameBn: string;
    description: string;
    category: GroupCategory;
    color: string;
    backupProjectId: string;
    backupNodes: Node[];
    backupEdges: Edge[];
    backupGroupMeta: GroupMeta;
  }
  const [groupDesignSession, setGroupDesignSession] = useState<GroupDesignSession | null>(null);
  const [isSaveSelectionModalOpen, setIsSaveSelectionModalOpen] = useState(false);

  // Active project reference
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0];
  }, [projects, activeProjectId]);

  // React Flow state for the currently active project
  const [nodes, setNodes, onNodesChange] = useNodesState(activeProject?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeProject?.edges || []);

  // Synchronized node dragging: moving a group container moves all its child questions in real-time
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const extraChanges: NodeChange[] = [];

      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          const node = nodes.find((n) => n.id === change.id);
          if (node && node.type === 'groupContainer') {
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

      onNodesChange(extraChanges.length > 0 ? [...changes, ...extraChanges] : changes);
    },
    [nodes, onNodesChange]
  );
  const [groupMeta, setGroupMeta] = useState<GroupMeta>(
    activeProject?.groupMeta || {
      totalGroups: 1,
      groupNumber: 1,
      hasNextGroup: false,
      instruction: '',
      groupJumps: [],
    }
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [warningAlertData, setWarningAlertData] = useState<WarningAlertData | null>(null);
  const [edgeRouting, setEdgeRouting] = useState<'smoothstep' | 'bezier' | 'straight'>('smoothstep');

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
    if (!activeProject) return;
    if (groupDesignSession) return; // Do not overwrite survey project while designing group template

    const currentList = loadAllProjects();
    const updated = currentList.map((p) => {
      if (p.id === activeProject.id) {
        return {
          ...p,
          nodes,
          edges,
          groupMeta,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });
    saveAllProjects(updated);
  }, [nodes, edges, groupMeta, activeProject, groupDesignSession]);

  // Switch active project
  const handleSelectProject = useCallback(
    (id: string) => {
      const target = projects.find((p) => p.id === id);
      if (target) {
        setActiveProjectIdState(id);
        persistActiveProjectId(id);
        setNodes(target.nodes);
        setEdges(target.edges);
        setGroupMeta(target.groupMeta);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setActiveView('editor');
        setTimeout(() => fitView({ padding: 0.2 }), 50);
      }
    },
    [projects, setNodes, setEdges, fitView]
  );

  // Create new blank flowchart
  const handleCreateNewProject = useCallback(
    (
      title: string,
      titleBn: string,
      description: string,
      totalGroups: number
    ) => {
      const newProj = createBlankProject(title, titleBn, description, totalGroups);
      const updated = [newProj, ...projects];
      setProjects(updated);
      saveAllProjects(updated);

      setActiveProjectIdState(newProj.id);
      persistActiveProjectId(newProj.id);
      setNodes(newProj.nodes);
      setEdges(newProj.edges);
      setGroupMeta(newProj.groupMeta);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setActiveView('editor');
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    },
    [projects, setNodes, setEdges, fitView]
  );

  // Duplicate project
  const handleDuplicateProject = useCallback(
    (id: string) => {
      const source = projects.find((p) => p.id === id);
      if (!source) return;

      const cloned = duplicateProject(source);
      const updated = [cloned, ...projects];
      setProjects(updated);
      saveAllProjects(updated);
    },
    [projects]
  );

  // Delete project
  const handleDeleteProject = useCallback(
    (id: string) => {
      if (projects.length <= 1) {
        alert('You must keep at least one flowchart in your workspace.');
        return;
      }

      const updated = projects.filter((p) => p.id !== id);
      setProjects(updated);
      saveAllProjects(updated);

      if (activeProjectId === id) {
        const next = updated[0];
        if (next) {
          handleSelectProject(next.id);
        }
      }
    },
    [projects, activeProjectId, handleSelectProject]
  );


  const handleDeleteGroup = useCallback((groupId: string) => {
    const updated = deleteQuestionGroup(groupId);
    setGroups(updated);
  }, []);

  const handleResetDefaultGroups = useCallback(() => {
    saveAllGroups(DEFAULT_QUESTION_GROUPS);
    setGroups(DEFAULT_QUESTION_GROUPS);
  }, []);

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
        // This guarantees child questions of ANY group are NEVER shifted independently
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
          // Never treat child questions of any container as top-level
          if (childToContainerMap.has(n.id)) return;
          if (n.id === containerNodeId) return;

          const isSameColumn = Math.abs(n.position.x - containerX) < 220;
          const isBelow = n.position.y > containerY + 60;
          if (isSameColumn && isBelow) {
            downstreamTopLevelIds.add(n.id);
          }
        });

        // (c) Children belonging to downstream group containers must move in sync with their parent container
        const downstreamChildIds = new Set<string>();
        downstreamTopLevelIds.forEach((tlId) => {
          const children = containerToChildrenMap.get(tlId) || [];
          children.forEach((cId) => downstreamChildIds.add(cId));
        });

        // 5. Update nodes immutably
        return currentNodes.map((node) => {
          // (A) The group container node being toggled
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

          // (B) Child questions of the group container being toggled
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

          // (C) Downstream top-level nodes or downstream group containers
          if (downstreamTopLevelIds.has(node.id)) {
            return {
              ...node,
              position: {
                ...node.position,
                y: node.position.y + shiftAmount,
              },
            };
          }

          // (D) Child questions of downstream group containers: shift in perfect sync with their container
          if (downstreamChildIds.has(node.id)) {
            return {
              ...node,
              position: {
                ...node.position,
                y: node.position.y + shiftAmount,
              },
            };
          }

          // (E) All other nodes (parallel branches, nodes in other columns, or above) remain untouched
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
      setNodes((currentNodes) => {
        const containerNode = currentNodes.find((n) => n.id === containerNodeId);
        if (!containerNode) return currentNodes;
        const childIds: string[] = (containerNode.data as any).questionIds || [];

        return currentNodes.filter(
          (n) =>
            n.id !== containerNodeId &&
            !childIds.includes(n.id) &&
            (n.data as any)?.containerId !== containerNodeId
        );
      });

      setEdges((currentEdges) => {
        return currentEdges.filter(
          (e) =>
            (e.data as any)?.containerId !== containerNodeId &&
            e.source !== containerNodeId &&
            e.target !== containerNodeId
        );
      });
    },
    [setNodes, setEdges]
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
            x: startX + 30,
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
    [nodes, setNodes, setEdges, setCenter, handleToggleGroupCollapse, handleUngroup, handleDeleteGroupContainer]
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
    // Sort top-to-bottom according to y position for natural linear progression
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

  // Group Template Studio: Start designing a brand new group on canvas
  const handleStartNewGroupInStudio = useCallback(
    (meta: {
      name: string;
      nameBn: string;
      description: string;
      category: GroupCategory;
      color: string;
      initialQuestionCount: number;
    }) => {
      const session: GroupDesignSession = {
        groupId: undefined,
        name: meta.name,
        nameBn: meta.nameBn,
        description: meta.description,
        category: meta.category,
        color: meta.color,
        backupProjectId: activeProjectId,
        backupNodes: nodes,
        backupEdges: edges,
        backupGroupMeta: groupMeta,
      };

      const count = Math.max(1, meta.initialQuestionCount || 1);
      const initialNodes: Node[] = [];
      const initialEdges: Edge[] = [];

      for (let i = 0; i < count; i++) {
        const qId = `q-${i + 1}`;
        initialNodes.push({
          id: qId,
          type: 'question',
          position: { x: 350, y: 150 + i * 180 },
          data: {
            question_id: i + 1,
            question: count === 1 ? meta.name : `${meta.name} - Question ${i + 1}`,
            question_bn: count === 1 ? meta.nameBn : `${meta.nameBn} - প্রশ্ন ${i + 1}`,
            answer_type: 'string',
            mandatory: true,
            editable: true,
            placeholder: '',
            hint: '',
            options: '',
          },
        });

        if (i > 0) {
          initialEdges.push({
            id: `edge-q-${i}-q-${i + 1}`,
            source: `q-${i}`,
            target: `q-${i + 1}`,
            type: 'surveyEdge',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
            },
            data: { rule: 'Next' },
          });
        }
      }

      setNodes(initialNodes);
      setEdges(initialEdges);
      setSelectedNodeId('q-1');
      setGroupDesignSession(session);
      setActiveView('editor');
      setTimeout(() => fitView({ padding: 0.35, duration: 400 }), 80);
    },
    [activeProjectId, nodes, edges, groupMeta, setNodes, setEdges, fitView]
  );

  // Group Template Studio: Load an existing group onto canvas for visual editing
  const handleEditGroupInStudio = useCallback(
    (group: ReusableQuestionGroup) => {
      const session: GroupDesignSession = {
        groupId: group.id,
        name: group.name,
        nameBn: group.nameBn,
        description: group.description,
        category: group.category,
        color: group.color,
        backupProjectId: activeProjectId,
        backupNodes: nodes,
        backupEdges: edges,
        backupGroupMeta: groupMeta,
      };

      const templateNodes: Node[] = group.questions.map((q, idx) => ({
        id: `q-${idx + 1}`,
        type: 'question',
        position: { x: 350, y: 150 + idx * 170 },
        data: {
          question_id: idx + 1,
          question: q.question,
          question_bn: q.question_bn,
          answer_type: q.answer_type,
          mandatory: q.mandatory ?? true,
          editable: q.editable ?? true,
          placeholder: q.placeholder || '',
          hint: q.hint || '',
          options: q.options || '',
        },
      }));

      const templateEdges: Edge[] = [];
      for (let i = 0; i < templateNodes.length - 1; i++) {
        templateEdges.push({
          id: `edge-${templateNodes[i].id}-${templateNodes[i + 1].id}`,
          source: templateNodes[i].id,
          target: templateNodes[i + 1].id,
          type: 'surveyEdge',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
          },
          data: {
            rule: 'Next',
          },
        });
      }

      setNodes(templateNodes);
      setEdges(templateEdges);
      if (templateNodes.length > 0) {
        setSelectedNodeId(templateNodes[0].id);
      }
      setGroupDesignSession(session);
      setActiveView('editor');
      setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 80);
    },
    [activeProjectId, nodes, edges, groupMeta, setNodes, setEdges, fitView]
  );

  // Group Template Studio: Exit without saving changes
  const handleExitGroupDesignSession = useCallback(() => {
    if (!groupDesignSession) return;
    setNodes(groupDesignSession.backupNodes);
    setEdges(groupDesignSession.backupEdges);
    setGroupMeta(groupDesignSession.backupGroupMeta);
    setGroupDesignSession(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setActiveView('groups');
  }, [groupDesignSession, setNodes, setEdges]);

  // Group Template Studio: Save canvas questions back into group storage
  const handleSaveGroupDesignSession = useCallback(() => {
    if (!groupDesignSession) return;

    const questionNodes = nodes
      .filter((n) => n.type === 'question')
      .sort((a, b) => a.position.y - b.position.y);

    if (questionNodes.length === 0) {
      alert('A question group must contain at least one question node.');
      return;
    }

    const questionTemplates: GroupQuestionTemplate[] = questionNodes.map((n) => {
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

    if (groupDesignSession.groupId) {
      updateQuestionGroup(groupDesignSession.groupId, {
        name: groupDesignSession.name,
        nameBn: groupDesignSession.nameBn,
        description: groupDesignSession.description,
        category: groupDesignSession.category,
        color: groupDesignSession.color,
        questions: questionTemplates,
      });
    } else {
      createNewQuestionGroup(
        groupDesignSession.name,
        groupDesignSession.nameBn,
        groupDesignSession.description,
        groupDesignSession.category,
        groupDesignSession.color,
        questionTemplates
      );
    }

    setGroups(loadAllGroups());

    // Restore canvas to active project
    setNodes(groupDesignSession.backupNodes);
    setEdges(groupDesignSession.backupEdges);
    setGroupMeta(groupDesignSession.backupGroupMeta);
    setGroupDesignSession(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setActiveView('groups');
  }, [groupDesignSession, nodes, setNodes, setEdges]);

  // "Save Selection as Group": Bundle selected canvas question nodes
  const handleSaveSelectionAsGroup = useCallback(
    (meta: {
      name: string;
      nameBn: string;
      description: string;
      category: GroupCategory;
      color: string;
    }) => {
      if (selectedQuestionTemplates.length === 0) return;

      createNewQuestionGroup(
        meta.name,
        meta.nameBn,
        meta.description,
        meta.category,
        meta.color,
        selectedQuestionTemplates
      );

      setGroups(loadAllGroups());
      setIsSaveSelectionModalOpen(false);
    },
    [selectedQuestionTemplates]
  );

  // Selected entities
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) || null,
    [edges, selectedEdgeId]
  );

  // Connection handler: automatically configures rule when dragged from an option port
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
        // Multi-conditional questions (3+ options) connecting a subset of options are permitted as OR-branches!
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

      let edgeLabel: string | undefined = undefined;
      let strokeColor = '#10b981';
      let triggerVal = '';

      if (params.sourceHandle && params.sourceHandle.startsWith('opt-')) {
        triggerVal = decodeURIComponent(params.sourceHandle.replace('opt-', ''));
        edgeLabel = `IF "${triggerVal}"`;
        strokeColor = '#f59e0b';
      } else if (params.sourceHandle === 'match') {
        edgeLabel = 'MATCH';
        strokeColor = '#f59e0b';
      } else if (params.sourceHandle === 'else') {
        edgeLabel = 'ELSE';
        strokeColor = '#ec4899';
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
              strokeDasharray: strokeColor === '#f59e0b' ? '4 4' : undefined,
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
            },
          },
          eds
        )
      );
    },
    [edges, nodes, setEdges, edgeRouting]
  );

  // Selection handlers
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
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

      // Check if dragging an entire Question Group template
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

      // Find highest question_id
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
        position,
        data: nodeData,
      };

      setNodes((nds) => nds.concat(newNode));
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

  // Hierarchical DAG Auto-Layout (no overlapping branches)
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

  // Change edge routing geometry (smoothstep / bezier / straight)
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

      // Immediately sync to active project in state and localStorage
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
          saveAllProjects(updated);
          return updated;
        });
      }

      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 150);
    },
    [setNodes, setEdges, fitView, activeProject, setActiveView]
  );

  return (
    <div className="app-container">
      {/* 1. ADMIN LEFT SIDEBAR (Slim icon rail that expands on hover/click) */}
      <AdminLeftSidebar
        activeView={activeView}
        onSelectView={(view) => {
          if (view === 'list') {
            setProjects(loadAllProjects());
          } else if (view === 'groups') {
            setGroups(loadAllGroups());
          }
          setActiveView(view);
        }}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        activeProjectTitle={activeProject?.title || 'Survey Flowchart'}
        totalProjectsCount={projects.length}
        totalGroupsCount={groups.length}
      />

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <div className="admin-main-viewport">
        {activeView === 'list' ? (
          /* DASHBOARD VIEW: List of Created Flowcharts */
          <FlowchartListView
            projects={projects}
            activeProjectId={activeProjectId}
            onOpenProject={handleSelectProject}
            onCreateNew={() => setIsCreateModalOpen(true)}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={handleDeleteProject}
          />
        ) : activeView === 'groups' ? (
          /* QUESTION GROUPS LIBRARY: Reusable Template Question Sets */
          <QuestionGroupListView
            groups={groups}
            onCreateGroupInStudio={() => setIsCreateGroupModalOpen(true)}
            onEditGroupInStudio={handleEditGroupInStudio}
            onDeleteGroup={handleDeleteGroup}
            onInsertGroupIntoCanvas={(grp) => handleInsertGroupIntoCanvas(grp)}
            onResetDefaults={handleResetDefaultGroups}
          />
        ) : (
          /* STUDIO VIEW: Flowchart Editor with Panels & Canvas */
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
                  setProjects(loadAllProjects());
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
              {/* LEFT PANEL: Dedicated to Flowchart Symbols & Reusable Groups */}
              <FlowchartSymbolsPanel
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

              {/* CENTER: React Flow Canvas */}
              <main
                className="canvas-wrapper canvas-container"
                ref={reactFlowWrapper}
                onDrop={onDrop}
                onDragOver={onDragOver}
              >
                {/* Floating Toolbar: Create Group from Selected Canvas Questions */}
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
                    color="#334155"
                  />
                </ReactFlow>
              </main>

              {/* RIGHT PANEL: Dedicated to Input Type Views & Inspector */}
              <InputTypeViewsPanel
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                edges={edges}
                groupMeta={groupMeta}
                onUpdateNodeData={handleUpdateNodeData}
                onUpdateEdgeData={handleUpdateEdgeData}
                onUpdateGroupMeta={handleUpdateGroupMeta}
                onDeleteNode={handleDeleteNode}
                onDuplicateNode={handleDuplicateNode}
                onAddNestedQuestion={handleAddNestedQuestion}
                onAddQuestion={handleAddQuestionFromWidget}
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
