import { useState, useCallback } from 'react';
import { MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type {
  ReusableQuestionGroup,
  GroupCategory,
  GroupQuestionTemplate,
} from '../types/group';
import type { GroupMeta } from '../utils/schemaCompiler';
import {
  loadAllGroups,
  saveAllGroups,
  createNewQuestionGroup,
  updateQuestionGroup,
  deleteQuestionGroup,
  DEFAULT_QUESTION_GROUPS,
} from '../utils/groupStorage';

export interface GroupDesignSession {
  groupId?: string;
  numericGroupId?: number;
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

interface UseGroupStudioProps {
  activeProjectId: string;
  nodes: Node[];
  edges: Edge[];
  groupMeta: GroupMeta;
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  setGroupMeta: (meta: GroupMeta | ((m: GroupMeta) => GroupMeta)) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setActiveView: (view: 'editor' | 'list' | 'groups') => void;
  fitView: (options?: { padding?: number; duration?: number }) => void;
}

export function useGroupStudio({
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
}: UseGroupStudioProps) {
  const [groups, setGroups] = useState<ReusableQuestionGroup[]>(() =>
    loadAllGroups()
  );
  const [groupDesignSession, setGroupDesignSession] =
    useState<GroupDesignSession | null>(null);

  const refreshGroups = useCallback(() => {
    setGroups(loadAllGroups());
  }, []);

  const handleDeleteGroup = useCallback((groupId: string) => {
    const updated = deleteQuestionGroup(groupId);
    setGroups(updated);
  }, []);

  const handleResetDefaultGroups = useCallback(() => {
    saveAllGroups(DEFAULT_QUESTION_GROUPS);
    setGroups(DEFAULT_QUESTION_GROUPS);
  }, []);

  // Group Template Studio: Start designing a brand new group on canvas
  const handleStartNewGroupInStudio = useCallback(
    (meta: {
      groupId: number;
      name: string;
      nameBn: string;
      description: string;
      category: GroupCategory;
      color: string;
      initialQuestionCount: number;
    }) => {
      const session: GroupDesignSession = {
        groupId: undefined,
        numericGroupId: meta.groupId,
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
            group: meta.groupId,
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
    [activeProjectId, nodes, edges, groupMeta, setNodes, setEdges, setSelectedNodeId, setActiveView, fitView]
  );

  // Group Template Studio: Load an existing group onto canvas for visual editing
  const handleEditGroupInStudio = useCallback(
    (group: ReusableQuestionGroup) => {
      const session: GroupDesignSession = {
        groupId: group.id,
        numericGroupId: group.groupId,
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
    [activeProjectId, nodes, edges, groupMeta, setNodes, setEdges, setSelectedNodeId, setActiveView, fitView]
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
  }, [groupDesignSession, setNodes, setEdges, setGroupMeta, setSelectedNodeId, setSelectedEdgeId, setActiveView]);

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
        ...(groupDesignSession.numericGroupId ? { groupId: groupDesignSession.numericGroupId } : {}),
      });
    } else {
      createNewQuestionGroup(
        groupDesignSession.name,
        groupDesignSession.nameBn,
        groupDesignSession.description,
        groupDesignSession.category,
        groupDesignSession.color,
        questionTemplates,
        groupDesignSession.numericGroupId
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
  }, [groupDesignSession, nodes, setNodes, setEdges, setGroupMeta, setSelectedNodeId, setSelectedEdgeId, setActiveView]);

  // "Save Selection as Group": Bundle selected canvas question nodes
  const handleSaveSelectionAsGroup = useCallback(
    (
      meta: {
        groupId: number;
        name: string;
        nameBn: string;
        description: string;
        category: GroupCategory;
        color: string;
      },
      selectedTemplates: GroupQuestionTemplate[],
      onSuccess?: () => void
    ) => {
      if (selectedTemplates.length === 0) return;

      createNewQuestionGroup(
        meta.name,
        meta.nameBn,
        meta.description,
        meta.category,
        meta.color,
        selectedTemplates,
        meta.groupId
      );

      setGroups(loadAllGroups());
      onSuccess?.();
    },
    []
  );

  return {
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
    handleSaveSelectionAsGroup,
  };
}

