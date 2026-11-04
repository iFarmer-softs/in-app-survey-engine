import { Injectable, BadRequestException } from '@nestjs/common';
import {
  DynamicKycGroupResponse,
  DynamicKycQuestion,
  GroupMeta,
  ValidationConfig,
} from '../types';

@Injectable()
export class CompilerService {
  /**
   * Compiles nodes, edges, and groupMeta into the Dynamic KYC Group JSON.
   */
  compile(payload: {
    nodes: any[];
    edges: any[];
    groupMeta: GroupMeta;
  }): DynamicKycGroupResponse {
    const { nodes, edges, groupMeta } = payload;
    if (!nodes || !Array.isArray(nodes)) {
      throw new BadRequestException('Nodes array is required');
    }

    const questionNodes = nodes.filter((n) => n.type === 'question');
    const jumpNodes = nodes.filter((n) => n.type === 'groupJump');

    const getNodeGroup = (node?: any, nodeData?: any): number => {
      if (node?.data?.group && typeof node.data.group === 'number') {
        return node.data.group;
      }
      if (nodeData?.containerId) {
        const container = nodes.find((n) => n.id === nodeData.containerId);
        if (container?.data?.groupId) return container.data.groupId;
      }
      if (typeof nodeData?.group === 'number' && !isNaN(nodeData.group) && nodeData.group > 0) {
        return nodeData.group;
      }
      return groupMeta?.groupNumber || 1;
    };

    const questions: DynamicKycQuestion[] = [];

    // Sort nodes top-to-bottom
    const sortedQuestionNodes = [...questionNodes].sort(
      (a, b) => (a.position?.y || 0) - (b.position?.y || 0)
    );

    for (const qNode of sortedQuestionNodes) {
      const data = qNode.data || {};
      const qId = data.question_id || parseInt(qNode.id.replace(/\D/g, '') || '1', 10);

      const dependsOn: number[] = [];
      const validationMap: Record<string, ValidationConfig> = {};

      const incomingEdges = (edges || []).filter((e) => e.target === qNode.id);

      for (const inEdge of incomingEdges) {
        const sourceNode = nodes.find((n) => n.id === inEdge.source);
        if (!sourceNode) continue;

        if (sourceNode.type === 'question') {
          const parentData = sourceNode.data || {};
          const parentId = parentData.question_id || 1;
          if (!dependsOn.includes(parentId)) {
            dependsOn.push(parentId);
          }

          if (inEdge.label) {
            const parentGroup = getNodeGroup(sourceNode, parentData);
            const myGroup = getNodeGroup(qNode, data);
            validationMap[String(parentId)] = {
              validation_type: 'match',
              validation: inEdge.label,
              is_same_group: parentGroup === myGroup,
              group: parentGroup,
            };
          }
        } else if (sourceNode.type === 'decision') {
          const decisionEdges = (edges || []).filter((e) => e.target === sourceNode.id);
          for (const dInEdge of decisionEdges) {
            const granSource = nodes.find((n) => n.id === dInEdge.source);
            if (granSource && granSource.type === 'question') {
              const parentData = granSource.data || {};
              const parentId = parentData.question_id || 1;
              if (!dependsOn.includes(parentId)) {
                dependsOn.push(parentId);
              }

              const edgeLabel = inEdge.label || inEdge.data?.label || 'Yes';
              const parentGroup = getNodeGroup(granSource, parentData);
              const myGroup = getNodeGroup(qNode, data);

              validationMap[String(parentId)] = {
                validation_type: 'match',
                validation: edgeLabel,
                is_same_group: parentGroup === myGroup,
                group: parentGroup,
              };
            }
          }
        }
      }

      const qGroup = getNodeGroup(qNode, data);

      const kycQuestion: DynamicKycQuestion = {
        question_id: qId,
        question: data.question || data.label || `Question ${qId}`,
        question_bn: data.question_bn || data.labelBn || '',
        answer_type: data.answer_type || 'string',
        mandatory: data.mandatory ?? true,
        editable: data.editable ?? true,
        placeholder: data.placeholder || null,
        hint: data.hint || null,
        options: data.options || undefined,
        value: data.value || null,
        depends_on: dependsOn.length > 0 ? dependsOn : null,
        validation: Object.keys(validationMap).length > 0 ? validationMap : null,
        group: qGroup,
        group_display_order: data.group_display_order || undefined,
        active: data.active ?? true,
      };

      questions.push(kycQuestion);
    }

    // Process group jumps
    const groupJumps = (groupMeta?.groupJumps || []).map((gj) => ({
      group_id: String(gj.group_id),
      group_title: gj.group_title,
    }));

    for (const jNode of jumpNodes) {
      const jData = jNode.data || {};
      const targetGid = String(jData.targetGroupId || jData.group_id || '2');
      const targetTitle = jData.targetGroupTitle || jData.label || `Group ${targetGid}`;
      if (!groupJumps.some((gj) => gj.group_id === targetGid)) {
        groupJumps.push({ group_id: targetGid, group_title: targetTitle });
      }
    }

    return {
      total_groups: groupMeta?.totalGroups || 1,
      current_group: groupMeta?.groupNumber || 1,
      next: groupMeta?.hasNextGroup ?? false,
      instruction: groupMeta?.instruction || 'Complete all required questions.',
      data: questions,
      groups: groupJumps.length > 0 ? groupJumps : undefined,
      groups_to_jump: groupJumps.length > 0 ? groupJumps : undefined,
    };
  }

  /**
   * Diagnostic validation on flow graph.
   */
  validate(payload: { nodes: any[]; edges: any[] }) {
    const { nodes = [], edges = [] } = payload;
    const errors: string[] = [];
    const warnings: string[] = [];

    const startNodes = nodes.filter((n) => n.type === 'start');
    if (startNodes.length === 0) {
      warnings.push('No Start node found in the flowchart.');
    } else if (startNodes.length > 1) {
      warnings.push('Multiple Start nodes found in the flowchart.');
    }

    const questionNodes = nodes.filter((n) => n.type === 'question');
    if (questionNodes.length === 0) {
      warnings.push('Flowchart has no question nodes.');
    }

    // Check orphaned questions
    for (const q of questionNodes) {
      const incoming = edges.filter((e) => e.target === q.id);
      const outgoing = edges.filter((e) => e.source === q.id);
      if (incoming.length === 0 && outgoing.length === 0) {
        warnings.push(`Question "${q.data?.question || q.id}" is disconnected from the flow.`);
      }
    }

    // Check decisions with missing branches
    const decisionNodes = nodes.filter((n) => n.type === 'decision');
    for (const d of decisionNodes) {
      const outgoing = edges.filter((e) => e.source === d.id);
      if (outgoing.length < 2) {
        warnings.push(`Decision node "${d.data?.label || d.id}" has fewer than 2 outgoing branch paths.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        totalQuestions: questionNodes.length,
        totalDecisions: decisionNodes.length,
      },
    };
  }
}

