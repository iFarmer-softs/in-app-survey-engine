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
      if (node?.data?.group && typeof node.data.group === 'number' && !isNaN(node.data.group) && node.data.group > 0) {
        return node.data.group;
      }
      if (nodeData?.containerId) {
        const container = nodes.find((n) => n.id === nodeData.containerId);
        if (typeof container?.data?.numericGroupId === 'number' && !isNaN(container.data.numericGroupId) && container.data.numericGroupId > 0) {
          return container.data.numericGroupId;
        }
        if (container?.data?.title || container?.data?.titleBn) {
          const titleNum = parseInt(String(container.data.title || container.data.titleBn).replace(/\D+/g, ''), 10);
          if (!isNaN(titleNum) && titleNum > 0) return titleNum;
        }
        if (container?.data?.groupId && !String(container.data.groupId).startsWith('grp-frame-')) {
          const parsed = parseInt(String(container.data.groupId).replace(/\D+/g, ''), 10);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      }
      if (typeof nodeData?.group === 'number' && !isNaN(nodeData.group) && nodeData.group > 0) {
        return nodeData.group;
      }
      return groupMeta?.groupNumber || 1;
    };

    const questions: DynamicKycQuestion[] = [];

    // Precompute downstream questions within the same group for each question
    const downstreamMap: Record<number, number[]> = {};
    for (const qNode of questionNodes) {
      const qId = (qNode.data as any)?.question_id;
      if (!qId) continue;
      const qGroup = getNodeGroup(qNode, qNode.data);
      const visited = new Set<string>();
      const queue = [qNode.id];
      const downstream: number[] = [];

      while (queue.length > 0) {
        const currId = queue.shift()!;
        if (visited.has(currId)) continue;
        visited.add(currId);

        const outEdges = (edges || []).filter((e) => e.source === currId);
        for (const e of outEdges) {
          const tgtNode = nodes.find((n) => n.id === e.target);
          if (!tgtNode) continue;
          if (tgtNode.type === 'question') {
            const tgtGroup = getNodeGroup(tgtNode, tgtNode.data);
            if (tgtGroup === qGroup) {
              const tgtQId = (tgtNode.data as any)?.question_id;
              if (tgtQId && !downstream.includes(tgtQId)) {
                downstream.push(tgtQId);
              }
              if (!visited.has(tgtNode.id)) {
                queue.push(tgtNode.id);
              }
            }
          } else if (tgtNode.type === 'decision' || tgtNode.type === 'process') {
            if (!visited.has(tgtNode.id)) {
              queue.push(tgtNode.id);
            }
          }
        }
      }
      downstreamMap[qId] = downstream;
    }

    // Sort nodes top-to-bottom
    const sortedQuestionNodes = [...questionNodes].sort(
      (a, b) => (a.position?.y || 0) - (b.position?.y || 0)
    );

    for (const qNode of sortedQuestionNodes) {
      const data = qNode.data || {};
      const qId = data.question_id || parseInt(qNode.id.replace(/\D/g, '') || '1', 10);

      const dependsOn: number[] = [];
      const validationMap: Record<string, ValidationConfig> = {};

      const qGroup = getNodeGroup(qNode, data);
      const containerId = data.containerId;
      const containerNode = nodes.find(
        (n) =>
          (n.type === 'groupFrame' || n.type === 'groupContainer') &&
          (n.id === containerId || (n.data as any)?.numericGroupId === qGroup)
      );
      const containerIncoming = containerNode
        ? (edges || []).filter((e) => e.target === containerNode.id)
        : [];

      const incomingToNode = (edges || []).filter((e) => e.target === qNode.id);
      const hasInternalIncoming = incomingToNode.some((e) => {
        const src = nodes.find((n) => n.id === e.source);
        return src && getNodeGroup(src, src.data) === qGroup;
      });

      const incomingEdges = [...incomingToNode];
      if (!hasInternalIncoming && containerIncoming.length > 0) {
        for (const ce of containerIncoming) {
          if (!incomingEdges.some((ie) => ie.id === ce.id)) {
            incomingEdges.push(ce);
          }
        }
      }

      for (const inEdge of incomingEdges) {
        const sourceNode = nodes.find((n) => n.id === inEdge.source);
        if (!sourceNode) continue;

        if (sourceNode.type === 'question') {
          const parentData = sourceNode.data || {};
          const parentId = parentData.question_id || 1;
          let optFromHandle: string | null = null;
          if (inEdge.sourceHandle && inEdge.sourceHandle.startsWith('opt-')) {
            optFromHandle = decodeURIComponent(inEdge.sourceHandle.replace('opt-', ''));
          } else if (inEdge.label && inEdge.label.startsWith('IF ')) {
            optFromHandle = inEdge.label.replace(/^IF\s*["']?|["']?$/g, '');
          }

          if (!dependsOn.includes(parentId)) {
            dependsOn.push(parentId);
          }

          const parentGroup = getNodeGroup(sourceNode, parentData);
          const myGroup = getNodeGroup(qNode, data);

          if (optFromHandle) {
            validationMap[String(parentId)] = {
              validation_type: 'match',
              validation: { [optFromHandle]: true },
              is_same_group: parentGroup === myGroup,
              group: parentGroup,
            };
          } else if (inEdge.label) {
            validationMap[String(parentId)] = {
              validation_type: 'match',
              validation: inEdge.label,
              is_same_group: parentGroup === myGroup,
              group: parentGroup,
            };
          }
        } else if (sourceNode.type === 'decision') {
          const decisionEdges = (edges || []).filter((e) => e.target === sourceNode.id);
          const decData = sourceNode.data || {};
          const isElse =
            inEdge.sourceHandle === 'else' ||
            (typeof inEdge.label === 'string' && inEdge.label.toUpperCase().includes('ELSE'));
          const condType = decData.conditionType || 'match';

          for (const dInEdge of decisionEdges) {
            const granSource = nodes.find((n) => n.id === dInEdge.source);
            if (granSource && granSource.type === 'question') {
              const parentData = granSource.data || {};
              const parentId = parentData.question_id || 1;
              if (!dependsOn.includes(parentId)) {
                dependsOn.push(parentId);
              }

              const parentGroup = getNodeGroup(granSource, parentData);
              const myGroup = getNodeGroup(qNode, data);

              if (condType === 'match') {
                if (isElse) {
                  validationMap[String(parentId)] = {
                    validation_type: 'not_match',
                    validation: String(decData.comparisonValue || ''),
                    is_same_group: parentGroup === myGroup,
                    group: parentGroup,
                  };
                } else {
                  validationMap[String(parentId)] = {
                    validation_type: 'match',
                    validation: inEdge.label || decData.comparisonValue || 'Yes',
                    is_same_group: parentGroup === myGroup,
                    group: parentGroup,
                  };
                }
              } else if (condType === 'greater') {
                validationMap[String(parentId)] = {
                  validation_type: isElse ? 'less_or_equal' : 'greater',
                  validation: Number(decData.comparisonValue) || 0,
                  is_same_group: parentGroup === myGroup,
                  group: parentGroup,
                };
              } else if (condType === 'less') {
                validationMap[String(parentId)] = {
                  validation_type: isElse ? 'greater_or_equal' : 'less',
                  validation: Number(decData.comparisonValue) || 0,
                  is_same_group: parentGroup === myGroup,
                  group: parentGroup,
                };
              }
            }
          }
        }
      }

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
        subsequent_questions:
          downstreamMap[qId] && downstreamMap[qId].length > 0 ? downstreamMap[qId] : undefined,
      };

      questions.push(kycQuestion);
    }

    // Process group jumps with explicit conditional option bindings
    const groupJumps: any[] = (groupMeta?.groupJumps || []).map((gj) => ({
      group_id: String(gj.group_id),
      group_title: gj.group_title,
    }));

    // 1. Process jump nodes
    for (const jNode of jumpNodes) {
      const jData = jNode.data || {};
      const targetGid = String(jData.targetGroupId || jData.group_id || '2');
      const targetTitle = jData.targetGroupTitle || jData.label || `Group ${targetGid}`;
      const jumpInEdges = (edges || []).filter((e) => e.target === jNode.id);
      const jOutEdge = (edges || []).find((e) => e.source === jNode.id);
      let targetQId: number | undefined = (jData as any)?.targetQuestionId;
      if (!targetQId && jOutEdge) {
        const outNode = nodes.find((n) => n.id === jOutEdge.target);
        if (outNode?.type === 'question') {
          targetQId = (outNode.data as any)?.question_id;
        }
      }

      if (jumpInEdges.length > 0) {
        for (const jEdge of jumpInEdges) {
          const srcNode = nodes.find((n) => n.id === jEdge.source);
          let triggerVal: string | null = null;
          let triggerType = 'match';
          const isElse =
            jEdge.sourceHandle === 'else' ||
            (typeof jEdge.label === 'string' && jEdge.label.toUpperCase().includes('ELSE'));

          if (jEdge.sourceHandle && jEdge.sourceHandle.startsWith('opt-')) {
            triggerVal = decodeURIComponent(jEdge.sourceHandle.replace('opt-', '')).trim();
          } else if (jEdge.data?.triggerValue) {
            triggerVal = String(jEdge.data.triggerValue).trim();
          } else if (jEdge.label && !jEdge.label.startsWith('Cross-Group:')) {
            triggerVal = jEdge.label.replace(/^IF\s*["']?|["']?$/g, '').trim();
          }

          let sourceQId: number | undefined = undefined;
          let sourceG: number | undefined = undefined;

          if (srcNode?.type === 'question') {
            sourceQId = srcNode.data?.question_id;
            sourceG = getNodeGroup(srcNode, srcNode.data);
            if (isElse) triggerType = 'else';
          } else if (srcNode?.type === 'decision') {
            const decData = srcNode.data || {};
            const dEdges = (edges || []).filter((e) => e.target === srcNode.id);
            for (const de of dEdges) {
              const dSrc = nodes.find((n) => n.id === de.source && n.type === 'question');
              if (dSrc) {
                sourceQId = dSrc.data?.question_id;
                sourceG = getNodeGroup(dSrc, dSrc.data);
                triggerVal = String(decData.comparisonValue || 'Yes');
                const condType = decData.conditionType || 'match';
                if (isElse) {
                  triggerType = condType === 'match' ? 'not_match' : (condType === 'greater' ? 'less_or_equal' : 'greater_or_equal');
                } else {
                  triggerType = condType;
                }
                break;
              }
            }
          }

          const existingIdx = groupJumps.findIndex(
            (g) =>
              g.group_id === targetGid &&
              (!g.source_question_id || g.source_question_id === sourceQId) &&
              (!g.trigger_value || g.trigger_value === triggerVal) &&
              (!g.trigger_type || g.trigger_type === triggerType)
          );
          const jumpEntry = {
            group_id: targetGid,
            group_title: targetTitle,
            source_question_id: sourceQId,
            trigger_value: triggerVal || undefined,
            trigger_type: triggerType,
            source_handle: jEdge.sourceHandle || undefined,
            source_group: sourceG,
            target_question_id: targetQId,
          };

          if (existingIdx >= 0) {
            groupJumps[existingIdx] = { ...groupJumps[existingIdx], ...jumpEntry };
          } else {
            groupJumps.push(jumpEntry);
          }
        }
      } else {
        if (!groupJumps.some((gj) => gj.group_id === targetGid)) {
          groupJumps.push({ group_id: targetGid, group_title: targetTitle, target_question_id: targetQId });
        }
      }
    }

    // 2. Process conditional edges targeting groupFrame or groupContainer
    for (const edge of (edges || [])) {
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (!targetNode) continue;
      if (targetNode.type === 'groupFrame' || targetNode.type === 'groupContainer') {
        const targetG =
          targetNode.data?.numericGroupId ||
          parseInt(String(targetNode.data?.groupId).replace(/\D+/g, ''), 10);
        if (!targetG || isNaN(targetG)) continue;
        const gIdStr = String(targetG);
        const targetTitle = targetNode.data?.title || targetNode.data?.titleBn || `Group ${targetG}`;

        const srcNode = nodes.find((n) => n.id === edge.source);
        let triggerVal: string | null = null;
        let triggerType = 'match';
        const isElse =
          edge.sourceHandle === 'else' ||
          (typeof edge.label === 'string' && edge.label.toUpperCase().includes('ELSE'));

        if (edge.sourceHandle && edge.sourceHandle.startsWith('opt-')) {
          triggerVal = decodeURIComponent(edge.sourceHandle.replace('opt-', '')).trim();
        } else if (edge.data?.triggerValue) {
          triggerVal = String(edge.data.triggerValue).trim();
        }

        let sourceQId: number | undefined = undefined;
        let sourceG: number | undefined = undefined;

        if (srcNode?.type === 'question') {
          sourceQId = srcNode.data?.question_id;
          sourceG = getNodeGroup(srcNode, srcNode.data);
          if (isElse) triggerType = 'else';
        } else if (srcNode?.type === 'decision') {
          const decData = srcNode.data || {};
          const dEdges = (edges || []).filter((e) => e.target === srcNode.id);
          for (const de of dEdges) {
            const dSrc = nodes.find((n) => n.id === de.source && n.type === 'question');
            if (dSrc) {
              sourceQId = dSrc.data?.question_id;
              sourceG = getNodeGroup(dSrc, dSrc.data);
              triggerVal = String(decData.comparisonValue || 'Yes');
              const condType = decData.conditionType || 'match';
              if (isElse) {
                triggerType = condType === 'match' ? 'not_match' : (condType === 'greater' ? 'less_or_equal' : 'greater_or_equal');
              } else {
                triggerType = condType;
              }
              break;
            }
          }
        }

        if (sourceQId !== undefined && triggerVal !== null) {
          const existingIdx = groupJumps.findIndex(
            (g) =>
              g.group_id === gIdStr &&
              (!g.source_question_id || g.source_question_id === sourceQId) &&
              (!g.trigger_value || g.trigger_value === triggerVal) &&
              (!g.trigger_type || g.trigger_type === triggerType)
          );
          const jumpEntry = {
            group_id: gIdStr,
            group_title: targetTitle,
            source_question_id: sourceQId,
            trigger_value: triggerVal,
            trigger_type: triggerType,
            source_handle: edge.sourceHandle,
            source_group: sourceG,
          };
          if (existingIdx >= 0) {
            groupJumps[existingIdx] = { ...groupJumps[existingIdx], ...jumpEntry };
          } else {
            groupJumps.push(jumpEntry);
          }
        }
      }
    }

    // 3. Process conditional cross-group edges between questions or decisions
    for (const edge of (edges || [])) {
      const srcNode = nodes.find((n) => n.id === edge.source);
      const tgtNode = nodes.find((n) => n.id === edge.target);
      if (!srcNode || !tgtNode) continue;

      let sourceQId: number | undefined = undefined;
      let sourceG: number | undefined = undefined;
      let triggerVal: string | null = null;
      let triggerType = 'match';
      const isElse =
        edge.sourceHandle === 'else' ||
        (typeof edge.label === 'string' && edge.label.toUpperCase().includes('ELSE'));

      if (srcNode.type === 'question') {
        sourceQId = srcNode.data?.question_id;
        sourceG = getNodeGroup(srcNode, srcNode.data);
        if (edge.sourceHandle && edge.sourceHandle.startsWith('opt-')) {
          triggerVal = decodeURIComponent(edge.sourceHandle.replace('opt-', '')).trim();
        } else if (isElse) {
          triggerType = 'else';
          triggerVal = String(edge.data?.triggerValue || 'else').trim();
        } else if (edge.data?.triggerValue) {
          triggerVal = String(edge.data.triggerValue).trim();
        }
      } else if (srcNode.type === 'decision') {
        const decData = srcNode.data || {};
        const dEdges = (edges || []).filter((e) => e.target === srcNode.id);
        for (const de of dEdges) {
          const dSrc = nodes.find((n) => n.id === de.source && n.type === 'question');
          if (dSrc) {
            sourceQId = dSrc.data?.question_id;
            sourceG = getNodeGroup(dSrc, dSrc.data);
            triggerVal = String(decData.comparisonValue || 'Yes');
            const condType = decData.conditionType || 'match';
            if (isElse) {
              triggerType = condType === 'match' ? 'not_match' : (condType === 'greater' ? 'less_or_equal' : 'greater_or_equal');
            } else {
              triggerType = condType;
            }
            break;
          }
        }
      }

      if (sourceQId !== undefined && triggerVal !== null) {
        const tgtGroup =
          tgtNode.type === 'question'
            ? getNodeGroup(tgtNode, tgtNode.data)
            : tgtNode.data?.numericGroupId ||
              parseInt(String(tgtNode.data?.groupId).replace(/\D+/g, ''), 10);

        if (sourceG !== tgtGroup && tgtGroup) {
          const gIdStr = String(tgtGroup);
          const targetTitle = tgtNode.data?.title || `Group ${tgtGroup}`;
          const targetQId = tgtNode.type === 'question' ? tgtNode.data?.question_id : undefined;

          const existingIdx = groupJumps.findIndex(
            (g) =>
              g.group_id === gIdStr &&
              (!g.source_question_id || g.source_question_id === sourceQId) &&
              (!g.trigger_value || g.trigger_value === triggerVal) &&
              (!g.trigger_type || g.trigger_type === triggerType) &&
              (!g.target_question_id || g.target_question_id === targetQId)
          );
          const jumpEntry = {
            group_id: gIdStr,
            group_title: targetTitle,
            source_question_id: sourceQId,
            trigger_value: triggerVal,
            trigger_type: triggerType,
            source_handle: edge.sourceHandle,
            source_group: sourceG,
            target_question_id: targetQId,
          };
          if (existingIdx >= 0) {
            groupJumps[existingIdx] = { ...groupJumps[existingIdx], ...jumpEntry };
          } else {
            groupJumps.push(jumpEntry);
          }
        }
      }
    }

    const frameNodes = nodes.filter((n) => n.type === 'groupFrame' || n.type === 'groupContainer');
    const distinctQuestionGroups = new Set(
      questions
        .map((q) => q.group)
        .filter((g): g is number => typeof g === 'number' && g > 0)
    );

    let totalGroups: number;
    if (frameNodes.length > 0) {
      // Total groups is strictly the count of group frames on canvas, NOT the group IDs
      totalGroups = frameNodes.length;
    } else if (distinctQuestionGroups.size > 1) {
      // Total groups is the count of distinct groups among questions
      totalGroups = distinctQuestionGroups.size;
    } else {
      totalGroups = groupMeta?.totalGroups || 1;
    }
    const currentGroup = groupMeta?.groupNumber || 1;
    const hasNext = Boolean(groupMeta?.hasNextGroup || currentGroup < totalGroups || groupJumps.length > 0);

    return {
      total_groups: totalGroups,
      current_group: currentGroup,
      next: hasNext,
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

