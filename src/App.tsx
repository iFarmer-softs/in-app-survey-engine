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
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Header } from './components/layout/Header';
import { AdminLeftSidebar } from './components/layout/AdminLeftSidebar';
import { FlowchartSymbolsPanel } from './components/layout/FlowchartSymbolsPanel';
import { InputTypeViewsPanel } from './components/layout/InputTypeViewsPanel';
import { FlowchartListView } from './components/dashboard/FlowchartListView';
import { CreateFlowchartModal } from './components/modals/CreateFlowchartModal';
import { JsonExportModal } from './components/modals/JsonExportModal';
import { MobilePreviewModal } from './components/modals/MobilePreviewModal';

import { QuestionNode } from './components/nodes/QuestionNode';
import { DecisionNode } from './components/nodes/DecisionNode';
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
import {
  loadAllProjects,
  saveAllProjects,
  getActiveProjectId,
  setActiveProjectId as persistActiveProjectId,
  createBlankProject,
  duplicateProject,
} from './utils/projectStorage';

const nodeTypes = {
  question: QuestionNode,
  decision: DecisionNode,
  groupJump: GroupJumpNode,
  start: StartNode,
  end: EndNode,
  process: ProcessNode,
  document: DocumentNode,
};

const FlowEditor: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Multi-project state management
  const [projects, setProjects] = useState<FlowchartProject[]>(() =>
    loadAllProjects()
  );
  const [activeProjectId, setActiveProjectIdState] = useState<string>(() =>
    getActiveProjectId(projects)
  );
  const [activeView, setActiveView] = useState<'editor' | 'list'>('editor');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Active project reference
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0];
  }, [projects, activeProjectId]);

  // React Flow state for the currently active project
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

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  // Sync active project state to storage whenever nodes, edges, or meta changes
  useEffect(() => {
    if (!activeProject) return;

    setProjects((prev) => {
      const updated = prev.map((p) => {
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
      return updated;
    });
  }, [nodes, edges, groupMeta, activeProject?.id]);

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
      let edgeLabel: string | undefined = undefined;
      let strokeColor = '#10b981';
      let triggerVal = '';

      if (params.sourceHandle && params.sourceHandle.startsWith('opt-')) {
        triggerVal = decodeURIComponent(params.sourceHandle.replace('opt-', ''));
        edgeLabel = `IF "${triggerVal}"`;
        strokeColor = '#f59e0b';
      }

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            label: edgeLabel,
            style: {
              stroke: strokeColor,
              strokeWidth: 2,
              strokeDasharray: strokeColor === '#f59e0b' ? '4 4' : undefined,
            },
            data: { validationType: 'match', triggerValue: triggerVal },
          },
          eds
        )
      );
    },
    [setEdges]
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
    [nodes, screenToFlowPosition, setNodes, groupMeta.groupNumber]
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
        label: `IF "${optionValue.trim()}"`,
        animated: true,
        style: {
          stroke: '#f59e0b',
          strokeWidth: 2,
          strokeDasharray: '4 4',
        },
        data: {
          validationType: 'match',
          triggerValue: optionValue.trim(),
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setEdges((eds) => eds.concat(newEdge));
      setSelectedNodeId(newNodeId);
    },
    [nodes, edges, setNodes, setEdges]
  );

  // Auto layout
  const handleAutoLayout = useCallback(() => {
    let currentY = 50;
    const startX = 350;

    const orderedNodes = [...nodes].sort((a, b) => {
      if (a.type === 'start') return -1;
      if (b.type === 'start') return 1;
      if (a.type === 'end') return 1;
      if (b.type === 'end') return -1;
      return (
        ((a.data as any).question_id || 0) - ((b.data as any).question_id || 0)
      );
    });

    const newNodes = orderedNodes.map((n) => {
      const updated = {
        ...n,
        position: { x: startX, y: currentY },
      };
      currentY += n.type === 'question' ? 190 : 120;
      return updated;
    });

    setNodes(newNodes);
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [nodes, setNodes, fitView]);

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
        onSelectView={setActiveView}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        activeProjectTitle={activeProject?.title || 'Survey Flowchart'}
        totalProjectsCount={projects.length}
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
        ) : (
          /* STUDIO VIEW: Flowchart Editor with Panels & Canvas */
          <div className="studio-editor-wrapper">
            <Header
              projectTitle={activeProject?.title}
              groupMeta={groupMeta}
              onOpenJsonModal={() => setIsJsonModalOpen(true)}
              onOpenMobileModal={() => setIsMobileModalOpen(true)}
              onResetSample={handleResetSample}
              onAutoLayout={handleAutoLayout}
              onBackToList={() => setActiveView('list')}
              nodeCount={nodes.length}
              edgeCount={edges.length}
            />

            <div className="studio-body app-body">
              {/* LEFT PANEL: Dedicated to Flowchart Symbols */}
              <FlowchartSymbolsPanel onAddSymbol={handleAddSymbol} />

              {/* CENTER: React Flow Canvas */}
              <main
                className="canvas-wrapper canvas-container"
                ref={reactFlowWrapper}
                onDrop={onDrop}
                onDragOver={onDragOver}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onNodeClick={onNodeClick}
                  onEdgeClick={onEdgeClick}
                  onPaneClick={onPaneClick}
                  nodeTypes={nodeTypes}
                  fitView
                  deleteKeyCode={['Backspace', 'Delete']}
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
